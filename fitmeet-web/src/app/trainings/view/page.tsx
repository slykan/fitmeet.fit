'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Info } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import { TrainingCharts, type ChartSeries } from '@/components/training-charts'
import { CoachPanel, type CoachNote, type CoachQuota } from '@/components/coach-panel'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

// Training detail — charts, HR zones, splits, best efforts, laps and the AI coach.
// Owner only (GET /trainings/{id}/details answers 403 for anyone else).

interface Training {
  id: number
  category: { value: string; label: string }
  name: string | null
  started_at: string
  duration_s: number | null
  distance_m: number | null
  elevation_gain: number | null
  avg_heartrate: number | null
  max_heartrate: number | null
  avg_watts: number | null
  avg_cadence: number | null
  calories: number | null
  avg_speed_mps: number | null
  max_speed_mps: number | null
  kilojoules: number | null
  gear_name: string | null
  description: string | null
}
interface Details {
  device_name?: string
  trainer?: boolean
  weighted_average_watts?: number
  splits_metric?: { split: number; distance: number; average_speed: number; average_heartrate?: number; elevation_difference?: number }[]
  laps?: { lap_index: number; distance: number; moving_time: number; average_speed: number }[]
  best_efforts?: { name: string; moving_time: number; pr_rank?: number | null }[]
}
interface Streams { time?: number[]; distance?: number[]; altitude?: number[]; velocity_smooth?: number[]; heartrate?: number[]; cadence?: number[]; watts?: number[] }
interface DetailResponse { training: Training; details: Details | null; streams: Streams | null; complete: boolean; has_source: boolean }
interface CoachResponse { available: boolean; note: CoachNote | null; quota: CoachQuota }

const PACE_SPORTS = ['running', 'walking', 'hiking']
const ZONES = [
  { name: 'Z1 Recovery', from: 0.5, color: '#8f9bbd' },
  { name: 'Z2 Endurance', from: 0.6, color: '#3399ff' },
  { name: 'Z3 Tempo', from: 0.7, color: '#39ff14' },
  { name: 'Z4 Threshold', from: 0.8, color: '#ffaa00' },
  { name: 'Z5 Max', from: 0.9, color: '#ff3b30' },
]

const fmtDur = (s?: number | null) => {
  if (!s) return '–'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}:${String(sec).padStart(2, '0')}`
}
const fmtPace = (mps?: number | null) => {
  if (!mps || mps <= 0) return '–'
  const s = 1000 / mps
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')} /km`
}
const fmtSpeed = (mps?: number | null) => (mps ? `${(mps * 3.6).toFixed(1)} km/h` : '–')
const fmtKm = (m?: number | null) => (m ? `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km` : '–')

function TrainingContent() {
  const params = useSearchParams()
  const router = useRouter()
  const id = params.get('id')
  const me = useAuthStore(s => s.user) as { birth_date?: string | null } | null
  const [data, setData] = useState<DetailResponse | null>(null)
  const [coach, setCoach] = useState<CoachResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api.get(`/trainings/${id}/details`).then(({ data }) => setData(data)).catch(() => setError('Could not load this training.'))
    api.get(`/trainings/${id}/coach`).then(({ data }) => setCoach(data)).catch(() => {})
  }, [id])

  const t = data?.training
  const d = data?.details
  const s = data?.streams
  const usePace = !!t && PACE_SPORTS.includes(t.category.value)

  const chart = useMemo(() => {
    if (!s?.time || s.time.length < 2) return null
    const byDistance = !!s.distance && (s.distance[s.distance.length - 1] ?? 0) > 500
    const x = byDistance ? s.distance!.map(m => m / 1000) : s.time.map(sec => sec / 60)
    const has = (a?: number[]) => !!a && a.some(v => v > 0)
    const series: ChartSeries[] = []
    if (has(s.heartrate)) series.push({ key: 'hr', label: 'Heart rate', color: '#ff3b30', values: s.heartrate!, format: v => `${Math.round(v)} bpm` })
    if (has(s.velocity_smooth)) {
      series.push(usePace
        ? { key: 'pace', label: 'Pace', color: '#39ff14', invert: true, values: s.velocity_smooth!.map(v => (v > 0.5 ? 1000 / v : null)), format: v => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}` }
        : { key: 'speed', label: 'Speed', color: '#39ff14', values: s.velocity_smooth!.map(v => v * 3.6), format: v => `${v.toFixed(1)} km/h` })
    }
    if (has(s.altitude) && !d?.trainer) series.push({ key: 'alt', label: 'Elevation', color: '#3399ff', smooth: false, values: s.altitude!, format: v => `${Math.round(v)} m` })
    if (has(s.watts)) series.push({ key: 'watts', label: 'Power', color: '#ffaa00', values: s.watts!, format: v => `${Math.round(v)} W` })
    if (has(s.cadence)) series.push({ key: 'cad', label: 'Cadence', color: '#c084fc', values: s.cadence!, format: v => `${Math.round(v)} ${usePace ? 'spm' : 'rpm'}` })
    return { x, xUnit: byDistance ? 'km' : 'min', series }
  }, [s, d, usePace])

  const zones = useMemo(() => {
    const hr = s?.heartrate
    if (!hr?.some(v => v > 0)) return null
    const age = me?.birth_date ? new Date().getFullYear() - new Date(me.birth_date).getFullYear() : null
    const maxHr = age ? 220 - age : Math.max(...hr)
    const secs = ZONES.map(() => 0)
    hr.forEach((v, i) => {
      const dt = s?.time && i > 0 ? Math.max(0, s.time[i] - s.time[i - 1]) : 1
      let z = -1
      ZONES.forEach((zone, k) => { if (v / maxHr >= zone.from) z = k })
      if (z >= 0) secs[z] += dt
    })
    const total = secs.reduce((a, b) => a + b, 0) || 1
    return { maxHr, byAge: !!age, rows: ZONES.map((z, i) => ({ ...z, secs: secs[i], share: secs[i] / total })) }
  }, [s, me?.birth_date])

  if (!id) return null
  if (error) return <p className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>
  if (!t) return <p className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>

  const stats: [string, string][] = ([
    ['Distance', fmtKm(t.distance_m)],
    ['Moving time', fmtDur(t.duration_s)],
    [usePace ? 'Avg pace' : 'Avg speed', usePace ? fmtPace(t.avg_speed_mps) : fmtSpeed(t.avg_speed_mps)],
    ['Elevation', t.elevation_gain ? `${Math.round(t.elevation_gain)} m` : '–'],
    ['Heart rate', t.avg_heartrate ? `${Math.round(t.avg_heartrate)} / ${Math.round(t.max_heartrate ?? 0)} bpm` : '–'],
    ['Power', t.avg_watts ? `${Math.round(t.avg_watts)} W${d?.weighted_average_watts ? ` (NP ${Math.round(d.weighted_average_watts)})` : ''}` : '–'],
    ['Cadence', t.avg_cadence ? `${Math.round(t.avg_cadence)}` : '–'],
    ['Calories', t.calories ? `${Math.round(t.calories)} kcal` : '–'],
  ] as [string, string][]).filter(([, v]) => v !== '–')

  const card = 'rounded-2xl border p-5'
  const cardStyle = { background: 'var(--surface)', borderColor: 'var(--border)' }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--text-muted)' }}>
        <ChevronLeft size={16} /> Back
      </button>
      <div>
        <h1 className="text-2xl font-bold">{t.name ?? t.category.label}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          {t.category.label} · {new Date(t.started_at).toLocaleString()}{d?.device_name ? ` · ${d.device_name}` : ''}{t.gear_name ? ` · ${t.gear_name}` : ''}
        </p>
        {t.description && <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>{t.description}</p>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-xl border p-3" style={cardStyle}>
            <p className="text-lg font-bold">{value}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>

      {coach?.available && (
        <CoachPanel
          note={coach.note}
          quota={coach.quota}
          writeUrl={`/trainings/${t.id}/coach`}
          askUrl={`/trainings/${t.id}/coach/ask`}
          onData={v => setCoach(v as CoachResponse)}
          intro="Get a short analysis of this training — compared with your recent ones — and a tip for the next one."
          cta="What does the coach say?"
          askPlaceholder="Ask the coach about this training…"
        />
      )}

      {!data.has_source ? (
        <Note text="Charts and splits come from Strava. This training was recorded only on HUAWEI Health." />
      ) : !data.complete && !chart ? (
        <Note text="Charts are still being imported from Strava — check back in a little while." />
      ) : null}

      {chart && chart.series.length > 0 && (
        <section className={card} style={cardStyle}>
          <h2 className="font-bold mb-4">Charts</h2>
          <TrainingCharts x={chart.x} xUnit={chart.xUnit} series={chart.series} />
        </section>
      )}

      {zones && (
        <section className={`${card} space-y-2`} style={cardStyle}>
          <h2 className="font-bold mb-2">Heart rate zones</h2>
          {zones.rows.map(z => (
            <div key={z.name} className="flex items-center gap-3 text-sm">
              <span className="w-28 text-xs" style={{ color: 'var(--text-muted)' }}>{z.name}</span>
              <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.round(z.share * 100)}%`, background: z.color }} />
              </div>
              <span className="w-16 text-right text-xs font-semibold">{fmtDur(z.secs)}</span>
            </div>
          ))}
          <p className="text-[11px] pt-1" style={{ color: 'var(--text-muted)' }}>
            Max HR {zones.maxHr} bpm {zones.byAge ? '(220 − age)' : '(highest in this training — add your birth date for better zones)'}
          </p>
        </section>
      )}

      {!!d?.splits_metric?.length && (
        <section className={card} style={cardStyle}>
          <h2 className="font-bold mb-3">Splits</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-left" style={{ color: 'var(--text-muted)' }}>
              <th className="pb-2 font-semibold">km</th><th className="pb-2 font-semibold">{usePace ? 'Pace' : 'Speed'}</th>
              <th className="pb-2 font-semibold text-right">HR</th><th className="pb-2 font-semibold text-right">Elev</th>
            </tr></thead>
            <tbody>
              {d.splits_metric.map(sp => (
                <tr key={sp.split} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="py-1.5">{sp.distance < 950 ? (sp.distance / 1000).toFixed(1) : sp.split}</td>
                  <td>{usePace ? fmtPace(sp.average_speed) : fmtSpeed(sp.average_speed)}</td>
                  <td className="text-right">{sp.average_heartrate ? Math.round(sp.average_heartrate) : '–'}</td>
                  <td className="text-right">{sp.elevation_difference != null ? `${sp.elevation_difference > 0 ? '+' : ''}${Math.round(sp.elevation_difference)}` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {!!d?.best_efforts?.length && (
        <section className={card} style={cardStyle}>
          <h2 className="font-bold mb-3">Best efforts</h2>
          {d.best_efforts.map(e => (
            <div key={e.name} className="flex justify-between text-sm py-1.5 border-t" style={{ borderColor: 'var(--border)' }}>
              <span>{e.name}{e.pr_rank === 1 ? '  🏆 PR' : ''}</span><span className="font-semibold">{fmtDur(e.moving_time)}</span>
            </div>
          ))}
        </section>
      )}

      {(d?.laps?.length ?? 0) > 1 && (
        <section className={card} style={cardStyle}>
          <h2 className="font-bold mb-3">Laps</h2>
          {d!.laps!.map(l => (
            <div key={l.lap_index} className="flex justify-between text-sm py-1.5 border-t" style={{ borderColor: 'var(--border)' }}>
              <span>{l.lap_index}</span><span>{fmtKm(l.distance)} · {fmtDur(l.moving_time)}</span>
              <span className="font-semibold">{usePace ? fmtPace(l.average_speed) : fmtSpeed(l.average_speed)}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

function Note({ text }: { text: string }) {
  return (
    <div className="flex gap-2 p-3 rounded-xl text-sm" style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}>
      <Info size={16} className="flex-shrink-0 mt-0.5" /> {text}
    </div>
  )
}

export default function TrainingPage() {
  return (
    <>
      <Navbar />
      <Suspense>
        <TrainingContent />
      </Suspense>
    </>
  )
}
