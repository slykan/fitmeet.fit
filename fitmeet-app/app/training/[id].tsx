import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { TrainingCharts, type ChartSeries } from '@/src/components/TrainingCharts'
import { TrainingCoachCard } from '@/src/components/TrainingCoachCard'
import { api } from '@/src/lib/api'
import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'

// ─── Types (GET /trainings/{id}/details — owner only) ─────────────────────────

interface Training {
  id: number
  provider: string
  category: { value: string; label: string }
  name: string | null
  started_at: string
  duration_s: number | null
  distance_m: number | null
  elevation_gain: number | null
  avg_heartrate: number | null
  max_heartrate: number | null
  avg_watts: number | null
  max_watts: number | null
  avg_cadence: number | null
  calories: number | null
  avg_speed_mps: number | null
  max_speed_mps: number | null
  kilojoules: number | null
  gear_name: string | null
  description: string | null
}

interface Split { split: number; distance: number; moving_time: number; elevation_difference?: number; average_speed: number; average_heartrate?: number }
interface Lap { lap_index: number; name?: string; distance: number; moving_time: number; average_speed: number; average_heartrate?: number; average_watts?: number }
interface Effort { name: string; distance: number; moving_time: number; pr_rank?: number | null }

interface Details {
  device_name?: string
  trainer?: boolean
  weighted_average_watts?: number
  average_temp?: number
  elev_high?: number
  elev_low?: number
  perceived_exertion?: number | null
  splits_metric?: Split[]
  laps?: Lap[]
  best_efforts?: Effort[]
}

interface Streams {
  points: number
  time?: number[]
  distance?: number[]
  altitude?: number[]
  velocity_smooth?: number[]
  heartrate?: number[]
  cadence?: number[]
  watts?: number[]
}

interface Response {
  training: Training
  details: Details | null
  streams: Streams | null
  complete: boolean
  has_source: boolean
}

// ─── Formatting ───────────────────────────────────────────────────────────────

const PACE_SPORTS = ['running', 'walking', 'hiking']

function fmtDuration(s: number | null | undefined): string {
  if (!s) return '–'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(sec).padStart(2, '0')}`
}

function fmtPace(mps: number | null | undefined): string {
  if (!mps || mps <= 0) return '–'
  const s = 1000 / mps
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')} /km`
}

function fmtSpeed(mps: number | null | undefined): string {
  return mps ? `${(mps * 3.6).toFixed(1)} km/h` : '–'
}

function fmtKm(m: number | null | undefined): string {
  return m ? `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km` : '–'
}

// Heart-rate zones as % of max HR (220 − age, or the highest HR seen if no birth date).
const ZONES = [
  { name: 'Z1 Recovery', from: 0.5, color: '#8f9bbd' },
  { name: 'Z2 Endurance', from: 0.6, color: '#3399ff' },
  { name: 'Z3 Tempo', from: 0.7, color: '#6cff2f' },
  { name: 'Z4 Threshold', from: 0.8, color: '#ffaa00' },
  { name: 'Z5 Max', from: 0.9, color: '#ff3b30' },
]

function hrZones(hr: number[], time: number[] | undefined, maxHr: number) {
  const secs = ZONES.map(() => 0)
  for (let i = 0; i < hr.length; i++) {
    const dt = time && i > 0 ? Math.max(0, time[i] - time[i - 1]) : 1
    const pct = hr[i] / maxHr
    if (pct < ZONES[0].from) continue
    let z = 0
    for (let k = ZONES.length - 1; k >= 0; k--) if (pct >= ZONES[k].from) { z = k; break }
    secs[z] += dt
  }
  const total = secs.reduce((a, b) => a + b, 0) || 1
  return ZONES.map((zone, i) => ({ ...zone, secs: secs[i], share: secs[i] / total }))
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TrainingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const me = useAuthStore(s => s.user)
  const [data, setData] = useState<Response | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.get(`/trainings/${id}/details`)
      .then(({ data }) => setData(data))
      .catch(() => setError('Could not load this training.'))
  }, [id])

  const t = data?.training
  const d = data?.details
  const s = data?.streams
  const usePace = !!t && PACE_SPORTS.includes(t.category.value)

  const chart = useMemo(() => {
    if (!s || !s.time || s.time.length < 2) return null
    const byDistance = !!s.distance && (s.distance[s.distance.length - 1] ?? 0) > 500
    const x = byDistance ? s.distance!.map(m => m / 1000) : s.time.map(sec => sec / 60)
    const series: ChartSeries[] = []
    const fmts: string[] = []
    const has = (a?: number[]) => !!a && a.some(v => v > 0)
    if (has(s.heartrate)) {
      series.push({ key: 'hr', label: 'Heart rate', unit: 'bpm', color: '#ff3b30', values: s.heartrate! })
      fmts.push("function(v){return Math.round(v)+' bpm'}")
    }
    if (has(s.velocity_smooth)) {
      if (usePace) {
        series.push({ key: 'pace', label: 'Pace', unit: '/km', color: '#6cff2f', invert: true,
          values: s.velocity_smooth!.map(v => (v > 0.5 ? 1000 / v : null)) })
        fmts.push("function(v){var m=Math.floor(v/60),s=Math.round(v%60);return m+':'+(s<10?'0':'')+s}")
      } else {
        series.push({ key: 'speed', label: 'Speed', unit: 'km/h', color: '#6cff2f', values: s.velocity_smooth!.map(v => v * 3.6) })
        fmts.push("function(v){return v.toFixed(1)+' km/h'}")
      }
    }
    if (has(s.altitude) && !d?.trainer) {
      series.push({ key: 'alt', label: 'Elevation', unit: 'm', color: '#3399ff', values: s.altitude!, smooth: false })
      fmts.push("function(v){return Math.round(v)+' m'}")
    }
    if (has(s.watts)) {
      series.push({ key: 'watts', label: 'Power', unit: 'W', color: '#ffaa00', values: s.watts! })
      fmts.push("function(v){return Math.round(v)+' W'}")
    }
    if (has(s.cadence)) {
      series.push({ key: 'cad', label: 'Cadence', unit: usePace ? 'spm' : 'rpm', color: '#c084fc', values: s.cadence! })
      fmts.push(`function(v){return Math.round(v)+' ${usePace ? 'spm' : 'rpm'}'}`)
    }
    return { x, xUnit: byDistance ? 'km' : 'min', series, fmts }
  }, [s, d, usePace])

  const zones = useMemo(() => {
    if (!s?.heartrate?.some(v => v > 0)) return null
    const age = me?.birth_date ? new Date().getFullYear() - new Date(me.birth_date).getFullYear() : null
    const maxHr = age ? 220 - age : Math.max(...s.heartrate)
    return { maxHr, rows: hrZones(s.heartrate, s.time, maxHr), byAge: !!age }
  }, [s, me?.birth_date])

  if (error) return <Center><Text style={styles.muted}>{error}</Text></Center>
  if (!t) return <Center><ActivityIndicator color={palette.accent} /></Center>

  const stats: [string, string][] = [
    ['Distance', fmtKm(t.distance_m)],
    ['Moving time', fmtDuration(t.duration_s)],
    [usePace ? 'Avg pace' : 'Avg speed', usePace ? fmtPace(t.avg_speed_mps) : fmtSpeed(t.avg_speed_mps)],
    [usePace ? 'Best pace' : 'Max speed', usePace ? fmtPace(t.max_speed_mps) : fmtSpeed(t.max_speed_mps)],
    ['Elevation', t.elevation_gain ? `${Math.round(t.elevation_gain)} m` : '–'],
    ['Heart rate', t.avg_heartrate ? `${Math.round(t.avg_heartrate)} / ${Math.round(t.max_heartrate ?? 0)} bpm` : '–'],
    ['Power', t.avg_watts ? `${Math.round(t.avg_watts)} W${d?.weighted_average_watts ? ` (NP ${Math.round(d.weighted_average_watts)})` : ''}` : '–'],
    ['Cadence', t.avg_cadence ? `${Math.round(t.avg_cadence)}` : '–'],
    ['Calories', t.calories ? `${Math.round(t.calories)} kcal` : '–'],
    ['Energy', t.kilojoules ? `${Math.round(t.kilojoules)} kJ` : '–'],
  ].filter(([, v]) => v !== '–') as [string, string][]

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={palette.text} />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>{t.name ?? t.category.label}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.meta}>
          {t.category.label} · {new Date(t.started_at).toLocaleString()}
          {d?.device_name ? ` · ${d.device_name}` : ''}{t.gear_name ? ` · ${t.gear_name}` : ''}
        </Text>
        {t.description ? <Text style={styles.description}>{t.description}</Text> : null}

        <View style={styles.grid}>
          {stats.map(([label, value]) => (
            <View key={label} style={styles.stat}>
              <Text style={styles.statValue}>{value}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <TrainingCoachCard trainingId={t.id} />

        {!data.has_source ? (
          <Note text="Charts and splits come from Strava. This training was recorded only on HUAWEI Health." />
        ) : !data.complete && !chart ? (
          <Note text="Charts are still being imported from Strava — check back in a little while." />
        ) : null}

        {chart && chart.series.length > 0 && (
          <Section title="Charts">
            <TrainingCharts x={chart.x} xUnit={chart.xUnit} series={chart.series} formatters={chart.fmts} />
          </Section>
        )}

        {zones && (
          <Section title="Heart rate zones">
            {zones.rows.map(z => (
              <View key={z.name} style={styles.zoneRow}>
                <Text style={styles.zoneName}>{z.name}</Text>
                <View style={styles.zoneBarBg}>
                  <View style={[styles.zoneBar, { width: `${Math.round(z.share * 100)}%`, backgroundColor: z.color }]} />
                </View>
                <Text style={styles.zoneTime}>{fmtDuration(z.secs)}</Text>
              </View>
            ))}
            <Text style={styles.small}>
              Max HR {zones.maxHr} bpm {zones.byAge ? '(220 − age)' : '(highest in this training — add your birth date in Settings for better zones)'}
            </Text>
          </Section>
        )}

        {!!d?.splits_metric?.length && (
          <Section title="Splits">
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.colKm]}>km</Text>
              <Text style={[styles.th, styles.colMain]}>{usePace ? 'Pace' : 'Speed'}</Text>
              <Text style={[styles.th, styles.colSmall]}>HR</Text>
              <Text style={[styles.th, styles.colSmall]}>Elev</Text>
            </View>
            {d.splits_metric.map(sp => (
              <View key={sp.split} style={styles.tr}>
                <Text style={[styles.td, styles.colKm]}>{sp.distance < 950 ? (sp.distance / 1000).toFixed(1) : sp.split}</Text>
                <Text style={[styles.td, styles.colMain]}>{usePace ? fmtPace(sp.average_speed) : fmtSpeed(sp.average_speed)}</Text>
                <Text style={[styles.td, styles.colSmall]}>{sp.average_heartrate ? Math.round(sp.average_heartrate) : '–'}</Text>
                <Text style={[styles.td, styles.colSmall]}>{sp.elevation_difference != null ? `${sp.elevation_difference > 0 ? '+' : ''}${Math.round(sp.elevation_difference)}` : '–'}</Text>
              </View>
            ))}
          </Section>
        )}

        {!!d?.best_efforts?.length && (
          <Section title="Best efforts">
            {d.best_efforts.map(e => (
              <View key={e.name} style={styles.tr}>
                <Text style={[styles.td, { flex: 1 }]}>{e.name}{e.pr_rank === 1 ? '  🏆 PR' : ''}</Text>
                <Text style={styles.td}>{fmtDuration(e.moving_time)}</Text>
              </View>
            ))}
          </Section>
        )}

        {(d?.laps?.length ?? 0) > 1 && (
          <Section title="Laps">
            {d!.laps!.map(l => (
              <View key={l.lap_index} style={styles.tr}>
                <Text style={[styles.td, styles.colKm]}>{l.lap_index}</Text>
                <Text style={[styles.td, styles.colMain]}>{fmtKm(l.distance)} · {fmtDuration(l.moving_time)}</Text>
                <Text style={[styles.td, styles.colSmall]}>{usePace ? fmtPace(l.average_speed) : fmtSpeed(l.average_speed)}</Text>
              </View>
            ))}
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return <SafeAreaView style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]}>{children}</SafeAreaView>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

function Note({ text }: { text: string }) {
  return (
    <View style={styles.note}>
      <Ionicons name="information-circle-outline" size={16} color={palette.textDim} />
      <Text style={styles.noteText}>{text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.panel },
  topTitle: { flex: 1, color: palette.text, fontSize: 18, fontWeight: '800' },
  content: { padding: spacing.md, paddingBottom: 48, gap: spacing.md },
  meta: { color: palette.textDim, fontSize: 12 },
  description: { color: palette.textMuted, fontSize: 14, lineHeight: 20 },
  muted: { color: palette.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    width: '48%', flexGrow: 1, padding: 12, borderRadius: 14,
    backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line,
  },
  statValue: { color: palette.text, fontSize: 17, fontWeight: '800' },
  statLabel: { color: palette.textDim, fontSize: 11, marginTop: 2 },
  section: {
    padding: 14, borderRadius: 16, backgroundColor: palette.panel,
    borderWidth: 1, borderColor: palette.line, gap: 8,
  },
  sectionTitle: { color: palette.text, fontSize: 15, fontWeight: '800', marginBottom: 2 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 12, borderRadius: 12, backgroundColor: palette.panelRaised },
  noteText: { flex: 1, color: palette.textMuted, fontSize: 12, lineHeight: 17 },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoneName: { width: 98, color: palette.textMuted, fontSize: 12 },
  zoneBarBg: { flex: 1, height: 10, borderRadius: 5, backgroundColor: palette.line, overflow: 'hidden' },
  zoneBar: { height: 10, borderRadius: 5 },
  zoneTime: { width: 58, textAlign: 'right', color: palette.text, fontSize: 12, fontWeight: '700' },
  small: { color: palette.textDim, fontSize: 11, marginTop: 4 },
  tableHead: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: palette.line },
  th: { color: palette.textDim, fontSize: 11, fontWeight: '700' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  td: { color: palette.text, fontSize: 13 },
  colKm: { width: 40 },
  colMain: { flex: 1 },
  colSmall: { width: 64, textAlign: 'right' },
})
