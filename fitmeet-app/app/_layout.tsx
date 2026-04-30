import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'

import { setupPushNotificationRouting, syncPushToken } from '@/src/lib/push-notifications'
import { useAuthStore } from '@/src/store/auth'
import { palette } from '@/src/theme'

export default function RootLayout() {
  const hydrate = useAuthStore((state) => state.hydrate)
  const hasHydrated = useAuthStore((state) => state.hasHydrated)
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    const cleanup = setupPushNotificationRouting()
    return cleanup
  }, [])

  useEffect(() => {
    if (!hasHydrated || !token || !user) return

    syncPushToken(user.push_notifications).catch(() => {})
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
