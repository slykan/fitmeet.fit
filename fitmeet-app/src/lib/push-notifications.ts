import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import * as TaskManager from 'expo-task-manager'
import { router } from 'expo-router'
import { Linking, Platform } from 'react-native'

import { api } from '@/src/lib/api'
import { badgeDefinition } from '@/src/lib/badges'
import { emitChatRefresh } from '@/src/lib/chat-refresh'
import { useBadgesStore } from '@/src/store/badges'

export const PUSH_TOKEN_STORAGE_KEY = 'fitmeet-mobile-push-token-v1'

const BACKGROUND_NOTIFICATION_TASK = 'fitmeet-background-notification'
const EVENT_STARTED_CATEGORY_ID = 'event_started'
const EVENT_STARTED_CHANNEL_ID = 'event_started'
const BEER_PURCHASED_CATEGORY_ID = 'beer_purchased'
const BEER_PURCHASED_CHANNEL_ID = 'beer_purchased'
const RIDER_STOPPED_CATEGORY_ID = 'rider_stopped'
const RIDER_STOPPED_CHANNEL_ID = 'rider_stopped'
const APPLAUSE_SENT_CHANNEL_ID = 'applause_sent'

function notificationDataFromTaskPayload(data: unknown) {
  const payload = data as Record<string, unknown> | undefined
  const nested = (payload?.notification as { request?: { content?: { data?: Record<string, string> } } } | undefined)
    ?.request?.content?.data
  const directData = payload?.data as Record<string, string> | undefined

  return nested ?? directData ?? (payload as Record<string, string> | undefined)
}

// Must be defined at module top level (before any component mounts)
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }: TaskManager.TaskManagerTaskBody) => {
  if (error) return
  const notifData = notificationDataFromTaskPayload(data)
  if (!notifData) return
  if (notifData._data_only !== 'true') return

  const title     = notifData._title     ?? 'FitMeet'
  const body      = notifData._body      ?? ''
  const categoryId = notifData.categoryId ?? undefined
  const channelId = notifData.channelId ?? EVENT_STARTED_CHANNEL_ID

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _title, _body, _data_only, ...cleanData } = notifData

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: cleanData,
      ...(categoryId ? { categoryIdentifier: categoryId } : {}),
    },
    trigger: Platform.OS === 'android' ? { channelId } : null,
  }).catch(() => {})
})
const CHECK_IN_ACTION_ID = 'check_in'
const OPEN_EVENT_ACTION_ID = 'open_event'
const BUY_BEER_ACTION_ID = 'buy_beer'
const SEE_RANK_ACTION_ID = 'see_rank'
const CHECK_RIDER_ACTION_ID = 'check_rider'
const DISMISS_RIDER_ACTION_ID = 'dismiss_rider'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

// On a cold start (app killed, user taps the push) the response arrives while
// app/index.tsx is still on its splash and about to <Redirect> to the hub tab --
// pushing the event screen right then either throws (navigator not mounted yet)
// or gets replaced by that redirect, so the user landed on the event list instead
// of the event. Routes requested before the tabs are up are parked here and
// opened by (tabs)/_layout once it mounts, on top of the hub (so back returns there).
let tabsReady = false
let pendingRoute: string | null = null

export function navigateWhenReady(path: string) {
  if (tabsReady) {
    router.push(path as never)
  } else {
    pendingRoute = path
  }
}

export function markTabsReady(ready: boolean) {
  tabsReady = ready
  if (!ready || !pendingRoute) return
  const path = pendingRoute
  pendingRoute = null
  // Let the tab navigator finish its first render before stacking on top of it.
  setTimeout(() => router.push(path as never), 0)
}

function enqueueBadgesFromPushData(data: Record<string, unknown> | undefined) {
  const raw = typeof data?.badge_keys === 'string' ? data.badge_keys : null
  if (!raw) return

  const badges = raw.split(',')
    .map(key => badgeDefinition(key.trim()))
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .map(b => ({ ...b, unlocked_at: new Date().toISOString() }))

  if (badges.length) useBadgesStore.getState().enqueue(badges)
}

function routeFromNotificationData(data: Record<string, unknown> | undefined) {
  if (!data) return

  const type = typeof data.type === 'string' ? data.type : null
  const eventId = data.event_id != null ? String(data.event_id) : null

  if (type === 'badge_unlocked') {
    enqueueBadgesFromPushData(data)
    navigateWhenReady('/(tabs)/profile')
    return
  }

  // A bare tap on the check-in push (no action button, e.g. because the background
  // task didn't get to attach one) should still land on the same check-in prompt +
  // live-location toggle the "Check in" button itself triggers, not a plain event page.
  if (eventId && type === 'event_started') {
    navigateWhenReady(`/event/${eventId}?checkin=1`)
    return
  }

  if (eventId && ['new_event', 'event_reminder', 'event_cancelled', 'event_rescheduled', 'rider_stopped', 'applause_sent', 'join_notification', 'moment_reminder'].includes(type ?? '')) {
    navigateWhenReady(`/event/${eventId}`)
    return
  }

  if (eventId && ['event_comment', 'event_comment_mention'].includes(type ?? '')) {
    navigateWhenReady(`/event/${eventId}?wall=1`)
    return
  }

  if (type === 'new_message') {
    emitChatRefresh()
    const conversationId = data.conversation_id != null ? String(data.conversation_id) : null
    navigateWhenReady((conversationId ? `/(tabs)/messages?conversation=${conversationId}` : '/(tabs)/messages'))
    return
  }

  if (type === 'training_synced') {
    navigateWhenReady('/(tabs)/notifications?tab=trainings')
    return
  }

  if (type === 'beer_purchased') {
    navigateWhenReady('/beer-wall')
    return
  }

  if (typeof data.url === 'string' && data.url) {
    Linking.openURL(data.url).catch(() => {})
    return
  }

  if (type === 'friend_request' || type === 'friend_accepted' || type === 'announcement' || type === 'birthday') {
    navigateWhenReady('/(tabs)/notifications?tab=alerts')
  }
}

async function dismissEventNotification(
  response: Notifications.NotificationResponse | null | undefined,
  eventId: string,
) {
  const requestId = response?.notification.request.identifier
  if (requestId) {
    await Notifications.dismissNotificationAsync(requestId).catch(() => {})
  }

  const presented = await Notifications.getPresentedNotificationsAsync().catch(() => [])
  await Promise.all(
    presented
      .filter((notification) => {
        const data = notification.request.content.data as Record<string, unknown> | undefined
        return data?.event_id != null &&
          String(data.event_id) === eventId &&
          data.type === 'event_started'
      })
      .map((notification) => Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => {})),
  )
}

async function registerNotificationCategories() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(EVENT_STARTED_CHANNEL_ID, {
      name: 'Event check-in',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#39FF14',
    }).catch(() => {})
    await Notifications.setNotificationChannelAsync(BEER_PURCHASED_CHANNEL_ID, {
      name: 'Beer wall',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 150, 150, 150],
      lightColor: '#39FF14',
    }).catch(() => {})
    await Notifications.setNotificationChannelAsync(RIDER_STOPPED_CHANNEL_ID, {
      name: 'Rider stopped',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#ff3b30',
    }).catch(() => {})
    await Notifications.setNotificationChannelAsync(APPLAUSE_SENT_CHANNEL_ID, {
      name: 'Applause',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 150, 150, 150],
      lightColor: '#39FF14',
    }).catch(() => {})
  }

  await Notifications.setNotificationCategoryAsync(EVENT_STARTED_CATEGORY_ID, [
    {
      identifier: CHECK_IN_ACTION_ID,
      buttonTitle: 'Check in',
      options: { opensAppToForeground: true },
    },
    {
      identifier: OPEN_EVENT_ACTION_ID,
      buttonTitle: 'Open',
      options: { opensAppToForeground: true },
    },
  ]).catch(() => {})

  await Notifications.setNotificationCategoryAsync(BEER_PURCHASED_CATEGORY_ID, [
    {
      identifier: BUY_BEER_ACTION_ID,
      buttonTitle: 'Buy beer 🍺',
      options: { opensAppToForeground: true },
    },
    {
      identifier: SEE_RANK_ACTION_ID,
      buttonTitle: 'See rank',
      options: { opensAppToForeground: true },
    },
  ]).catch(() => {})

  await Notifications.setNotificationCategoryAsync(RIDER_STOPPED_CATEGORY_ID, [
    {
      identifier: CHECK_RIDER_ACTION_ID,
      buttonTitle: 'Check',
      options: { opensAppToForeground: true },
    },
    {
      identifier: DISMISS_RIDER_ACTION_ID,
      buttonTitle: 'Cancel',
      options: { opensAppToForeground: false },
    },
  ]).catch(() => {})
}

// getLastNotificationResponseAsync() keeps returning the same tap until another
// one replaces it, and setupPushNotificationRouting() re-runs whenever the auth
// token changes -- without this the same event would reopen on every re-login.
let lastHandledResponseKey: string | null = null

async function handleNotificationResponse(response: Notifications.NotificationResponse | null | undefined) {
  if (!response) return
  const responseKey = `${response.notification.request.identifier}:${response.actionIdentifier}`
  if (responseKey === lastHandledResponseKey) return
  lastHandledResponseKey = responseKey

  const data = response.notification.request.content.data as Record<string, unknown> | undefined
  const actionIdentifier = response.actionIdentifier
  const eventId = data?.event_id != null ? String(data.event_id) : null

  if (eventId && actionIdentifier === CHECK_IN_ACTION_ID) {
    try {
      await api.post(`/events/${eventId}/check-in`)
    } catch {}

    await dismissEventNotification(response, eventId)
    // Already checked in by the button itself -- checkin=1 makes the event screen
    // offer live location sharing straight away (see the check-in sheet there).
    navigateWhenReady(`/event/${eventId}?checkin=1`)
    return
  }

  if (actionIdentifier === BUY_BEER_ACTION_ID) {
    navigateWhenReady('/beer-wall')
    return
  }

  if (actionIdentifier === SEE_RANK_ACTION_ID) {
    navigateWhenReady('/(tabs)/ranks')
    return
  }

  if (actionIdentifier === DISMISS_RIDER_ACTION_ID) {
    return
  }

  if (eventId && actionIdentifier === CHECK_RIDER_ACTION_ID) {
    navigateWhenReady(`/event/${eventId}`)
    return
  }

  routeFromNotificationData(data)
}

export async function syncPushToken(pushEnabled: boolean) {
  if (!pushEnabled) {
    await unregisterPushToken()
    return
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#39FF14',
    })
  }

  await registerNotificationCategories()
  await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch(() => {})

  const existingPermissions = await Notifications.getPermissionsAsync()
  let finalStatus = existingPermissions.status

  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync()
    finalStatus = requested.status
  }

  if (finalStatus !== 'granted') {
    return
  }

  // On Android, expo-notifications' native device token IS the FCM registration
  // token, so it works directly with the backend's Firebase Admin SDK delivery.
  // On iOS it's the raw APNs device token instead -- Firebase's sendMulticast()
  // doesn't accept that, so pushes silently failed even with permission granted,
  // and there's no native Firebase SDK running here to exchange it for one (that
  // route needs @react-native-firebase/messaging, which broke this project's iOS
  // native build via its Swift Package Manager-based Firebase resolution colliding
  // with other native modules at link time). Using Expo's own push token/service
  // for iOS instead sidesteps native linking entirely -- the backend sends to
  // Expo's push API for `platform: 'ios'` tokens instead of Firebase.
  let token: string | null = null
  let tokenType: 'fcm' | 'expo' = 'fcm'
  if (Platform.OS === 'ios') {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId })
    token = tokenResult.data
    tokenType = 'expo'
  } else {
    const tokenResult = await Notifications.getDevicePushTokenAsync()
    token = typeof tokenResult.data === 'string' ? tokenResult.data : null
  }

  if (!token) {
    return
  }

  await api.post('/me/push-token', {
    token,
    platform: Platform.OS,
    token_type: tokenType,
    device_name: Platform.OS === 'android' ? 'Android device' : 'iOS device',
  })

  await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token)
}

export async function unregisterPushToken() {
  const token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY)

  if (token) {
    try {
      await api.delete('/me/push-token', { data: { token } })
    } catch {}
  }

  await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY)
}

export function setupPushNotificationRouting() {
  registerNotificationCategories()
  Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch(() => {})

  Notifications.getLastNotificationResponseAsync()
    .then((response) => handleNotificationResponse(response))
    .catch(() => {})

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotificationResponse(response)
  })
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data as Record<string, unknown> | undefined
    if (data?.type === 'new_message') {
      emitChatRefresh()
    }
    if (data?.type === 'badge_unlocked') {
      enqueueBadgesFromPushData(data)
    }
  })

  return () => {
    subscription.remove()
    receivedSubscription.remove()
  }
}
