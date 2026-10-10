'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import { CoachPanel, type CoachNote, type CoachQuota } from '@/components/coach-panel'
import api from '@/lib/api'

// Weekly / monthly report: totals vs earlier periods, minutes per day by sport,
// HR-zone intensity, AI summary + plan, PRs and the period's trainings.

type Kind = 'week' | 'month'
interface Day { date: string; minutes: number; by_sport: Record<string, number> }
interface Stats {
  kind: Kind
  period: { start: string; end: string; days: number }
  totals: { trainings: number; hours: number; km: number; elevation_m: number; active_days: number }
  previous_avg: { trainings: number; hours: number; km: number }
  days: Day[]
  sports: { sport: string; label: string; minutes: number }[]
  hr_zones_minutes: Record<string, number> | null
  personal_records: { name: string; time: string; training_id: number }[]
  trainings: { id: number; date: string; sport: string; name?: string; km?: number; min?: number }[]
}
interface Payload { available: boolean; stats: Stats; report: CoachNote | null; quota: CoachQuota }

const SPORT_COLOR: Record<string, string> = {
  cycling: '#ffaa00', running: '#39ff14', walking: '#3399ff', hiking: '#2dd4bf', fitness: '#c084fc',
  swimming: '#38bdf8', kayaking: '#22d3ee', yoga: '#f472b6', skiing: '#94a3b8', football: '#a3e635', other: '#8f9bbd',
}
const color = (s: string) => SPORT_COLOR[s] ?? '#8f9bbd'
const ZONES = [
  { key: 'Z1', name: 'Z1 Recovery', color: '#8f9bbd' }, { key: 'Z2', name: 'Z2 Endurance', color: '#3399ff' },
  { key: 'Z3', name: 'Z3 Tempo', color: '#39ff14' }, { key: 'Z4', name: 'Z4 Threshold', color: '#ffaa00' },
  { key: 'Z5', name: 'Z5 Max', color: '#ff3b30' },
]
const TEXT: Record<Kind, { title: string; compare: string; next: string; cta: string; intro: string; ask: string }> = {
  week: { title: 'Weekly report', compare: 'Compared with your average week over the previous 4 weeks.', next: 'Next week', cta: 'Write my weekly report', intro: 'Let the coach go through your last 7 days and plan the next week.', ask: 'Ask the coach about your week…' },
  month: { title: 'Monthly report', compare: 'Compared with your average month over the previous 3 months.', next: 'Next month', cta: 'Write my monthly report', intro: 'Let the coach go through your last 30 days, see how the weeks trended and plan the next month.', ask: 'Ask the coach about your month…' },
}
const fmtMin = (min: number) => {
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}
const pct = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 100) : null)

export default function ReportsPage() {
  const router = useRouter()
  const [kind, setKind] = useState<Kind>('week')
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null)
    setError(null)
    api.get(`/reports/${kind}`).then(({ data }) => setData(data)).catch(() => setError('Could not load your report.'))
  }, [kind])

  const text = TEXT[kind]
  const stats = data?.stats
  const maxDay = stats ? Math.max(1, ...stats.days.map(d => d.minutes)) : 1
  const zoneTotal = stats?.hr_zones_minutes ? Object.values(stats.hr_zones_minutes).reduce((a, b) => a + b, 0) : 0
  const card = 'rounded-2xl border p-5'
  const cardStyle = { background: 'var(--surface)', borderColor: 'var(--border)' }

  return (
    <>
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft size={16} /> Back
        </button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{text.title}</h1>
            {stats && (
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                {new Date(stats.period.start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – {new Date(stats.period.end).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {stats.totals.active_days}/{stats.period.days} active days
              </p>
            )}
          </div>
          <div className="flex p-1 rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            {(['week', 'month'] as Kind[]).map(k => (
              <button key={k} onClick={() => setKind(k)} className="px-4 py-1.5 rounded-lg text-sm font-bold"
                style={kind === k ? { background: 'var(--primary)', color: '#041109' } : { color: 'var(--text-muted)' }}>
                {k === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>}
        {!stats && !error && <p className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>}

        {stats && data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                ['Trainings', String(stats.totals.trainings), pct(stats.totals.trainings, stats.previous_avg.trainings)],
                ['Time', fmtMin(stats.totals.hours * 60), pct(stats.totals.hours, stats.previous_avg.hours)],
                ['Distance', `${stats.totals.km.toFixed(1)} km`, pct(stats.totals.km, stats.previous_avg.km)],
                ['Elevation', `${stats.totals.elevation_m} m`, null],
              ] as [string, string, number | null][]).map(([label, value, change]) => (
                <div key={label} className="rounded-xl border p-3" style={cardStyle}>
                  <p className="text-xl font-bold">{value}</p>
                  <div className="flex justify-between text-xs mt-0.5">
                    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                    {change != null && <span className="font-bold" style={{ color: change >= 0 ? 'var(--primary)' : '#ff8a65' }}>{change >= 0 ? '▲' : '▼'} {change > 0 ? '+' : ''}{change}%</span>}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{text.compare}</p>

            <section className={card} style={cardStyle}>
              <h2 className="font-bold mb-4">{kind === 'week' ? 'Your week' : 'Your month'}</h2>
              <div className="flex items-end h-44" style={{ gap: kind === 'week' ? 10 : 3 }}>
                {stats.days.map((d, i) => (
                  <div key={d.date} className="flex-1 h-full flex flex-col items-center" title={`${d.date}: ${fmtMin(d.minutes)}`}>
                    <span className="text-[10px] h-4" style={{ color: 'var(--text-muted)' }}>{kind === 'week' && d.minutes ? fmtMin(d.minutes) : ''}</span>
                    <div className="flex-1 w-full flex flex-col justify-end rounded-md p-0.5" style={{ background: 'color-mix(in srgb, var(--text-muted) 8%, transparent)' }}>
                      {Object.entries(d.by_sport).map(([sport, min]) => (
                        <div key={sport} className="w-full rounded mt-0.5" style={{ height: `${(min / maxDay) * 100}%`, background: color(sport) }} />
                      ))}
                    </div>
                    <span className="text-[11px] font-semibold mt-1.5 h-4" style={{ color: 'var(--text-muted)' }}>
                      {kind === 'week'
                        ? new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })
                        : (stats.days.length - 1 - i) % 7 === 0 ? new Date(d.date).getDate() : ''}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 mt-4">
                {stats.sports.map(sp => (
                  <span key={sp.sport} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: color(sp.sport) }} /> {sp.label} · {fmtMin(sp.minutes)}
                  </span>
                ))}
              </div>
            </section>

            {stats.hr_zones_minutes && zoneTotal > 0 && (
              <section className={`${card} space-y-2`} style={cardStyle}>
                <h2 className="font-bold mb-2">Intensity</h2>
                {ZONES.map(z => {
                  const min = stats.hr_zones_minutes?.[z.key] ?? 0
                  return (
                    <div key={z.key} className="flex items-center gap-3">
                      <span className="w-28 text-xs" style={{ color: 'var(--text-muted)' }}>{z.name}</span>
                      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full" style={{ width: `${(min / zoneTotal) * 100}%`, background: z.color }} />
                      </div>
                      <span className="w-16 text-right text-xs font-semibold">{fmtMin(min)}</span>
                    </div>
                  )
                })}
                <p className="text-[11px] pt-1" style={{ color: 'var(--text-muted)' }}>From trainings with heart-rate data.</p>
              </section>
            )}

            {data.available && (
              <CoachPanel
                note={data.report}
                quota={data.quota}
                writeUrl={`/reports/${kind}`}
                askUrl={`/reports/${kind}/ask`}
                onData={v => setData(v as Payload)}
                intro={text.intro}
                cta={text.cta}
                nextLabel={text.next}
                askPlaceholder={text.ask}
              />
            )}

            {stats.personal_records.length > 0 && (
              <section className={card} style={cardStyle}>
                <h2 className="font-bold mb-3">Personal records 🏆</h2>
                {stats.personal_records.map(pr => (
                  <div key={`${pr.training_id}-${pr.name}`} className="flex justify-between text-sm py-1.5 border-t" style={{ borderColor: 'var(--border)' }}>
                    <span>{pr.name}</span><span className="font-semibold">{pr.time.replace(/^00:/, '')}</span>
                  </div>
                ))}
              </section>
            )}

            <section className={card} style={cardStyle}>
              <h2 className="font-bold mb-3">Trainings</h2>
              {stats.trainings.length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No trainings in the last {stats.period.days} days.</p>}
              {stats.trainings.map(t => (
                <button key={t.id} onClick={() => router.push(`/trainings/view?id=${t.id}`)}
                  className="w-full flex items-center gap-2 text-sm py-2 border-t text-left hover:opacity-80" style={{ borderColor: 'var(--border)' }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color(t.sport) }} />
                  <span className="flex-1 truncate">{new Date(t.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · {t.name ?? t.sport}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{[t.km ? `${t.km} km` : null, t.min ? fmtMin(t.min) : null].filter(Boolean).join(' · ')}</span>
                  <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                </button>
              ))}
            </section>
          </>
        )}
      </div>
    </>
  )
}
