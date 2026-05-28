'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, MapPin, PenLine, Route as RouteIcon, Search, Zap } from 'lucide-react'

import api from '@/lib/api'
import { CATEGORIES, CATEGORY_EMOJI } from '@/lib/categories'
import { useAuthStore } from '@/store/auth'

interface ActivityRoute {
  id: number
  title: string
  category: { value: string; label: string }
  stats: {
    distance_km: number | null
    elevation_gain: number | null
    max_grade: number | null
    max_downgrade: number | null
  }
  location: {
    start_lat: number | null
    start_lng: number | null
    area_label: string | null
  }
  views_count: number
  creator?: { id: number; name: string } | null
}

const RADIUS_OPTIONS = [
  { label: 'All', km: null },
  { label: '50 km', km: 50 },
  { label: '100 km', km: 100 },
  { label: '200 km', km: 200 },
  { label: '500 km', km: 500 },
] as const

const SORT_OPTIONS = [
  { value: 'new', label: 'Newest' },
  { value: 'popular', label: 'Popular' },
  { value: 'distance_asc', label: 'Shortest' },
  { value: 'distance_desc', label: 'Longest' },
  { value: 'elevation_asc', label: 'Least climb' },
  { value: 'elevation_desc', label: 'Most climb' },
] as const

const DISTANCE_PRESETS = [
  { label: 'Any', min: null, max: null },
  { label: '< 10 km', min: null, max: 10 },
  { label: '10-30 km', min: 10, max: 30 },
  { label: '30-80 km', min: 30, max: 80 },
  { label: '80+ km', min: 80, max: null },
] as const

const ELEVATION_PRESETS = [
  { label: 'Any climb', min: null, max: null },
  { label: '< 300 m', min: null, max: 300 },
  { label: '300-1000 m', min: 300, max: 1000 },
  { label: '1000+ m', min: 1000, max: null },
] as const

function chipStyle(active: boolean, tone: 'green' | 'blue' = 'green') {
  const color = tone === 'green' ? 'var(--primary)' : 'var(--secondary)'
  const bg = tone === 'green' ? 'rgba(57,255,20,0.08)' : 'rgba(0,168,255,0.08)'
  return {
    borderColor: active ? color : 'var(--border)',
    color: active ? color : 'var(--text-muted)',
    background: active ? bg : 'transparent',
  }
}

export function RoutesTab() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const [routes, setRoutes] = useState<ActivityRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [radiusKm, setRadiusKm] = useState<number | null>(null)
  const [distancePreset, setDistancePreset] = useState(0)
  const [elevationPreset, setElevationPreset] = useState(0)
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]['value']>('new')

  const discoveryLat = user?.home?.lat ?? user?.location?.lat ?? null
  const discoveryLng = user?.home?.lng ?? user?.location?.lng ?? null

  const params = useMemo(() => {
    const next: Record<string, unknown> = { per_page: 100, sort }
    const distance = DISTANCE_PRESETS[distancePreset]
    const elevation = ELEVATION_PRESETS[elevationPreset]
    if (q.trim()) next.q = q.trim()
    if (category) next.category = category
    if (distance.min != null) next.distance_min = distance.min
    if (distance.max != null) next.distance_max = distance.max
    if (elevation.min != null) next.elevation_min = elevation.min
    if (elevation.max != null) next.elevation_max = elevation.max
    if (radiusKm != null && typeof discoveryLat === 'number' && typeof discoveryLng === 'number') {
      next.lat = discoveryLat
      next.lng = discoveryLng
      next.radius_km = radiusKm
    }
    return next
  }, [category, discoveryLat, discoveryLng, distancePreset, elevationPreset, q, radiusKm, sort])

  const load = useCallback(() => {
    setLoading(true)
    api.get('/routes', { params })
      .then(({ data }) => setRoutes(data.data ?? []))
      .catch(() => setRoutes([]))
      .finally(() => setLoading(false))
  }, [params])

  useEffect(() => {
    const id = window.setTimeout(load, q ? 220 : 0)
    return () => window.clearTimeout(id)
  }, [load, q])

  return (
    <div className="space-y-3">
      {/* Create route button */}
      <button
        onClick={() => router.push('/routes/draw')}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-sm transition-opacity hover:opacity-80"
        style={{ borderColor: 'rgba(57,255,20,0.3)', background: 'rgba(57,255,20,0.06)', color: 'var(--primary)' }}
      >
        <PenLine size={15} />
        Create new route
      </button>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-xl border px-3 py-2" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <Search size={15} style={{ color: 'var(--text-muted)' }} />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search routes"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

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

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {RADIUS_OPTIONS.map(radius => (
          <button
            key={String(radius.km)}
            onClick={() => setRadiusKm(radius.km)}
            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors"
            style={chipStyle(radiusKm === radius.km, 'blue')}
          >
            {radius.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select value={distancePreset} onChange={e => setDistancePreset(Number(e.target.value))}
          className="rounded-xl border px-3 py-2 text-xs outline-none"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
          {DISTANCE_PRESETS.map((option, index) => <option key={option.label} value={index}>{option.label}</option>)}
        </select>
        <select value={elevationPreset} onChange={e => setElevationPreset(Number(e.target.value))}
          className="rounded-xl border px-3 py-2 text-xs outline-none"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
          {ELEVATION_PRESETS.map((option, index) => <option key={option.label} value={index}>{option.label}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value as typeof sort)}
          className="rounded-xl border px-3 py-2 text-xs outline-none"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}>
          {SORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      {loading && (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>
      )}

      {!loading && routes.length === 0 && (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>No routes found.</div>
      )}

      {!loading && routes.map(route => (
        <button
          key={route.id}
          onClick={() => router.push(`/routes/view?id=${route.id}`)}
          className="w-full rounded-2xl border p-4 flex items-start gap-3 text-left transition-opacity hover:opacity-80"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
            {CATEGORY_EMOJI[route.category.value] ?? <RouteIcon size={20} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2 mb-1.5">
              <span className="text-xs px-2 py-0.5 rounded-full border font-medium"
                style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(57,255,20,0.08)' }}>
                {route.category.label}
              </span>
              {(route.views_count ?? 0) > 0 && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{route.views_count} views</span>
              )}
            </div>
            <p className="font-semibold text-sm truncate">{route.title}</p>
            <div className="mt-2 space-y-1">
              {route.location.area_label && (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <MapPin size={11} /> <span className="truncate">{route.location.area_label}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Zap size={11} style={{ color: 'var(--primary)' }} />
                {[
                  route.stats.distance_km != null && `${route.stats.distance_km} km`,
                  route.stats.elevation_gain != null && `up ${route.stats.elevation_gain} m`,
                  route.stats.max_grade != null && `max ${route.stats.max_grade}%`,
                  route.stats.max_downgrade != null && `down ${Math.abs(route.stats.max_downgrade)}%`,
                ].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
        </button>
      ))}

    </div>
  )
}
