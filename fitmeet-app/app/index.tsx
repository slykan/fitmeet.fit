import { Redirect } from 'expo-router'

import { useAuthStore } from '@/src/store/auth'

export default function IndexScreen() {
  const hasHydrated = useAuthStore((state) => state.hasHydrated)
  const token       = useAuthStore((state) => state.token)
  const user        = useAuthStore((state) => state.user)

  if (!hasHydrated) return null

  if (!token) return <Redirect href="/welcome" />

  if (!user?.onboarding_complete) return <Redirect href="/onboarding" />

  return <Redirect href="/(tabs)/hub" />
}
