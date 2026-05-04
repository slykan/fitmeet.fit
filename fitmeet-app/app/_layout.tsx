import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'

import { setupPushNotificationRouting, syncPushToken } from '@/src/lib/push-notifications'
import { useAuthStore } from '@/src/store/auth'
import { palette } from '@/src/theme'

export default function RootLayout() {
  const hydrate = useAuthStore((state) => state.hydrate)
  const refreshMe = useAuthStore((state) => state.refreshMe)
  const hasHydrated = useAuthStore((state) => state.hasHydrated)
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const appState = useRef(AppState.currentState)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  // Refresh user data when app comes back to foreground (catches avatar/profile changes made on web)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        const { token: t } = useAuthStore.getState()
        if (t) refreshMe().catch(() => {})
      }
      appState.current = nextState
    })
    return () => sub.remove()
  }, [refreshMe])

  useEffect(() => {
    const cleanup = setupPushNotificationRouting()
    return cleanup
  }, [])

  useEffect(() => {
    if (!hasHydrated || !token || !user) return

    syncPushToken(user.push_notifications !== false).catch(() => {})
  }, [hasHydrated, token, user?.id, user?.push_notifications])

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bg },
          animation: 'fade',
        }}
      />
    </>
  )
}
