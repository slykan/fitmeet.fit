import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuthStore } from '@/src/store/auth'

const LOGO = require('../assets/logo-c.png')
const FEATURES = ['Nearby events', 'Create & join', 'Check in & chat']

export default function WelcomeScreen() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const heroShift = useRef(new Animated.Value(0)).current
  const ctaOpacity = useRef(new Animated.Value(0)).current
  const ctaShift = useRef(new Animated.Value(34)).current
  const [termsAccepted, setTermsAccepted] = useState(false)

  useEffect(() => {
    if (!hasHydrated || !token) return
    router.replace(user?.onboarding_complete ? '/(tabs)/hub' : '/onboarding')
  }, [hasHydrated, token, user?.onboarding_complete])

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(heroShift, {
          toValue: -18,
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
    }, 800)

    return () => clearTimeout(timer)
  }, [ctaOpacity, ctaShift, heroShift])

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.heroWrap}>
        <Animated.Text style={[styles.logoText, { transform: [{ translateY: heroShift }] }]}>
          <Text style={styles.logoTextGreen}>FIT</Text>MEET
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

          <Pressable style={styles.termsRow} onPress={() => setTermsAccepted((v) => !v)} hitSlop={8}>
            <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
              {termsAccepted && <Ionicons name="checkmark" size={13} color="#041109" />}
            </View>
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text style={styles.termsLink} onPress={() => WebBrowser.openBrowserAsync('https://fitmeet.fit/terms')}>
                Terms of Use
              </Text>
              {' '}and{' '}
              <Text style={styles.termsLink} onPress={() => WebBrowser.openBrowserAsync('https://fitmeet.fit/privacy')}>
                Privacy Policy
              </Text>
            </Text>
          </Pressable>

          <Pressable
            style={[styles.primaryBtn, !termsAccepted && styles.ctaDisabled]}
            onPress={() => router.push('/register')}
            disabled={!termsAccepted}
          >
            <LinearGradient
              colors={['#6cff2f', '#39FF14']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryBtnGrad}
            >
              <Text style={styles.primaryLabel}>Get started</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            style={[styles.secondaryBtn, !termsAccepted && styles.ctaDisabled]}
            onPress={() => router.push('/login')}
            disabled={!termsAccepted}
          >
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
    alignItems: 'center',
    paddingHorizontal: 48,
    paddingTop: 8,
  },
  logo: {
    width: '32%',
    maxWidth: 124,
    aspectRatio: 439 / 448,
    marginTop: -4,
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
    marginBottom: 2,
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
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 6, marginTop: 1,
    borderWidth: 1.5, borderColor: 'rgba(57,255,20,0.4)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: '#39FF14', borderColor: '#39FF14' },
  termsText: {
    flex: 1,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    lineHeight: 17,
  },
  termsLink: { color: '#39FF14', fontWeight: '700' },
  ctaDisabled: { opacity: 0.4 },
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
