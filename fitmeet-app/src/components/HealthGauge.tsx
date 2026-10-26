import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg'

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

const W = 290
const H = 168
const CX = W / 2
const CY = 150
const R = 120
const STROKE = 12

// share 0 = left end of the half circle, 1 = right end
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
 * Energy gauge (look of HUAWEI Health): scale with kcal ticks, two short needles on the ring —
 * white = BMR, green = estimated total burned — burned in the middle, burned vs eaten below.
 * Today (or the chosen day) / 7-day average.
 */
export function HealthGauge({ today, week, todayLabel = 'Today' }: { today: EnergyDay; week: EnergyDay; todayLabel?: string; avgSteps?: number | null }) {
  const [mode, setMode] = useState<'today' | 'week'>('today')
  const d = mode === 'today' ? today : week
  const intake = d.intake ?? 0
  const max = Math.max(Math.ceil((d.bmr * 2) / 500) * 500, Math.ceil((Math.max(d.total, intake) * 1.1) / 500) * 500)
  const share = (v: number) => Math.min(1, Math.max(0, v / max))
  const major = max > 4000 ? 1000 : 500
  const p = useSweep(`${mode}-${d.bmr}-${d.total}-${intake}`)

  const ticks = []
  for (let v = 0; v <= max; v += 100) {
    const isMajor = v % major === 0
    const a = point(share(v), R - STROKE / 2 - 4)
    const b = point(share(v), R - STROKE / 2 - (isMajor ? 11 : 7))
    ticks.push(<Line key={`t${v}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={isMajor ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.18)'} strokeWidth={isMajor ? 1.5 : 1} />)
    if (isMajor && v > 0 && v < max) {
      const t = point(share(v), R - STROKE / 2 - 22)
      ticks.push(<SvgText key={`l${v}`} x={t.x} y={t.y + 3} fill="rgba(255,255,255,0.45)" fontSize={9} textAnchor="middle">{v >= 1000 ? `${v / 1000}k` : String(v)}</SvgText>)
    }
  }

  // short needle across the ring
  const needle = (v: number, color: string, width: number, key: string) => {
    const a = point(share(v), R - STROKE / 2 - 6)
    const b = point(share(v), R + STROKE / 2 + 6)
    // dark outline first so the needle stands out on any part of the coloured ring
    return (
      <G key={key}>
        <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={palette.panel} strokeWidth={width + 3} strokeLinecap="round" />
        <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={width} strokeLinecap="round" />
      </G>
    )
  }

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
              <Stop offset="0" stopColor="#ff4d4f" />
              <Stop offset="0.3" stopColor="#ff9f43" />
              <Stop offset="0.55" stopColor="#ffd60a" />
              <Stop offset="1" stopColor="#3ddc68" />
            </LinearGradient>
          </Defs>
          <Circle cx={CX} cy={CY} r={R - 44} fill="rgba(255,255,255,0.035)" />
          <Path d={arc(0, 1, R)} stroke="url(#scale)" strokeWidth={STROKE} fill="none" strokeLinecap="round" />
          <G>{ticks}</G>
          {intake > 0 && needle(intake * p, '#ff9f43', 4, 'eaten')}
          {needle(d.bmr * p, '#ffffff', 3, 'bmr')}
          {needle(d.total * p, palette.accent, 4, 'total')}
          <SvgText x={CX} y={CY - 56} fill={palette.textDim} fontSize={11} textAnchor="middle">
            {mode === 'today' ? (todayLabel === 'Today' ? 'Burned today' : 'Burned') : 'Burned per day'}
          </SvgText>
          <SvgText x={CX} y={CY - 18} fill={palette.text} fontSize={38} fontWeight="900" textAnchor="middle">{fmt(d.total)}</SvgText>
          <SvgText x={CX} y={CY - 2} fill={palette.textDim} fontSize={11} textAnchor="middle">kcal</SvgText>
        </Svg>
      </View>

      {/* first row right under the gauge: basal (white needle) · burned (green needle) · eaten */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#ffffff' }]} />
          <Text style={styles.legendLabel}>Basal</Text>
          <Text style={styles.legendValue}>{fmt(d.bmr)}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: palette.accent }]} />
          <Text style={styles.legendLabel}>Burned</Text>
          <Text style={styles.legendValue}>{fmt(d.total)}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: '#ff9f43' }]} />
          <Text style={styles.legendLabel}>Eaten</Text>
          <Text style={styles.legendValue}>{fmt(intake)}</Text>
        </View>
      </View>
      {intake > 0 && (
        <Text style={[styles.balance, { color: intake > d.total ? '#ff9f43' : palette.accent }]}>
          {intake > d.total ? `+${fmt(intake - d.total)} kcal surplus` : `−${fmt(d.total - intake)} kcal deficit`}
        </Text>
      )}

      <View style={styles.trainingRow}>
        <Ionicons name="barbell-outline" size={15} color={palette.textDim} />
        <Text style={styles.trainingLabel}>
          {mode === 'today' ? `Training${d.trainings === 1 ? '' : 's'} (${d.trainings})` : `Training (avg ${d.trainings}/day)`}
        </Text>
        <Text style={styles.trainingValue}>{fmt(d.training)} <Text style={styles.statUnit}>kcal</Text></Text>
      </View>
      {mode === 'week' && intake > 0 && d.logged_days ? <Text style={styles.note}>Eaten = average of {d.logged_days} logged day{d.logged_days === 1 ? '' : 's'}.</Text> : null}
      {d.estimated && <Text style={styles.note}>Some trainings had no calories — estimated from heart rate or duration.</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.panel, borderRadius: 22,
    borderWidth: 1, borderColor: palette.line, padding: spacing.md, gap: 12,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: palette.text, fontSize: 16, fontWeight: '800' },
  toggle: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: palette.panelRaised },
  toggleItem: { paddingHorizontal: 12, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  toggleOn: { backgroundColor: palette.accent },
  toggleText: { color: palette.textMuted, fontSize: 12, fontWeight: '800' },
  toggleTextOn: { color: '#041109' },
  gaugeWrap: { alignItems: 'center', marginBottom: -6 },
  legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 18 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: palette.textDim, fontSize: 12 },
  legendValue: { color: palette.text, fontSize: 13, fontWeight: '800' },
  balance: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  statUnit: { color: palette.textDim, fontSize: 12, fontWeight: '600' },
  trainingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: palette.line, paddingTop: 10 },
  trainingLabel: { flex: 1, color: palette.textMuted, fontSize: 13 },
  trainingValue: { color: palette.text, fontSize: 14, fontWeight: '800' },
  note: { color: palette.textDim, fontSize: 10 },
})

/** 0 → 1 over ~1.1 s (ease-out) whenever key changes: needles sweep from 0 to their place. Instant with Reduce Motion. */
function useSweep(key: string): number {
  const [p, setP] = useState(0)
  useEffect(() => {
    let raf = 0
    let cancelled = false
    setP(0)
    AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      if (cancelled) return
      if (reduce) return setP(1)
      const start = Date.now()
      const tick = () => {
        const t = Math.min(1, (Date.now() - start) / 1100)
        setP(1 - Math.pow(1 - t, 3))
        if (t < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }).catch(() => setP(1))
    return () => { cancelled = true; cancelAnimationFrame(raf) }
  }, [key])
  return p
}
