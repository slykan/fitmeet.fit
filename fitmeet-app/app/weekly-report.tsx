import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { api } from '@/src/lib/api'
import { palette, spacing } from '@/src/theme'

// ─── Types (GET /reports/weekly) ──────────────────────────────────────────────

interface Day { date: string; minutes: number; by_sport: Record<string, number> }
interface Sport { sport: string; label: string; trainings: number; minutes: number; km: number }
interface WeekTraining { id: number; date: string; sport: string; name?: string; km?: number; min?: number; hr?: number }
interface Stats {
  period: { start: string; end: string }
  totals: { trainings: number; hours: number; km: number; elevation_m: number; calories: number; active_days: number }
  previous_4_weeks_avg: { trainings: number; hours: number; km: number }
  days: Day[]
  sports: Sport[]
  hr_zones_minutes: Record<string, number> | null
  personal_records: { name: string; time: string; training_id: number }[]
  trainings: WeekTraining[]
}
interface Report {
  headline: string
  summary: string
  plan: string[]
  questions: string[]
  answers: { question: string; answer: string }[]
  stale: boolean
}
interface Payload { available: boolean; stats: Stats; report: Report | null; quota: { analyses_left: number; questions_left: number } }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SPORT_COLOR: Record<string, string> = {
  cycling: '#ffaa00', running: '#6cff2f', walking: '#3399ff', hiking: '#2dd4bf',
  fitness: '#c084fc', swimming: '#38bdf8', kayaking: '#22d3ee', yoga: '#f472b6',
  skiing: '#e2e8f0', football: '#a3e635', other: '#8f9bbd',
}
const sportColor = (s: string) => SPORT_COLOR[s] ?? '#8f9bbd'

const ZONES = [
  { key: 'Z1', name: 'Z1 Recovery', color: '#8f9bbd' },
  { key: 'Z2', name: 'Z2 Endurance', color: '#3399ff' },
  { key: 'Z3', name: 'Z3 Tempo', color: '#6cff2f' },
  { key: 'Z4', name: 'Z4 Threshold', color: '#ffaa00' },
  { key: 'Z5', name: 'Z5 Max', color: '#ff3b30' },
]

function phoneLanguage(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().locale || 'en' } catch { return 'en' }
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

function delta(now: number, before: number): { text: string; up: boolean } | null {
  if (!before) return null
  const pct = Math.round(((now - before) / before) * 100)
  return { text: `${pct > 0 ? '+' : ''}${pct}%`, up: pct >= 0 }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WeeklyReportScreen() {
  const [data, setData] = useState<Payload | null>(null)
  const [busy, setBusy] = useState<'write' | 'ask' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [question, setQuestion] = useState('')

  useEffect(() => {
    api.get('/reports/weekly').then(({ data }) => setData(data)).catch(() => setError('Could not load your week.'))
  }, [])

  async function run(kind: 'write' | 'ask', q?: string) {
    setBusy(kind)
    setError(null)
    try {
      const { data } = kind === 'write'
        ? await api.post('/reports/weekly', { language: phoneLanguage() })
        : await api.post('/reports/weekly/ask', { question: q, language: phoneLanguage() })
      setData(data)
      if (kind === 'ask') setQuestion('')
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'The coach is not reachable right now.')
    } finally {
      setBusy(null)
    }
  }

  if (!data) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        {error ? <Text style={styles.muted}>{error}</Text> : <ActivityIndicator color={palette.accent} />}
      </SafeAreaView>
    )
  }

  const { stats, report } = data
  const maxDay = Math.max(1, ...stats.days.map(d => d.minutes))
  const zoneTotal = stats.hr_zones_minutes ? Object.values(stats.hr_zones_minutes).reduce((a, b) => a + b, 0) : 0
  const asked = new Set(report?.answers.map(a => a.question.toLowerCase()) ?? [])
  const openQuestions = report?.questions.filter(q => !asked.has(q.toLowerCase())) ?? []
  const prev = stats.previous_4_weeks_avg
  const tiles: { label: string; value: string; d: ReturnType<typeof delta> }[] = [
    { label: 'Trainings', value: String(stats.totals.trainings), d: delta(stats.totals.trainings, prev.trainings) },
    { label: 'Time', value: fmtMin(stats.totals.hours * 60), d: delta(stats.totals.hours, prev.hours) },
    { label: 'Distance', value: `${stats.totals.km.toFixed(1)} km`, d: delta(stats.totals.km, prev.km) },
    { label: 'Elevation', value: `${stats.totals.elevation_m} m`, d: null },
  ]

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={palette.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.topTitle}>Weekly report</Text>
          <Text style={styles.period}>
            {new Date(stats.period.start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – {new Date(stats.period.end).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {stats.totals.active_days}/7 active days
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Totals vs the previous 4 weeks */}
        <View style={styles.tiles}>
          {tiles.map(t => (
            <View key={t.label} style={styles.tile}>
              <Text style={styles.tileValue}>{t.value}</Text>
              <View style={styles.tileRow}>
                <Text style={styles.tileLabel}>{t.label}</Text>
                {t.d && (
                  <Text style={[styles.delta, { color: t.d.up ? palette.accent : '#ff8a65' }]}>
                    {t.d.up ? '▲' : '▼'} {t.d.text}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.small}>Arrows compare with your average week over the previous 4 weeks.</Text>

        {/* Chart 1: minutes per day, stacked by sport */}
        <Section title="Your week">
          <View style={styles.bars}>
            {stats.days.map(d => (
              <View key={d.date} style={styles.barCol}>
                <Text style={styles.barValue}>{d.minutes ? fmtMin(d.minutes) : ''}</Text>
                <View style={styles.barTrack}>
                  {Object.entries(d.by_sport).map(([sport, min]) => (
                    <View key={sport} style={{ height: `${(min / maxDay) * 100}%`, backgroundColor: sportColor(sport), borderRadius: 4, marginTop: 2 }} />
                  ))}
                  {d.minutes === 0 && <View style={styles.restDot} />}
                </View>
                <Text style={styles.barDay}>{new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.legend}>
            {stats.sports.map(s => (
              <View key={s.sport} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: sportColor(s.sport) }]} />
                <Text style={styles.legendText}>{s.label} · {fmtMin(s.minutes)}</Text>
              </View>
            ))}
          </View>
        </Section>

        {/* Chart 2: intensity (HR zones over the week) */}
        {stats.hr_zones_minutes && zoneTotal > 0 && (
          <Section title="Intensity">
            {ZONES.map(z => {
              const min = stats.hr_zones_minutes?.[z.key] ?? 0
              return (
                <View key={z.key} style={styles.zoneRow}>
                  <Text style={styles.zoneName}>{z.name}</Text>
                  <View style={styles.zoneTrack}>
                    <View style={[styles.zoneBar, { width: `${(min / zoneTotal) * 100}%`, backgroundColor: z.color }]} />
                  </View>
                  <Text style={styles.zoneTime}>{fmtMin(min)}</Text>
                </View>
              )
            })}
            <Text style={styles.small}>From trainings with heart-rate data.</Text>
          </Section>
        )}

        {/* AI coach */}
        {data.available && (
          <View style={styles.coach}>
            <View style={styles.coachHead}>
              <View style={styles.badge}><Ionicons name="sparkles" size={14} color="#041109" /></View>
              <Text style={styles.sectionTitle}>Coach</Text>
            </View>

            {report ? (
              <>
                <Text style={styles.headline}>{report.headline}</Text>
                <Text style={styles.body}>{report.summary}</Text>
                {report.plan.length > 0 && (
                  <View style={styles.plan}>
                    <Text style={styles.planTitle}>Next week</Text>
                    {report.plan.map(p => (
                      <View key={p} style={styles.planRow}>
                        <Ionicons name="checkmark-circle" size={15} color={palette.accent} />
                        <Text style={styles.planText}>{p}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {report.answers.map(a => (
                  <View key={a.question} style={styles.qa}>
                    <Text style={styles.q}>{a.question}</Text>
                    <Text style={styles.body}>{a.answer}</Text>
                  </View>
                ))}
                {openQuestions.map(q => (
                  <Pressable key={q} style={[styles.chip, busy && styles.disabled]} onPress={() => run('ask', q)} disabled={!!busy || data.quota.questions_left <= 0}>
                    <Text style={styles.chipText}>{q}</Text>
                  </Pressable>
                ))}
                <View style={styles.askRow}>
                  <TextInput
                    style={styles.input}
                    value={question}
                    onChangeText={setQuestion}
                    placeholder="Ask the coach about your week…"
                    placeholderTextColor={palette.textDim}
                    maxLength={300}
                    editable={!busy && data.quota.questions_left > 0}
                  />
                  <Pressable style={[styles.sendBtn, (!question.trim() || busy) && styles.disabled]} onPress={() => run('ask', question.trim())} disabled={!question.trim() || !!busy}>
                    {busy === 'ask' ? <ActivityIndicator color="#041109" size="small" /> : <Ionicons name="arrow-up" size={18} color="#041109" />}
                  </Pressable>
                </View>
                {report.stale && (
                  <Pressable style={[styles.secondaryBtn, busy && styles.disabled]} onPress={() => run('write')} disabled={!!busy || data.quota.analyses_left <= 0}>
                    {busy === 'write' ? <ActivityIndicator color={palette.accent} /> : <Text style={styles.secondaryText}>New trainings since — refresh the report</Text>}
                  </Pressable>
                )}
              </>
            ) : (
              <>
                <Text style={styles.muted}>Let the coach go through your last 7 days and plan the next week.</Text>
                <Pressable style={[styles.primaryBtn, busy && styles.disabled]} onPress={() => run('write')} disabled={!!busy || data.quota.analyses_left <= 0}>
                  {busy === 'write' ? <ActivityIndicator color="#041109" /> : <Text style={styles.primaryText}>Write my weekly report</Text>}
                </Pressable>
              </>
            )}
            <Text style={styles.small}>{data.quota.analyses_left} analyses · {data.quota.questions_left} questions left this month · Not medical advice</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        )}

        {/* PRs + trainings of the week */}
        {stats.personal_records.length > 0 && (
          <Section title="Personal records 🏆">
            {stats.personal_records.map(pr => (
              <View key={`${pr.training_id}-${pr.name}`} style={styles.tr}>
                <Text style={[styles.td, { flex: 1 }]}>{pr.name}</Text>
                <Text style={styles.td}>{pr.time.replace(/^00:/, '')}</Text>
              </View>
            ))}
          </Section>
        )}

        <Section title="Trainings">
          {stats.trainings.length === 0 && <Text style={styles.muted}>No trainings in the last 7 days.</Text>}
          {stats.trainings.map(t => (
            <Pressable key={t.id} style={styles.tr} onPress={() => router.push(`/training/${t.id}` as never)}>
              <View style={[styles.legendDot, { backgroundColor: sportColor(t.sport) }]} />
              <Text style={[styles.td, { flex: 1 }]} numberOfLines={1}>
                {new Date(t.date).toLocaleDateString(undefined, { weekday: 'short' })} · {t.name ?? t.sport}
              </Text>
              <Text style={styles.tdDim}>{[t.km ? `${t.km} km` : null, t.min ? fmtMin(t.min) : null].filter(Boolean).join(' · ')}</Text>
              <Ionicons name="chevron-forward" size={14} color={palette.textDim} />
            </Pressable>
          ))}
        </Section>
      </ScrollView>
    </SafeAreaView>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.md, paddingVertical: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.panel },
  topTitle: { color: palette.text, fontSize: 18, fontWeight: '800' },
  period: { color: palette.textDim, fontSize: 12, marginTop: 1 },
  content: { padding: spacing.md, paddingBottom: 48, gap: spacing.md },
  muted: { color: palette.textMuted, fontSize: 13, lineHeight: 19 },
  small: { color: palette.textDim, fontSize: 11 },

  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', flexGrow: 1, padding: 12, borderRadius: 14, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line },
  tileValue: { color: palette.text, fontSize: 20, fontWeight: '800' },
  tileRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  tileLabel: { color: palette.textDim, fontSize: 11 },
  delta: { fontSize: 11, fontWeight: '800' },

  section: { padding: 14, borderRadius: 16, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, gap: 10 },
  sectionTitle: { color: palette.text, fontSize: 15, fontWeight: '800' },

  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 150 },
  barCol: { flex: 1, alignItems: 'center', height: '100%' },
  barValue: { color: palette.textDim, fontSize: 9, height: 14 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 3, paddingBottom: 3 },
  restDot: { alignSelf: 'center', width: 6, height: 6, borderRadius: 3, backgroundColor: palette.line, marginBottom: 4 },
  barDay: { color: palette.textMuted, fontSize: 11, fontWeight: '700', marginTop: 6 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: palette.textMuted, fontSize: 11 },

  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoneName: { width: 98, color: palette.textMuted, fontSize: 12 },
  zoneTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: palette.line, overflow: 'hidden' },
  zoneBar: { height: 10, borderRadius: 5 },
  zoneTime: { width: 58, textAlign: 'right', color: palette.text, fontSize: 12, fontWeight: '700' },

  coach: { padding: 14, borderRadius: 16, gap: 10, backgroundColor: palette.panel, borderWidth: 1, borderColor: 'rgba(108,255,47,0.3)' },
  coachHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { width: 24, height: 24, borderRadius: 8, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  headline: { color: palette.text, fontSize: 16, fontWeight: '800', lineHeight: 22 },
  body: { color: palette.textMuted, fontSize: 14, lineHeight: 21 },
  plan: { gap: 6, padding: 10, borderRadius: 12, backgroundColor: 'rgba(108,255,47,0.08)' },
  planTitle: { color: palette.accent, fontSize: 12, fontWeight: '800' },
  planRow: { flexDirection: 'row', gap: 8 },
  planText: { flex: 1, color: palette.text, fontSize: 13, lineHeight: 19 },
  qa: { gap: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: palette.line },
  q: { color: palette.accent, fontSize: 13, fontWeight: '700' },
  chip: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panelRaised },
  chipText: { color: palette.text, fontSize: 13 },
  askRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, height: 42, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: palette.line, color: palette.text, fontSize: 14 },
  sendBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  primaryBtn: { height: 44, borderRadius: 12, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#041109', fontSize: 14, fontWeight: '800' },
  secondaryBtn: { height: 40, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(108,255,47,0.4)', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: palette.accent, fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  error: { color: '#ff6b6b', fontSize: 12 },

  tr: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  td: { color: palette.text, fontSize: 13 },
  tdDim: { color: palette.textDim, fontSize: 12 },
})
