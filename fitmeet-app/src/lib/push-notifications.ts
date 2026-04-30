import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import { router } from 'expo-router'
import { Platform } from 'react-native'

import { api } from '@/src/lib/api'

export const PUSH_TOKEN_STORAGE_KEY = 'fitmeet-mobile-push-token-v1'

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

  if (eventId && ['new_event', 'event_reminder', 'event_cancelled'].includes(type ?? '')) {
    router.push(`/event/${eventId}` as never)
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
  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response?.notification.request.content.data) {
        routeFromNotificationData(response.notification.request.content.data as Record<string, unknown>)
      }
    })
    .catch(() => {})

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    routeFromNotificationData(response.notification.request.content.data as Record<string, unknown>)
  })

  return () => subscription.remove()
}
