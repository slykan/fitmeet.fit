import { useEffect, useRef, useState } from 'react'
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native'

const { width: W, height: H } = Dimensions.get('window')

const START = new Date('2026-06-11T00:00:00Z').getTime()
const END = new Date('2026-07-20T00:00:00Z').getTime()

const CHECKER_ROWS = 6
const CHECKER_COLS = 7
const CELL = Math.ceil(W / CHECKER_COLS)

function Checkerboard({ opacity }: { opacity: Animated.Value }) {
  const rows = []
  for (let r = 0; r < CHECKER_ROWS; r++) {
    const cells = []
    for (let c = 0; c < CHECKER_COLS; c++) {
      const isRed = (r + c) % 2 === 0
      cells.push(
        <View
          key={c}
          style={{
            width: CELL,
            height: CELL,
            backgroundColor: isRed ? '#FF0000' : '#FFFFFF',
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

export function WorldCupOverlay() {
  const [visible, setVisible] = useState(() => {
    const now = Date.now()
    return now >= START && now <= END
  })

  const fadeOverall = useRef(new Animated.Value(1)).current
  const scaleFlag = useRef(new Animated.Value(0.3)).current
  const opacityFlag = useRef(new Animated.Value(0)).current
  const scaleBall = useRef(new Animated.Value(0)).current
  const slideText = useRef(new Animated.Value(40)).current
  const opacityText = useRef(new Animated.Value(0)).current
  const checkerOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) return

    Animated.sequence([
      Animated.parallel([
        Animated.timing(checkerOpacity, { toValue: 0.12, duration: 400, useNativeDriver: true }),
        Animated.spring(scaleFlag, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        Animated.timing(opacityFlag, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.spring(scaleBall, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }),
      Animated.parallel([
        Animated.timing(slideText, { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.timing(opacityText, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]),
      Animated.delay(1600),
      Animated.timing(fadeOverall, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => setVisible(false))
  }, [visible, checkerOpacity, fadeOverall, opacityFlag, opacityText, scaleBall, scaleFlag, slideText])

  if (!visible) return null

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeOverall }]} pointerEvents="none">
      <Checkerboard opacity={checkerOpacity} />

      <Animated.Text
        style={[
          styles.flag,
          { transform: [{ scale: scaleFlag }], opacity: opacityFlag },
        ]}
      >
        🇭🇷
      </Animated.Text>

      <Animated.Text style={[styles.ball, { transform: [{ scale: scaleBall }] }]}>
        ⚽
      </Animated.Text>

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
  flag: {
    fontSize: 72,
  },
  ball: {
    fontSize: 36,
    marginTop: -4,
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
