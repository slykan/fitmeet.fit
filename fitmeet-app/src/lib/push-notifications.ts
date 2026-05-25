import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import * as TaskManager from 'expo-task-manager'
import { router } from 'expo-router'
import { Platform } from 'react-native'

import { api } from '@/src/lib/api'

export const PUSH_TOKEN_STORAGE_KEY = 'fitmeet-mobile-push-token-v1'

const BACKGROUND_NOTIFICATION_TASK = 'fitmeet-background-notification'
const EVENT_STARTED_CATEGORY_ID = 'event_started'
const EVENT_STARTED_CHANNEL_ID = 'event_started'

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

  const title     = notifData._title     ?? 'FitMeet'
  const body      = notifData._body      ?? ''
  const categoryId = notifData.categoryId ?? undefined

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _title, _body, _data_only, ...cleanData } = notifData

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: cleanData,
      ...(categoryId ? { categoryIdentifier: categoryId } : {}),
    },
    trigger: Platform.OS === 'android' ? { channelId: EVENT_STARTED_CHANNEL_ID } : null,
  }).catch(() => {})
})
const CHECK_IN_ACTION_ID = 'check_in'
const OPEN_EVENT_ACTION_ID = 'open_event'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

function routeFromNotificationData(data: Record<string, unknown> | undefined) {
  if (!data) return

  const type = typeof data.type === 'string' ? data.type : null
  const eventId = data.event_id != null ? String(data.event_id) : null

  if (eventId && ['new_event', 'event_reminder', 'event_cancelled', 'event_started'].includes(type ?? '')) {
    router.push(`/event/${eventId}` as never)
    return
  }

  if (eventId && ['event_comment', 'event_comment_mention'].includes(type ?? '')) {
    router.push(`/event/${eventId}?wall=1` as never)
    return
  }

  if (type === 'new_message') {
    router.push('/(tabs)/messages' as never)
    return
  }

  if (type === 'friend_request' || type === 'friend_accepted') {
    router.push('/(tabs)/notifications' as never)
  }
}

async function registerNotificationCategories() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(EVENT_STARTED_CHANNEL_ID, {
      name: 'Event check-in',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
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
}

async function handleNotificationResponse(response: Notifications.NotificationResponse | null | undefined) {
  const data = response?.notification.request.content.data as Record<string, unknown> | undefined
  const actionIdentifier = response?.actionIdentifier
  const eventId = data?.event_id != null ? String(data.event_id) : null

  if (eventId && actionIdentifier === CHECK_IN_ACTION_ID) {
    try {
      await api.post(`/events/${eventId}/check-in`)
    } catch {}

    router.push(`/event/${eventId}` as never)
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

  const tokenResult = await Notifications.getDevicePushTokenAsync()
  const token = typeof tokenResult.data === 'string' ? tokenResult.data : null

  if (!token) {
    return
  }

  await api.post('/me/push-token', {
    token,
    platform: Platform.OS,
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

  return () => subscription.remove()
}
