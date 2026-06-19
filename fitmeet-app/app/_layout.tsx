import { Stack } from 'expo-router'
import { router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Linking from 'expo-linking'
import * as SplashScreen from 'expo-splash-screen'
import { Component, useEffect, useRef } from 'react'
import { AppState, Pressable, Text, View } from 'react-native'
import type { ReactNode, ErrorInfo } from 'react'

import { BeerTickerBanner, BEER_TICKER_HEIGHT } from '@/src/components/BeerTickerBanner'
import { setupPushNotificationRouting, syncPushToken } from '@/src/lib/push-notifications'
import { setupRevenueCat } from '@/src/lib/revenuecat'
import { useAuthStore } from '@/src/store/auth'
import { palette } from '@/src/theme'

SplashScreen.preventAutoHideAsync()

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; errorMsg: string }> {
  state = { hasError: false, errorMsg: '' }
  static getDerivedStateFromError(error: Error) { return { hasError: true, errorMsg: error?.message ?? 'Unknown error' } }
  componentDidCatch(_error: Error, _info: ErrorInfo) { SplashScreen.hideAsync() }
  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 8 }}>Something went wrong</Text>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginBottom: 16 }}>{this.state.errorMsg}</Text>
          <Pressable onPress={() => this.setState({ hasError: false, errorMsg: '' })} style={{ backgroundColor: '#39FF14', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 }}>
            <Text style={{ color: '#000', fontWeight: '800', fontSize: 15 }}>Try again</Text>
          </Pressable>
        </View>
      )
    }
    return this.props.children
  }
}

function appPathFromUrl(url: string | null, hasToken: boolean) {
  if (!url) return null

  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')

    if (host === 'fitmeet.fit' && parsed.pathname === '/reset-password') {
      const token = parsed.searchParams.get('token')
      const email = parsed.searchParams.get('email')
      if (!token || !email) return null
      return `/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
    }

    if (parsed.protocol === 'fitmeet:' && parsed.hostname === 'reset-password') {
      const token = parsed.searchParams.get('token')
      const email = parsed.searchParams.get('email')
      if (!token || !email) return null
      return `/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
    }

    if (!hasToken) return null

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

  useEffect(() => {
    if (hasHydrated) SplashScreen.hideAsync()
  }, [hasHydrated])

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
    if (!hasHydrated) return

    function openAppUrl(url: string | null) {
      const path = appPathFromUrl(url, Boolean(token))
      if (!path || path === lastDeepLink.current) return
      lastDeepLink.current = path
      router.push(path as never)
    }

    Linking.getInitialURL().then(openAppUrl).catch(() => {})
    const sub = Linking.addEventListener('url', ({ url }) => openAppUrl(url))
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
    <ErrorBoundary>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.bg, paddingTop: BEER_TICKER_HEIGHT },
          animation: 'fade',
        }}
      />
      <BeerTickerBanner />
    </ErrorBoundary>
  )
}
