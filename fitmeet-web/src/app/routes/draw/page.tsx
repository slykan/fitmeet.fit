'use client'

import dynamic from 'next/dynamic'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import api from '@/lib/api'
import { CATEGORIES, CATEGORY_EMOJI } from '@/lib/categories'
import { useAuthStore } from '@/store/auth'
import type { DrawResult, LatLng } from '@/components/route-draw-map'

const RouteDrawMap = dynamic(() => import('@/components/route-draw-map'), { ssr: false })

// ─── GPX builder ─────────────────────────────────────────────────────────────

function buildGpx(track: LatLng[], title: string): string {
  const escape = (s: string) =>
    s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!))
  const pts = track
    .map(([lat, lng]) => `    <trkpt lat="${lat.toFixed(7)}" lon="${lng.toFixed(7)}"/>`)
    .join('\n')
  const name = escape(title || 'Route')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="FitMeet" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>${name}</name></metadata>\n  <trk><name>${name}</name><trkseg>\n${pts}\n  </trkseg></trk>\n</gpx>`
}

// ─── Reverse geocode for area_label ──────────────────────────────────────────

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'FitMeetWeb/1.0' } },
    )
    const data = await res.json()
    if (!data.address) return ''
    const a = data.address
    return [a.city || a.town || a.village || a.county, a.country].filter(Boolean).join(', ')
  } catch {
    return ''
  }
}

// ─── Category picker ──────────────────────────────────────────────────────────

const ROUTABLE_CATS = ['running', 'cycling', 'hiking', 'skiing', 'climbing', 'kayaking']
const FEATURED_CATS = ['running', 'cycling', 'hiking']

function CategoryPicker({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled: boolean
}) {
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? CATEGORIES : CATEGORIES.filter(c => FEATURED_CATS.includes(c.value))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {shown.map(cat => (
          <button
            key={cat.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(cat.value)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors disabled:opacity-40"
            style={{
              borderColor: value === cat.value ? 'var(--primary)' : 'var(--border)',
              color: value === cat.value ? 'var(--primary)' : 'var(--text-muted)',
              background: value === cat.value ? 'rgba(57,255,20,0.08)' : 'transparent',
            }}
          >
            {CATEGORY_EMOJI[cat.value] ?? ''} {cat.label}
          </button>
        ))}
        {!showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-xs px-3 py-1.5 rounded-full border font-medium transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            More…
          </button>
        )}
      </div>
      {!ROUTABLE_CATS.includes(value) && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Straight-line segments — road routing only for running, cycling, hiking, skiing, climbing, kayaking.
        </p>
      )}
    </div>
  )
}

// ─── Page content ─────────────────────────────────────────────────────────────

function DrawContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const { token, user } = useAuthStore()

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('running')
  const [isPublic, setIsPublic] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(!!editId)
  const [initialWaypoints, setInitialWaypoints] = useState<LatLng[] | undefined>(undefined)
  const [categoryLocked, setCategoryLocked] = useState(false)

  const drawResultRef = useRef<DrawResult | null>(null)

  useEffect(() => {
    if (!token) { router.replace('/login'); return }
    if (!editId) return

    api.get(`/routes/${editId}`)
      .then(({ data }) => {
        const route = data.data
        if (route.creator?.id !== user?.id) { router.replace('/meet'); return }
        setTitle(route.title ?? '')
        setCategory(route.category?.value ?? 'running')
        setIsPublic(route.is_public ?? true)
        if (Array.isArray(route.waypoints) && route.waypoints.length >= 2) {
          setInitialWaypoints(route.waypoints as LatLng[])
          setCategoryLocked(true)
        }
      })
      .catch(() => router.replace('/meet'))
      .finally(() => setLoadingEdit(false))
  }, [editId, router, token, user?.id])

  if (!token) return null

  async function handleSave() {
    const result = drawResultRef.current
    if (!result || result.waypoints.length < 2) {
      setError('Draw at least 2 points on the map.')
      return
    }
    if (!title.trim()) {
      setError('Enter a route name.')
      return
    }
    setError(null)
    setSaving(true)

    try {
      const areaLabel = result.startLat != null && result.startLng != null
        ? await reverseGeocode(result.startLat, result.startLng)
        : ''

      const gpxContent = buildGpx(result.track, title)
      const gpxBlob = new Blob([gpxContent], { type: 'application/gpx+xml' })

      const form = new FormData()
      form.append('title', title.trim())
      form.append('category', category)
      form.append('is_public', isPublic ? '1' : '0')
      form.append('waypoints', JSON.stringify(result.waypoints))
      form.append('gpx', gpxBlob, `${title.trim().replace(/\s+/g, '-')}.gpx`)
      form.append('distance_km', String(result.distanceKm))
      form.append('elevation_gain', String(result.elevGain))
      if (result.startLat != null) form.append('start_lat', String(result.startLat))
      if (result.startLng != null) form.append('start_lng', String(result.startLng))
      if (result.endLat != null) form.append('end_lat', String(result.endLat))
      if (result.endLng != null) form.append('end_lng', String(result.endLng))
      if (areaLabel) form.append('area_label', areaLabel)

      if (editId) {
        form.append('_method', 'PUT')
        await api.post(`/routes/${editId}`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        router.push(`/routes/view?id=${editId}`)
      } else {
        const { data } = await api.post('/routes', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        router.push(`/routes/view?id=${data.data.id}`)
      }
    } catch {
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loadingEdit) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen py-8 px-4">
          <div className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen py-6 px-4">
        <div style={{ maxWidth: 860, margin: '0 auto' }} className="space-y-5">

          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
            >
              <ChevronLeft size={16} />
              Back
            </button>
            <h1 className="text-xl font-black">{editId ? 'Edit Route' : 'Draw Route'}</h1>
          </div>

          {/* Category picker — choose BEFORE drawing */}
          <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-sm">Activity type</p>
              {categoryLocked && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Change resets routing
                </span>
              )}
            </div>
            <CategoryPicker
              value={category}
              onChange={v => { setCategory(v); setCategoryLocked(true) }}
              disabled={false}
            />
          </div>

          {/* Map */}
          <Suspense fallback={<div style={{ height: 500, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border)' }} />}>
            <RouteDrawMap
              category={category}
              height={500}
              initialWaypoints={initialWaypoints}
              onUpdate={result => { drawResultRef.current = result }}
            />
          </Suspense>

          {/* Form */}
          <div className="rounded-2xl border p-4 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="font-bold text-sm">Route details</p>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                Route name *
              </label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Morning loop Šibenik coast"
                maxLength={140}
                className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-[--primary] transition-colors"
                style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            {/* Privacy */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Visibility</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {isPublic ? 'Visible to all FitMeet users' : 'Only visible to you'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPublic(v => !v)}
                className="relative w-12 h-6 rounded-full transition-colors"
                style={{ background: isPublic ? 'var(--primary)' : 'var(--border)' }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                  style={{ left: isPublic ? '26px' : '2px', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
                />
              </button>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm px-3 py-2 rounded-xl border" style={{ color: '#f87171', borderColor: '#f87171', background: 'rgba(248,113,113,0.08)' }}>
                {error}
              </p>
            )}

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-xl font-bold text-sm transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: 'var(--primary)', color: '#000' }}
            >
              {saving ? 'Saving…' : editId ? 'Save Changes' : 'Save Route'}
            </button>
          </div>

        </div>
      </main>
    </>
  )
}

export default function DrawRoutePage() {
  return (
    <Suspense fallback={null}>
      <DrawContent />
    </Suspense>
  )
}
