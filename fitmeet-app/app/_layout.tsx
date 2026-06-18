import { Stack } from 'expo-router'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Linking from 'expo-linking'
import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'

import { BeerTickerBanner, BEER_TICKER_HEIGHT } from '@/src/components/BeerTickerBanner'
import { setupPushNotificationRouting, syncPushToken } from '@/src/lib/push-notifications'
import { setupRevenueCat } from '@/src/lib/revenuecat'
import { useAuthStore } from '@/src/store/auth'
import { palette } from '@/src/theme'

function eventPathFromUrl(url: string | null) {
  if (!url) return null

  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')

    if (host === 'fitmeet.fit' && ['/events/share', '/events/view', '/events/check-in'].includes(parsed.pathname)) {
      const id = parsed.searchParams.get('id')
      if (!id) return null
      const checkIn = parsed.pathname === '/events/check-in' || parsed.searchParams.get('checkin') === '1'
      return `/event/${encodeURIComponent(id)}${checkIn ? '?checkin=1' : ''}`
    }

    if (parsed.protocol === 'fitmeet:' && parsed.hostname === 'event') {
      const id = parsed.pathname.split('/').filter(Boolean)[0]
      const checkIn = parsed.searchParams.get('checkin') === '1'
      return id ? `/event/${encodeURIComponent(id)}${checkIn ? '?checkin=1' : ''}` : null
    }
  } catch {}

  return null
}

export default function RootLayout() {
  const hydrate = useAuthStore((state) => state.hydrate)
  const refreshMe = useAuthStore((state) => state.refreshMe)
  const hasHydrated = useAuthStore((state) => state.hasHydrated)
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const appState = useRef(AppState.currentState)
  const lastDeepLink = useRef<string | null>(null)

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
    if (!hasHydrated || !token) return

    const cleanup = setupPushNotificationRouting()
    return cleanup
  }, [hasHydrated, token])

  useEffect(() => {
    if (!hasHydrated || !token) return

    function openEventUrl(url: string | null) {
      const path = eventPathFromUrl(url)
      if (!path || path === lastDeepLink.current) return
      lastDeepLink.current = path
      router.push(path as never)
    }

    Linking.getInitialURL().then(openEventUrl).catch(() => {})
    const sub = Linking.addEventListener('url', ({ url }) => openEventUrl(url))
    return () => sub.remove()
  }, [hasHydrated, token])

  useEffect(() => {
    if (!hasHydrated || !token || !user) return

    syncPushToken(user.push_notifications !== false).catch(() => {})
  }, [hasHydrated, token, user?.id, user?.push_notifications])

  useEffect(() => {
    if (!hasHydrated || !token || !user) return
    setupRevenueCat(user.id).catch(() => {})
  }, [hasHydrated, token, user?.id])

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bg, paddingTop: BEER_TICKER_HEIGHT },
          animation: 'fade',
        }}
      />
      <BeerTickerBanner />
    </>
  )
}
