'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, ChevronDown, Clock, Flame, Gauge, HeartPulse, Layers, Link2, Mountain, Tag, Trash2, Wind, Zap } from 'lucide-react'

import api from '@/lib/api'
import { CATEGORIES, CATEGORY_EMOJI } from '@/lib/categories'

interface TrainingItem {
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
  suffer_score: number | null
  gear_name: string | null
  description: string | null
  is_merged: boolean
}

interface Totals {
  count: number
  distance_m: number
  duration_s: number
  elevation_gain: number
  calories: number
}

const PROVIDER_LABEL: Record<string, string> = {
  strava: 'Strava',
  garmin: 'Garmin',
  huawei: 'Huawei Health',
}

const PROVIDER_COLOR: Record<string, string> = {
  strava: '#FC4C02',
  garmin: '#00799B',
  huawei: '#C7000B',
}

function chipStyle(active: boolean) {
  return {
    borderColor: active ? 'var(--primary)' : 'var(--border)',
    color: active ? 'var(--primary)' : 'var(--text-muted)',
    background: active ? 'rgba(57,255,20,0.08)' : 'transparent',
  }
}

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m} min`
}

function formatDistance(meters: number | null): string | null {
  if (!meters) return null
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const PACE_CATEGORIES = new Set(['running', 'hiking'])

function formatSpeed(mps: number | null, category: string): string | null {
  if (!mps) return null
  if (PACE_CATEGORIES.has(category)) {
    const secPerKm = 1000 / mps
    const m = Math.floor(secPerKm / 60)
    const s = Math.round(secPerKm % 60)
    return `${m}:${String(s).padStart(2, '0')} /km`
  }
  return `${(mps * 3.6).toFixed(1)} km/h`
}

interface DetailStat {
  icon: React.ReactNode
  label: string
  value: string
}

function buildDetails(t: TrainingItem): DetailStat[] {
  const details: (DetailStat | false)[] = [
    t.avg_heartrate != null && { icon: <HeartPulse size={13} />, label: 'Avg HR', value: `${Math.round(t.avg_heartrate)} bpm` },
    t.max_heartrate != null && { icon: <HeartPulse size={13} />, label: 'Max HR', value: `${Math.round(t.max_heartrate)} bpm` },
    t.avg_watts != null && { icon: <Zap size={13} />, label: 'Avg power', value: `${Math.round(t.avg_watts)} W` },
    t.max_watts != null && { icon: <Zap size={13} />, label: 'Max power', value: `${Math.round(t.max_watts)} W` },
    t.avg_cadence != null && { icon: <Gauge size={13} />, label: 'Cad.', value: `${Math.round(t.avg_cadence)} rpm` },
    t.calories != null && { icon: <Flame size={13} />, label: 'Cal.', value: `${Math.round(t.calories)} kcal` },
    formatSpeed(t.avg_speed_mps, t.category.value) != null && { icon: <Wind size={13} />, label: 'Avg sp.', value: formatSpeed(t.avg_speed_mps, t.category.value)! },
    formatSpeed(t.max_speed_mps, t.category.value) != null && { icon: <Gauge size={13} />, label: 'Max sp.', value: formatSpeed(t.max_speed_mps, t.category.value)! },
    t.kilojoules != null && { icon: <Zap size={13} />, label: 'Energy', value: `${Math.round(t.kilojoules)} kJ` },
    t.suffer_score != null && { icon: <Activity size={13} />, label: 'Effort', value: `${Math.round(t.suffer_score)}` },
    t.gear_name != null && { icon: <Tag size={13} />, label: 'Gear', value: t.gear_name },
  ]
  return details.filter((d): d is DetailStat => d !== false)
}

function TotalStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color: 'var(--primary)' }}>{icon}</span>
      <div>
        <p className="text-sm font-bold leading-none">{value}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
    </div>
  )
}

const MONTHS = [
  { value: 0, label: 'All months' },
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
] as const

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [0, ...Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i)]

export function TrainingsTab() {
  const router = useRouter()
  const [trainings, setTrainings] = useState<TrainingItem[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [month, setMonth] = useState(0)
  const [year, setYear] = useState(0)

  const params = useMemo(() => {
    const next: Record<string, unknown> = {}
    if (category) next.category = category
    if (month) next.month = month
    if (year) next.year = year
    return next
  }, [category, month, year])

  const load = useCallback(() => {
    setLoading(true)
    api.get('/trainings', { params })
      .then(({ data }) => {
        setTrainings(data.data ?? [])
        setTotals(data.totals ?? null)
      })
      .catch(() => { setTrainings([]); setTotals(null) })
      .finally(() => setLoading(false))
  }, [params])

  useEffect(load, [load])

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {[{ value: '', label: 'All' }, ...CATEGORIES].map(cat => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors"
            style={chipStyle(category === cat.value)}
          >
            {cat.value ? `${CATEGORY_EMOJI[cat.value] ?? ''} ${cat.label}` : cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="rounded-xl border px-3 py-2 text-xs outline-none"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
          {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="rounded-xl border px-3 py-2 text-xs outline-none"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
          {YEARS.map(y => <option key={y} value={y}>{y === 0 ? 'All years' : y}</option>)}
        </select>
      </div>

      {!loading && totals && totals.count > 0 && (
        <div className="rounded-2xl border p-4 flex flex-wrap gap-x-6 gap-y-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <TotalStat icon={<Activity size={15} />} label={totals.count === 1 ? 'Training' : 'Trainings'} value={String(totals.count)} />
          {formatDistance(totals.distance_m) && (
            <TotalStat icon={<Zap size={15} />} label="Total distance" value={formatDistance(totals.distance_m)!} />
          )}
          {formatDuration(totals.duration_s) && (
            <TotalStat icon={<Clock size={15} />} label="Total time" value={formatDuration(totals.duration_s)!} />
          )}
          {totals.elevation_gain > 0 && (
            <TotalStat icon={<Mountain size={15} />} label="Total elevation" value={`${Math.round(totals.elevation_gain)} m`} />
          )}
          {totals.calories > 0 && (
            <TotalStat icon={<Flame size={15} />} label="Total calories" value={`${Math.round(totals.calories)} kcal`} />
          )}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>
      )}

      {!loading && trainings.length === 0 && (
        <div className="text-center py-12 space-y-3">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No trainings synced yet.
          </p>
          <button
            onClick={() => router.push('/profile')}
            className="inline-flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--primary)', color: '#000' }}
          >
            <Link2 size={15} /> Connect an app
          </button>
        </div>
      )}

      {!loading && trainings.map(training => (
        <TrainingCard
          key={training.id}
          training={training}
          onDeleted={() => setTrainings(current => current.filter(t => t.id !== training.id))}
        />
      ))}
    </div>
  )
}

function TrainingCard({ training, onDeleted }: { training: TrainingItem; onDeleted: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const details = useMemo(() => buildDetails(training), [training])

  async function handleDelete() {
    if (!window.confirm('Delete this training? This only removes it from FitMeet, not from Strava/Huawei.')) return
    setDeleting(true)
    try {
      await api.delete(`/trainings/${training.id}`)
      onDeleted()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <div
      className="w-full rounded-2xl border p-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
          {CATEGORY_EMOJI[training.category.value] ?? <Activity size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-xs px-2 py-0.5 rounded-full border font-medium"
              style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(57,255,20,0.08)' }}>
              {training.category.label}
            </span>
            <span className="text-xs font-semibold" style={{ color: PROVIDER_COLOR[training.provider] ?? 'var(--text-muted)' }}>
              {PROVIDER_LABEL[training.provider] ?? training.provider}
            </span>
            {training.is_merged && (
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Layers size={11} /> merged
              </span>
            )}
          </div>
          <p className="font-semibold text-sm truncate">{training.name ?? training.category.label}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{formatDate(training.started_at)}</span>
            {formatDistance(training.distance_m) && (
              <span className="flex items-center gap-1"><Zap size={11} style={{ color: 'var(--primary)' }} /> {formatDistance(training.distance_m)}</span>
            )}
            {formatDuration(training.duration_s) && (
              <span className="flex items-center gap-1"><Clock size={11} /> {formatDuration(training.duration_s)}</span>
            )}
            {training.elevation_gain != null && training.elevation_gain > 0 && (
              <span>↑ {Math.round(training.elevation_gain)} m</span>
            )}
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          title="Delete training"
          className="flex-shrink-0 p-2 rounded-lg transition-colors hover:bg-red-500/10 disabled:opacity-40"
          style={{ color: 'var(--text-muted)' }}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {details.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-xs font-semibold mt-3 transition-opacity hover:opacity-80"
            style={{ color: 'var(--primary)' }}
          >
            <ChevronDown size={13} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            {expanded ? 'Hide details' : `Show details (${details.length})`}
          </button>

          {expanded && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              {training.description && (
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{training.description}</p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2">
                {details.map(d => (
                  <div key={d.label} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--primary)' }}>{d.icon}</span>
                    <span>{d.label}: <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{d.value}</strong></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
