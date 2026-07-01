import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native'

import { useAuthStore } from '@/src/store/auth'

const { width: W, height: H } = Dimensions.get('window')

const STORAGE_KEY = 'fitmeet-birthday-shown-v1'

const NUM_PIECES = 48
const COLORS = ['#FF6B6B', '#FFE66D', '#4ECDC4', '#A8E6CF', '#FF8B94', '#C39BD3', '#FD79A8', '#00CEC9', '#FDCB6E', '#6C5CE7', '#FF7675', '#55EFC4']
const SHAPES = ['★', '✦', '●', '♦', '✿', '❋', '◆', '▲']

function makeConfetti() {
  return Array.from({ length: NUM_PIECES }, (_, i) => {
    const angle = (i / NUM_PIECES) * Math.PI * 2 + (Math.random() - 0.5) * 0.6
    const dist = 60 + Math.random() * 160
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 40,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 9 + Math.random() * 15,
      rot: 180 + Math.random() * 540,
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    }
  })
}

function Confetti({ progress }: { progress: Animated.Value }) {
  const pieces = useRef(makeConfetti()).current
  return (
    <View style={styles.confettiWrap} pointerEvents="none">
      {pieces.map((p, i) => (
        <Animated.Text
          key={i}
          style={{
            position: 'absolute',
            color: p.color,
            fontSize: p.size,
            transform: [
              { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] }) },
              { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rot}deg`] }) },
              { scale: progress.interpolate({ inputRange: [0, 0.12, 0.6, 1], outputRange: [0, 1.4, 1.1, 0.2] }) },
            ],
            opacity: progress.interpolate({ inputRange: [0, 0.08, 0.7, 1], outputRange: [0, 1, 0.9, 0] }),
          }}
        >
          {p.shape}
        </Animated.Text>
      ))}
    </View>
  )
}

function isTodayBirthday(birthDate: string | null): boolean {
  if (!birthDate) return false
  const today = new Date()
  const [, m, d] = birthDate.split('-').map(Number)
  return today.getMonth() + 1 === m && today.getDate() === d
}

export function BirthdayOverlay() {
  const user = useAuthStore(s => s.user)
  const [visible, setVisible] = useState(false)

  const fadeOverall = useRef(new Animated.Value(1)).current
  const cakeScale   = useRef(new Animated.Value(0)).current
  const cakeSpin    = useRef(new Animated.Value(0)).current
  const confetti    = useRef(new Animated.Value(0)).current
  const slideText   = useRef(new Animated.Value(30)).current
  const opacityText = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!user?.birth_date || !isTodayBirthday(user.birth_date)) return

    const today = new Date().toDateString()
    AsyncStorage.getItem(STORAGE_KEY).then(stored => {
      if (stored === today) return
      AsyncStorage.setItem(STORAGE_KEY, today)
      setVisible(true)
    })
  }, [user?.birth_date])

  useEffect(() => {
    if (!visible) return

    Animated.sequence([
      Animated.parallel([
        Animated.spring(cakeScale, { toValue: 1, friction: 4, tension: 80, useNativeDriver: true }),
        Animated.timing(cakeSpin, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),

      Animated.parallel([
        Animated.timing(confetti, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(slideText, { toValue: 0, duration: 450, useNativeDriver: true }),
          Animated.timing(opacityText, { toValue: 1, duration: 450, useNativeDriver: true }),
        ]),
      ]),

      Animated.delay(2400),
      Animated.timing(fadeOverall, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start(() => setVisible(false))
  }, [visible])

  if (!visible || !user) return null

  const spin = cakeSpin.interpolate({ inputRange: [0, 1], outputRange: ['-15deg', '0deg'] })
  const firstName = user.name.split(' ')[0]

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeOverall }]} pointerEvents="none">

      {/* Text above */}
      <Animated.View style={[styles.textWrap, { transform: [{ translateY: slideText }], opacity: opacityText }]}>
        <Text style={styles.title}>Happy Birthday{'\n'}{user.name}!</Text>
        <Text style={styles.subtitle}>by FitMeet.Fit</Text>
      </Animated.View>

      {/* Cake + confetti */}
      <View style={styles.center}>
        <Confetti progress={confetti} />
        <Animated.Text
          style={[styles.cake, { transform: [{ scale: cakeScale }, { rotate: spin }] }]}
        >
          🎂
        </Animated.Text>
      </View>

    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    backgroundColor: 'rgba(5,8,22,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  textWrap: {
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: 0.3,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  confettiWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cake: {
    fontSize: 64,
  },
})
