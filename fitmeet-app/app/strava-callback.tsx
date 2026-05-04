import { router, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'

import { dispatchStravaCode } from '@/src/lib/strava-bridge'
import { useAuthStore } from '@/src/store/auth'
import { palette } from '@/src/theme'

export default function StravaCallbackScreen() {
  const { code } = useLocalSearchParams<{ code: string }>()
  const token         = useAuthStore((s) => s.token)
  const loginWithStrava = useAuthStore((s) => s.loginWithStrava)

  useEffect(() => {
    if (!code) { router.replace('/'); return }

    const decoded = decodeURIComponent(code)

    // If authenticated → route import flow: pass code back to StravaRoutePicker
    if (token) {
      const handled = dispatchStravaCode(decoded)
      if (handled) {
        router.back()
      } else {
        router.replace('/(tabs)/hub')
      }
      return
    }

    // Not authenticated → sign in flow
    loginWithStrava(decoded)
      .then(() => {
        const user = useAuthStore.getState().user
        router.replace(user?.onboarding_complete ? '/(tabs)/hub' : '/onboarding')
      })
      .catch(() => router.replace('/login'))
  }, [code, token, loginWithStrava])

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={palette.accent} />
    </View>
  )
}
