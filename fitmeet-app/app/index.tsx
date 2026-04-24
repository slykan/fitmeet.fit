import { Redirect } from 'expo-router'

import { useAuthStore } from '@/src/store/auth'

export default function IndexScreen() {
  const hasHydrated = useAuthStore((state) => state.hasHydrated)
  const token = useAuthStore((state) => state.token)

  if (!hasHydrated) return null

  return <Redirect href={token ? '/(tabs)/hub' : '/welcome'} />
}
