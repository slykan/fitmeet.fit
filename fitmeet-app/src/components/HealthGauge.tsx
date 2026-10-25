import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg'

import { palette, spacing } from '@/src/theme'

export interface EnergyDay {
  bmr: number
  steps: number
  training: number
  food: number
  total: number
  trainings: number
  estimated: boolean
  intake?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  water_ml?: number
  logged_days?: number
}

const W = 260
const H = 150
const CX = W / 2
const CY = 132
const R = 108
const STROKE = 18

// angle 0 = left end of the half circle, 1 = right end
const point = (share: number, r: number) => {
  const a = Math.PI * (1 - share)
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) }
}
const arc = (from: number, to: number, r: number) => {
  const a = point(from, r)
  const b = point(to, r)
  return `M ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y}`
}
const fmt = (n: number) => Math.round(n).toLocaleString('en-US').replace(/,/g, ' ')

/**
 * Half-circle gauge: colour scale up to ~2.2 × BMR, white needle = BMR (basal),
 * green needle = estimated total burn (BMR + steps + trainings + food), Today / 7-day average.
 */
export function HealthGauge({ today, week, todayLabel = 'Today', avgSteps }: { today: EnergyDay; week: EnergyDay; todayLabel?: string; avgSteps?: number | null }) {
  const [mode, setMode] = useState<'today' | 'week'>('today')
  const d = mode === 'today' ? today : week
  const intake = d.intake ?? 0
  const max = Math.max(Math.ceil((d.bmr * 2.2) / 500) * 500, Math.ceil((Math.max(d.total, intake) * 1.1) / 500) * 500)
  const share = (v: number) => Math.min(1, Math.max(0, v / max))

  const needle = (v: number, color: string, len: number, width: number) => {
    const p = point(share(v), len)
    return <Line x1={CX} y1={CY} x2={p.x} y2={p.y} stroke={color} strokeWidth={width} strokeLinecap="round" />
  }
  const above = d.total - d.bmr

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="flame" size={18} color="#ffaa00" />
        <Text style={styles.title}>Energy</Text>
        <View style={{ flex: 1 }} />
        <View style={styles.toggle}>
          {(['today', 'week'] as const).map(m => (
            <Pressable key={m} style={[styles.toggleItem, mode === m && styles.toggleOn]} onPress={() => setMode(m)}>
              <Text style={[styles.toggleText, mode === m && styles.toggleTextOn]}>{m === 'today' ? todayLabel : '7 days'}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.gaugeWrap}>
        <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          <Defs>
            <LinearGradient id="scale" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#3399ff" />
              <Stop offset="0.38" stopColor="#6cff2f" />
              <Stop offset="0.68" stopColor="#ffd60a" />
              <Stop offset="0.86" stopColor="#ffaa00" />
              <Stop offset="1" stopColor="#ff3b30" />
            </LinearGradient>
          </Defs>
          <Path d={arc(0, 1, R)} stroke={palette.line} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
          <Path d={arc(0, share(d.total), R)} stroke="url(#scale)" strokeWidth={STROKE} fill="none" strokeLinecap="round" />
          {/* inner thin arc = eaten (food log) */}
          {intake > 0 && <Path d={arc(0, 1, R - 26)} stroke="rgba(255,255,255,0.06)" strokeWidth={6} fill="none" strokeLinecap="round" />}
          {intake > 0 && <Path d={arc(0, share(intake), R - 26)} stroke="#ff9f43" strokeWidth={6} fill="none" strokeLinecap="round" />}
          {/* BMR tick on the ring */}
          <G>
            <Line x1={point(share(d.bmr), R - STROKE / 2 - 3).x} y1={point(share(d.bmr), R - STROKE / 2 - 3).y}
              x2={point(share(d.bmr), R + STROKE / 2 + 3).x} y2={point(share(d.bmr), R + STROKE / 2 + 3).y}
              stroke="#ffffff" strokeWidth={3} strokeLinecap="round" />
          </G>
          {needle(d.bmr, 'rgba(255,255,255,0.75)', R - 34, 3)}
          {needle(d.total, palette.accent, R - 16, 4)}
          <Circle cx={CX} cy={CY} r={8} fill={palette.panelRaised} stroke={palette.accent} strokeWidth={2} />
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.total}>{fmt(d.total)}</Text>
          <Text style={styles.totalLabel}>kcal {mode === 'today' ? 'today' : 'per day'}</Text>
        </View>
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#ffffff' }]} />
          <Text style={styles.legendLabel}>BMR</Text>
          <Text style={styles.legendValue}>{fmt(d.bmr)}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: palette.accent }]} />
          <Text style={styles.legendLabel}>Burned</Text>
          <Text style={styles.legendValue}>{fmt(d.total)}</Text>
        </View>
        {intake > 0 ? (
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#ff9f43' }]} />
            <Text style={styles.legendLabel}>Eaten</Text>
            <Text style={styles.legendValue}>{fmt(intake)}</Text>
          </View>
        ) : (
          <View style={styles.legendItem}>
            <Text style={[styles.legendLabel, { color: palette.accent }]}>+{fmt(above)}</Text>
            <Text style={styles.legendLabel}>above BMR</Text>
          </View>
        )}
      </View>

      <View style={styles.parts}>
        <Part icon="bed-outline" label="Basal" value={d.bmr} />
        <Part icon="footsteps-outline" label={avgSteps ? `Steps (${fmt(avgSteps)}/day)` : 'Steps (not set)'} value={d.steps} />
        <Part icon="barbell-outline" label={mode === 'today' ? `Training${d.trainings === 1 ? '' : 's'} (${d.trainings})` : 'Training'} value={d.training} />
        <Part icon="restaurant-outline" label="Digestion" value={d.food} />
      </View>
      {intake > 0 && (
        <Text style={[styles.balance, { color: intake > d.total ? '#ff9f43' : palette.accent }]}>
          {intake > d.total ? `+${fmt(intake - d.total)} kcal surplus` : `−${fmt(d.total - intake)} kcal deficit`}
          {mode === 'week' && d.logged_days ? `  ·  avg of ${d.logged_days} logged day${d.logged_days === 1 ? '' : 's'}` : ''}
        </Text>
      )}
      {d.estimated && <Text style={styles.note}>Some trainings had no calories — estimated from heart rate or duration.</Text>}
    </View>
  )
}

function Part({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number }) {
  return (
    <View style={styles.part}>
      <Ionicons name={icon} size={14} color={palette.textDim} />
      <Text style={styles.partLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.partValue}>{fmt(value)} <Text style={styles.partUnit}>kcal</Text></Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(108,255,47,0.07)', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(108,255,47,0.28)', padding: spacing.md, gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: palette.text, fontSize: 16, fontWeight: '800' },
  toggle: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: palette.panelRaised },
  toggleItem: { paddingHorizontal: 12, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  toggleOn: { backgroundColor: palette.accent },
  toggleText: { color: palette.textMuted, fontSize: 12, fontWeight: '800' },
  toggleTextOn: { color: '#041109' },
  gaugeWrap: { alignItems: 'center', justifyContent: 'flex-end' },
  center: { position: 'absolute', bottom: 34, alignItems: 'center' },
  total: { color: palette.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  totalLabel: { color: palette.textDim, fontSize: 11, marginTop: -2 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: -4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: palette.textDim, fontSize: 11 },
  legendValue: { color: palette.text, fontSize: 12, fontWeight: '800' },
  parts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, borderTopWidth: 1, borderTopColor: 'rgba(108,255,47,0.18)', paddingTop: 10 },
  part: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8 },
  partLabel: { flex: 1, color: palette.textMuted, fontSize: 12 },
  partUnit: { color: palette.textDim, fontSize: 10, fontWeight: '600' },
  partValue: { color: palette.text, fontSize: 13, fontWeight: '800' },
  note: { color: palette.textDim, fontSize: 10 },
  balance: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
})
