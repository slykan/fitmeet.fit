import AsyncStorage from '@react-native-async-storage/async-storage'
import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'

import { useAuthStore } from '@/src/store/auth'
import { INTRO_SEEN_KEY } from './intro'

export default function IndexScreen() {
  const hasHydrated = useAuthStore((state) => state.hasHydrated)
  const token       = useAuthStore((state) => state.token)
  const user        = useAuthStore((state) => state.user)

  const [introChecked, setIntroChecked] = useState(false)
  const [introSeen,    setIntroSeen]    = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(INTRO_SEEN_KEY).then((val) => {
      setIntroSeen(!!val)
      setIntroChecked(true)
    })
  }, [])

  if (!hasHydrated || !introChecked) return null

  if (!introSeen) return <Redirect href="/intro" />

  if (!token) return <Redirect href="/welcome" />

  if (!user?.onboarding_complete) return <Redirect href="/onboarding" />

  return <Redirect href="/(tabs)/hub" />
}
