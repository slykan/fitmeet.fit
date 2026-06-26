import { useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native'
import { Audio } from 'expo-av'

const { width: W, height: H } = Dimensions.get('window')

const START = new Date('2026-06-11T00:00:00Z').getTime()
const END = new Date('2026-07-20T00:00:00Z').getTime()

const CHECKER_COLS = 7
const CELL = Math.ceil(W / CHECKER_COLS)
const CHECKER_ROWS = Math.ceil(H / CELL)

const NUM_STARS = 28
const STAR_COLORS = ['#FF0000', '#FFFFFF', '#FF0000', '#FFFFFF', '#FF2222', '#FFE0E0']

function makeStars() {
  return Array.from({ length: NUM_STARS }, (_, i) => {
    const angle = (i / NUM_STARS) * Math.PI * 2 + (Math.random() - 0.5) * 0.4
    const dist = 70 + Math.random() * 130
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist - 20,
      color: STAR_COLORS[i % STAR_COLORS.length],
      size: 10 + Math.random() * 16,
      rot: 120 + Math.random() * 360,
    }
  })
}

function Checkerboard({ opacity }: { opacity: Animated.Value }) {
  const rows = []
  for (let r = 0; r < CHECKER_ROWS; r++) {
    const cells = []
    for (let c = 0; c < CHECKER_COLS; c++) {
      cells.push(
        <View
          key={c}
          style={{
            width: CELL,
            height: CELL,
            backgroundColor: (r + c) % 2 === 0 ? '#FF0000' : '#FFFFFF',
          }}
        />,
      )
    }
    rows.push(
      <View key={r} style={{ flexDirection: 'row' }}>
        {cells}
      </View>,
    )
  }
  return (
    <Animated.View style={[styles.checkerWrap, { opacity }]}>
      {rows}
    </Animated.View>
  )
}

function ConfettiStars({ progress }: { progress: Animated.Value }) {
  const stars = useRef(makeStars()).current

  return (
    <View style={styles.confettiWrap} pointerEvents="none">
      {stars.map((s, i) => (
        <Animated.Text
          key={i}
          style={{
            position: 'absolute',
            color: s.color,
            fontSize: s.size,
            transform: [
              {
                translateX: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, s.dx],
                }),
              },
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, s.dy],
                }),
              },
              {
                rotate: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', `${s.rot}deg`],
                }),
              },
              {
                scale: progress.interpolate({
                  inputRange: [0, 0.15, 0.6, 1],
                  outputRange: [0, 1.3, 1, 0.2],
                }),
              },
            ],
            opacity: progress.interpolate({
              inputRange: [0, 0.1, 0.65, 1],
              outputRange: [0, 1, 0.9, 0],
            }),
          }}
        >
          ★
        </Animated.Text>
      ))}
    </View>
  )
}

export function WorldCupOverlay() {
  const [visible, setVisible] = useState(() => {
    const now = Date.now()
    return now >= START && now <= END
  })

  const fadeOverall = useRef(new Animated.Value(1)).current
  const ballY = useRef(new Animated.Value(-300)).current
  const ballSpin = useRef(new Animated.Value(0)).current
  const confetti = useRef(new Animated.Value(0)).current
  const slideText = useRef(new Animated.Value(40)).current
  const opacityText = useRef(new Animated.Value(0)).current
  const checkerOp = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) return

    let sound: Audio.Sound | null = null

    const playApplause = async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
        const { sound: s } = await Audio.Sound.createAsync(
          require('../../assets/sounds/applause.mp3'),
          { shouldPlay: true, volume: 0.85 },
        )
        sound = s
        s.setOnPlaybackStatusUpdate((st) => {
          if (!st.isLoaded || !st.didJustFinish) return
          s.unloadAsync().catch(() => {})
        })
      } catch {}
    }

    Animated.sequence([
      Animated.timing(checkerOp, { toValue: 0.12, duration: 400, useNativeDriver: true }),

      Animated.parallel([
        Animated.spring(ballY, { toValue: 0, friction: 3, tension: 70, useNativeDriver: true }),
        Animated.timing(ballSpin, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),

      Animated.parallel([
        Animated.timing(confetti, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.parallel([
          Animated.timing(slideText, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.timing(opacityText, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
      ]),

      Animated.delay(1800),
      Animated.timing(fadeOverall, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false)
      sound?.unloadAsync().catch(() => {})
    })

    // Play applause when ball lands (after checkerboard + ball spring)
    const applauseTimer = setTimeout(playApplause, 500)

    return () => {
      clearTimeout(applauseTimer)
      sound?.unloadAsync().catch(() => {})
    }
  }, [visible, fadeOverall, ballY, ballSpin, confetti, slideText, opacityText, checkerOp])

  if (!visible) return null

  const spin = ballSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '540deg'],
  })

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeOverall }]} pointerEvents="none">
      <Checkerboard opacity={checkerOp} />

      <View style={styles.center}>
        <ConfettiStars progress={confetti} />
        <Animated.Text
          style={[
            styles.ball,
            { transform: [{ translateY: ballY }, { rotate: spin }] },
          ]}
        >
          ⚽
        </Animated.Text>
      </View>

      <Animated.View style={{ transform: [{ translateY: slideText }], opacity: opacityText }}>
        <Text style={styles.title}>Idemo Hrvatska!</Text>
        <Text style={styles.subtitle}>FIFA World Cup 2026</Text>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: '#050816',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  checkerWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
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
  ball: {
    fontSize: 52,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
})
