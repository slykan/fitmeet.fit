import { useEffect, useRef } from 'react'
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native'
import { Audio } from 'expo-av'

import { useBadgesStore } from '@/src/store/badges'

const { width: W, height: H } = Dimensions.get('window')

const GREEN = '#39FF14'
const NUM_SPARKS = 24
const SPARK_COLORS = [GREEN, '#FFFFFF', GREEN, '#FFD700', GREEN]

function makeSparks() {
  return Array.from({ length: NUM_SPARKS }, (_, i) => {
    const angle = (i / NUM_SPARKS) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
    const dist = 70 + Math.random() * 140
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 20,
      color: SPARK_COLORS[i % SPARK_COLORS.length],
      size: 8 + Math.random() * 14,
      rot: 120 + Math.random() * 360,
    }
  })
}

function Sparks({ progress }: { progress: Animated.Value }) {
  const sparks = useRef(makeSparks()).current

  return (
    <View style={styles.sparksWrap} pointerEvents="none">
      {sparks.map((s, i) => (
        <Animated.Text
          key={i}
          style={{
            position: 'absolute',
            color: s.color,
            fontSize: s.size,
            transform: [
              { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, s.dx] }) },
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, s.dy] }) },
              { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${s.rot}deg`] }) },
              { scale: progress.interpolate({ inputRange: [0, 0.15, 0.6, 1], outputRange: [0, 1.3, 1, 0.2] }) },
            ],
            opacity: progress.interpolate({ inputRange: [0, 0.1, 0.65, 1], outputRange: [0, 1, 0.9, 0] }),
          }}
        >
          ✦
        </Animated.Text>
      ))}
    </View>
  )
}

export function BadgeUnlockOverlay() {
  const current = useBadgesStore(s => s.current)
  const dismiss = useBadgesStore(s => s.dismiss)

  const fadeOverall = useRef(new Animated.Value(1)).current
  const glowFlash    = useRef(new Animated.Value(0)).current
  const badgeScale   = useRef(new Animated.Value(0)).current
  const badgeSpin    = useRef(new Animated.Value(0)).current
  const ringScale    = useRef(new Animated.Value(0.6)).current
  const ringOpacity  = useRef(new Animated.Value(0)).current
  const sparks       = useRef(new Animated.Value(0)).current
  const slideText    = useRef(new Animated.Value(30)).current
  const opacityText  = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!current) return

    fadeOverall.setValue(1)
    glowFlash.setValue(0)
    badgeScale.setValue(0)
    badgeSpin.setValue(0)
    ringScale.setValue(0.6)
    ringOpacity.setValue(0)
    sparks.setValue(0)
    slideText.setValue(30)
    opacityText.setValue(0)

    let sound: Audio.Sound | null = null
    const playFanfare = async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
        const { sound: s } = await Audio.Sound.createAsync(
          require('../../assets/sounds/applause.mp3'),
          { shouldPlay: true, volume: 0.85 },
        )
        sound = s
        s.setOnPlaybackStatusUpdate(st => {
          if (!st.isLoaded || !st.didJustFinish) return
          s.unloadAsync().catch(() => {})
        })
      } catch {}
    }

    const ringPulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 1.5, duration: 900, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
        Animated.timing(ringScale, { toValue: 0.9, duration: 0, useNativeDriver: true }),
      ]),
      { iterations: 3 },
    )

    Animated.sequence([
      Animated.timing(glowFlash, { toValue: 1, duration: 300, useNativeDriver: true }),

      Animated.parallel([
        Animated.spring(badgeScale, { toValue: 1, friction: 3.5, tension: 80, useNativeDriver: true }),
        Animated.timing(badgeSpin, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),

      Animated.parallel([
        Animated.timing(sparks, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(slideText, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(opacityText, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),

      Animated.delay(1800),
      Animated.timing(fadeOverall, { toValue: 0, duration: 450, useNativeDriver: true }),
    ]).start(() => {
      sound?.unloadAsync().catch(() => {})
      dismiss()
    })

    ringOpacity.setValue(0.8)
    const ringTimer = setTimeout(() => ringPulse.start(), 500)
    const soundTimer = setTimeout(playFanfare, 300)

    return () => {
      clearTimeout(ringTimer)
      clearTimeout(soundTimer)
      ringPulse.stop()
      sound?.unloadAsync().catch(() => {})
    }
  }, [current?.key])

  if (!current) return null

  const spin = badgeSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const glowOpacity = glowFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.16] })

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={() => { fadeOverall.stopAnimation(); dismiss() }}>
      <Animated.View style={[styles.overlay, { opacity: fadeOverall }]} pointerEvents="box-none">
        <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />

        <View style={styles.center}>
          <Sparks progress={sparks} />
          <Animated.View style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />
          <Animated.Text
            style={[styles.badgeEmoji, { transform: [{ scale: badgeScale }, { rotate: spin }] }]}
          >
            {current.emoji}
          </Animated.Text>
        </View>

        <Animated.View style={[styles.textWrap, { transform: [{ translateY: slideText }], opacity: opacityText }]}>
          <Text style={styles.eyebrow}>Badge Unlocked</Text>
          <Text style={styles.title}>{current.name}</Text>
          <Text style={styles.subtitle}>{current.description}</Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    backgroundColor: 'rgba(5,5,10,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  glow: {
    position: 'absolute',
    width: Math.max(W, H) * 1.4,
    height: Math.max(W, H) * 1.4,
    borderRadius: Math.max(W, H) * 0.7,
    backgroundColor: GREEN,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 160,
    height: 160,
  },
  sparksWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: GREEN,
  },
  badgeEmoji: {
    fontSize: 76,
  },
  textWrap: {
    alignItems: 'center',
    gap: 4,
  },
  eyebrow: {
    color: GREEN,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 260,
    marginTop: 2,
  },
})
