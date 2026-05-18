import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { useRef, useState } from 'react'
import {
  Animated, Dimensions, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { palette, spacing } from '@/src/theme'

export const INTRO_SEEN_KEY = 'fitmeet-intro-seen-v2'

const { width } = Dimensions.get('window')

const SLIDES = [
  {
    emoji: '🏃',
    title: 'Find your people.\nMove together.',
    body: 'Discover local sports and social events near you — running, cycling, yoga, hiking and more.',
    gradient: ['#050816', '#0d1a3a'],
  },
  {
    emoji: '📅',
    title: 'Public & private events',
    body: 'Browse open events for anyone to join, or create private ones just for your friends.',
    gradient: ['#050816', '#1a0d2e'],
  },
  {
    emoji: '✅',
    title: 'Join, show up, check in',
    body: 'Join events in one tap. Get a reminder before it starts. Check in when you arrive — straight from the notification.',
    gradient: ['#050816', '#0d1f0d'],
  },
  {
    emoji: '🤝',
    title: 'Meet active people',
    body: 'Add friends, chat, see who\'s going. Invite people to your events and build your active circle.',
    gradient: ['#050816', '#1a150d'],
  },
  {
    emoji: '🏆',
    title: 'Community Badges',
    body: 'Climb the leaderboards — Consistency Beast, Event Creator, Local Legend and more. Buy a beer and get your name on every screen.',
    gradient: ['#050816', '#1a1200'],
  },
  {
    emoji: '🗺️',
    title: 'Everything on the map',
    body: 'The Hub shows live events and weather near you. Filter by sport, distance and friends.',
    gradient: ['#050816', '#0d1a1a'],
  },
]

export default function IntroScreen() {
  const [current, setCurrent] = useState(0)
  const scrollRef = useRef<ScrollView>(null)
  const fadeAnim = useRef(new Animated.Value(1)).current

  function goTo(index: number) {
    scrollRef.current?.scrollTo({ x: index * width, animated: true })
    setCurrent(index)
  }

  function handleNext() {
    if (current < SLIDES.length - 1) {
      goTo(current + 1)
    } else {
      finish()
    }
  }

  async function finish() {
    await AsyncStorage.setItem(INTRO_SEEN_KEY, '1')
    router.replace('/welcome')
  }

  const slide = SLIDES[current]

  return (
    <View style={styles.container}>
      <LinearGradient colors={slide.gradient as [string, string]} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safe}>
        {/* Skip */}
        <View style={styles.topBar}>
          <View />
          <Pressable onPress={finish} hitSlop={12}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        </View>

        {/* Slides */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {SLIDES.map((s, i) => (
            <View key={i} style={[styles.slide, { width }]}>
              <Text style={styles.emoji}>{s.emoji}</Text>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <Pressable key={i} onPress={() => goTo(i)}>
              <View style={[styles.dot, i === current && styles.dotActive]} />
            </Pressable>
          ))}
        </View>

        {/* Button */}
        <View style={styles.btnWrap}>
          <Pressable style={styles.btn} onPress={handleNext}>
            <Text style={styles.btnText}>
              {current === SLIDES.length - 1 ? "Let's go →" : 'Next →'}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    paddingBottom: 4,
  },
  skip: { color: palette.textDim, fontSize: 14, fontWeight: '600' },

  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    gap: 20,
  },
  emoji: { fontSize: 72 },
  title: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 34,
  },
  body: {
    color: palette.textDim,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 24,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    width: 24,
    backgroundColor: palette.accent,
  },

  btnWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 24,
  },
  btn: {
    backgroundColor: palette.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnText: {
    color: '#031109',
    fontSize: 16,
    fontWeight: '900',
  },
})
