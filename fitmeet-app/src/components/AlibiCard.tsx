import { useEffect, useRef, useState } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { api } from '@/src/lib/api'
import { palette, spacing } from '@/src/theme'

interface Stats {
  events_created: number
  events_joined:  number
  check_ins:      number
  comments:       number
  moments:        number
  beers:          number
}

const ROWS: {
  key:   keyof Stats
  label: string
  emoji: string
  color: string
}[] = [
  { key: 'events_created', label: 'Events created', emoji: '🗓',  color: '#39ff14' },
  { key: 'events_joined',  label: 'Events joined',  emoji: '🏃',  color: '#00a8ff' },
  { key: 'check_ins',      label: 'Check-ins',      emoji: '✅',  color: '#fbbf24' },
  { key: 'comments',       label: 'Comments',        emoji: '💬',  color: '#a78bfa' },
  { key: 'moments',        label: 'Moments',         emoji: '📸',  color: '#fb923c' },
  { key: 'beers',          label: 'Beers bought',   emoji: '🍺',  color: '#f59e0b' },
]

function AnimatedBar({ pct, color }: { pct: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 700,
      delay: 100,
      useNativeDriver: false,
    }).start()
  }, [anim, pct])

  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] })

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width, backgroundColor: color }]} />
    </View>
  )
}

export function AlibiCard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    api.get('/me/stats').then(({ data }) => setStats(data)).catch(() => {})
  }, [])

  const maxVal = stats
    ? Math.max(1, ...Object.values(stats))
    : 1

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.icon}>🕵️</Text>
        <View>
          <Text style={styles.title}>Your Alibi</Text>
          <Text style={styles.subtitle}>Proof you actually went outside</Text>
        </View>
      </View>

      <View style={styles.rows}>
        {ROWS.map(({ key, label, emoji, color }) => {
          const val = stats?.[key] ?? 0
          const pct = (val / maxVal) * 100
          return (
            <View key={key} style={styles.row}>
              <Text style={styles.emoji}>{emoji}</Text>
              <View style={styles.barWrap}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>{label}</Text>
                  <Text style={[styles.value, { color }]}>{val}</Text>
                </View>
                <AnimatedBar pct={pct} color={color} />
              </View>
            </View>
          )
        })}
      </View>

    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.panel,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(57,255,20,0.2)',
    padding: spacing.md,
    gap: spacing.md,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon:     { fontSize: 28 },
  title:    { color: palette.text, fontSize: 16, fontWeight: '800' },
  subtitle: { color: palette.textDim, fontSize: 11, marginTop: 1 },

  rows: { gap: 14 },
  row:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emoji: { fontSize: 16, width: 22, textAlign: 'center' },

  barWrap:  { flex: 1, gap: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label:    { color: palette.textMuted, fontSize: 12, fontWeight: '600' },
  value:    { fontSize: 13, fontWeight: '800' },

  track: {
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
})
