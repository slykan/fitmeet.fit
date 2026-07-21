'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, Clock, Layers, Link2, Zap } from 'lucide-react'

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
  is_merged: boolean
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

export function TrainingsTab() {
  const router = useRouter()
  const [trainings, setTrainings] = useState<TrainingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')

  const params = useMemo(() => {
    const next: Record<string, unknown> = {}
    if (category) next.category = category
    return next
  }, [category])

  const load = useCallback(() => {
    setLoading(true)
    api.get('/trainings', { params })
      .then(({ data }) => setTrainings(data.data ?? []))
      .catch(() => setTrainings([]))
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
        <div
          key={training.id}
          className="w-full rounded-2xl border p-4 flex items-start gap-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
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
        </div>
      ))}
    </div>
  )
}
