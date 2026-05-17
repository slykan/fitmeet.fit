import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { api } from '@/src/lib/api'
import { useAuthStore } from '@/src/store/auth'

const LOGO = require('../assets/logo-c.png')
const FEATURES = ['Nearby events', 'Create & join', 'Check in & chat']
type Donor = { name: string; product_id: string }

export default function WelcomeScreen() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const heroShift = useRef(new Animated.Value(0)).current
  const ctaOpacity = useRef(new Animated.Value(0)).current
  const ctaShift = useRef(new Animated.Value(34)).current
  const [donors, setDonors] = useState<Donor[]>([])

  useEffect(() => {
    if (!hasHydrated || !token) return
    router.replace(user?.onboarding_complete ? '/(tabs)/hub' : '/onboarding')
  }, [hasHydrated, token, user?.onboarding_complete])

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(heroShift, {
          toValue: 14,
          duration: 760,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(ctaOpacity, {
          toValue: 1,
          duration: 560,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ctaShift, {
          toValue: 0,
          duration: 760,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start()
    }, 3000)

    return () => clearTimeout(timer)
  }, [ctaOpacity, ctaShift, heroShift])

  useEffect(() => {
    api.get('/beer-donations?limit=3')
      .then(r => setDonors(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
  }, [])

  const donorNames = donors.map(donor => donor.name).join(' · ')

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.heroWrap}>
        <Animated.Text style={[styles.logoText, { transform: [{ translateY: heroShift }] }]}>
          FIT<Text style={styles.logoTextGreen}>MEET</Text>
        </Animated.Text>
        <Animated.Image
          source={LOGO}
          style={[styles.logo, { transform: [{ translateY: heroShift }] }]}
          resizeMode="contain"
        />
      </View>

      <View pointerEvents="box-none" style={styles.safe}>
        <Animated.View
          style={[
            styles.ctaWrap,
            {
              opacity: ctaOpacity,
              transform: [{ translateY: ctaShift }],
            },
          ]}
        >
          <Text style={styles.tagline}>Find your people. Move together.</Text>
          <Text style={styles.subtitle}>
            Discover local events, meet new people and keep every activity in sync.
          </Text>

          <View style={styles.featureRow}>
            {FEATURES.map((feature) => (
              <View key={feature} style={styles.featurePill}>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {donors.length > 0 && (
            <Pressable style={styles.beerCard} onPress={() => router.push('/beer-wall')}>
              <View style={styles.beerIcon}>
                <Ionicons name="beer-outline" size={16} color="#f6c65b" />
              </View>
              <View style={styles.beerCopy}>
                <Text style={styles.beerTitle}>Beer Wall of Fame</Text>
                <Text style={styles.beerNames} numberOfLines={1}>{donorNames}</Text>
              </View>
              <Ionicons name="chevron-forward" size={14} color="rgba(246,198,91,0.58)" />
            </Pressable>
          )}

          <Pressable style={styles.primaryBtn} onPress={() => router.push('/register')}>
            <LinearGradient
              colors={['#6cff2f', '#39FF14']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryBtnGrad}
            >
              <Text style={styles.primaryLabel}>Get started</Text>
            </LinearGradient>
          </Pressable>

          <Pressable style={styles.secondaryBtn} onPress={() => router.push('/login')}>
            <Text style={styles.secondaryLabel}>Sign in</Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  heroWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 48,
    paddingTop: 46,
    backgroundColor: '#000000',
  },
  logo: {
    width: '34%',
    maxWidth: 150,
    aspectRatio: 439 / 448,
    marginTop: 8,
  },
  safe: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingBottom: 96,
  },
  ctaWrap: {
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 14,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 14,
  },
  logoTextGreen: { color: '#39FF14' },
  tagline: {
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    marginTop: -6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.52)',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    paddingHorizontal: 8,
    marginTop: -4,
  },
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 2,
  },
  featurePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(57,255,20,0.24)',
    backgroundColor: 'rgba(57,255,20,0.07)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  featureText: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '700',
  },
  beerCard: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(246,198,91,0.22)',
    backgroundColor: 'rgba(246,198,91,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  beerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(246,198,91,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  beerCopy: {
    flex: 1,
    gap: 2,
  },
  beerTitle: {
    color: '#f6c65b',
    fontSize: 12,
    fontWeight: '900',
  },
  beerNames: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 12,
    fontWeight: '600',
  },
  primaryBtn: { width: '100%', borderRadius: 18, overflow: 'hidden' },
  primaryBtnGrad: { height: 56, alignItems: 'center', justifyContent: 'center' },
  primaryLabel: { color: '#041109', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  secondaryBtn: {
    height: 56,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(57,255,20,0.3)',
    backgroundColor: 'rgba(57,255,20,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { color: '#39FF14', fontSize: 16, fontWeight: '700' },
})
