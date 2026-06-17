import AsyncStorage from '@react-native-async-storage/async-storage'
import { Redirect } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native'

import { useAuthStore } from '@/src/store/auth'
import { INTRO_SEEN_KEY } from './intro'

const LOGO = require('../assets/logo-c.png')

function SplashLoading() {
  return (
    <View style={styles.splash}>
      <Text style={styles.logoText}>
        <Text style={styles.logoGreen}>FIT</Text>MEET
      </Text>
      <Image source={LOGO} style={styles.logo} resizeMode="contain" />
      <ActivityIndicator color="#39FF14" style={styles.spinner} />
    </View>
  )
}

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

  if (!hasHydrated || !introChecked) return <SplashLoading />

  if (!introSeen) return <Redirect href="/intro" />

  if (!token) return <Redirect href="/welcome" />

  if (!user?.onboarding_complete) return <Redirect href="/onboarding" />

  return <Redirect href="/(tabs)/hub" />
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#ffffff',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 2,
  },
  logoGreen: { color: '#39FF14' },
  logo: {
    width: '44%',
    maxWidth: 168,
    aspectRatio: 439 / 448,
    marginTop: -2,
  },
  spinner: { marginTop: 32 },
})
