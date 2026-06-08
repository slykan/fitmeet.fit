'use client'

import dynamic from 'next/dynamic'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Download, Eye, MapPin, PenLine, Share2, Zap } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import ElevationChart from '@/components/elevation-chart'
import { WikiPhotosStrip } from '@/components/wiki-photos-strip'
import api from '@/lib/api'
import { CATEGORIES, CATEGORY_EMOJI } from '@/lib/categories'
import { fetchElevationProfile, parseGpx, type GpxResult } from '@/lib/parse-gpx'
import { analyzeRouteSurface, type SurfaceAnalysis } from '@/lib/route-surface'
import { useAuthStore } from '@/store/auth'

const LocationPickerMap = dynamic(() => import('@/components/location-picker-map'), { ssr: false })

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
  gpx_url: string | null
  source_event_id: number | null
  creator?: { id: number; name: string } | null
  views_count: number
}

function statsFromElevationProfile(profile: GpxResult['elevationProfile']) {
  let elevationGain = 0
  let maxGrade = 0
  let maxDowngrade = 0
  let uphillKm = 0
  let downhillKm = 0

  for (let i = 1; i < profile.length; i++) {
    const distKm = profile[i].km - profile[i - 1].km
    const eleM = profile[i].ele - profile[i - 1].ele
    if (eleM > 0) elevationGain += eleM
    if (distKm > 0) {
      const grade = (eleM / (distKm * 1000)) * 100
      if (grade > maxGrade) maxGrade = grade
      if (grade < maxDowngrade) maxDowngrade = grade
      if (grade > 0) uphillKm += distKm
      if (grade < 0) downhillKm += distKm
    }
  }

  return {
    elevationGain: Math.round(elevationGain),
    maxGrade: Math.round(maxGrade * 10) / 10,
    maxDowngrade: Math.round(maxDowngrade * 10) / 10,
    uphillKm: Math.round(uphillKm * 10) / 10,
    downhillKm: Math.round(downhillKm * 10) / 10,
  }
}

function withProfileStats(result: GpxResult): GpxResult {
  if (result.elevationProfile.length < 2) return result
  const stats = statsFromElevationProfile(result.elevationProfile)
  return {
    ...result,
    elevationGain: result.elevationGain || stats.elevationGain,
    maxGrade: result.maxGrade || stats.maxGrade,
    maxDowngrade: result.maxDowngrade || stats.maxDowngrade,
  }
}

function RouteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token, user } = useAuthStore()
  const id = searchParams.get('id')
  const [route, setRoute] = useState<ActivityRoute | null>(null)
  const [gpxResult, setGpxResult] = useState<GpxResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [surfaceAnalysis, setSurfaceAnalysis] = useState<SurfaceAnalysis | null>(null)

  useEffect(() => {
    if (!token) { router.replace('/login'); return }
    if (!id) { router.replace('/meet'); return }

    api.get(`/routes/${id}`)
      .then(async ({ data }) => {
        setSurfaceAnalysis(null)
        const loaded = data.data as ActivityRoute
        setRoute(loaded)
        if (!loaded.gpx_url) return
        const gpx = await api.get(`/routes/${loaded.id}/gpx`, { responseType: 'text' })
        const parsed = parseGpx(gpx.data)
        if (parsed.elevationProfile.length >= 2) {
          const next = withProfileStats(parsed)
          setGpxResult(next)
          analyzeRouteSurface(next.track).then(setSurfaceAnalysis).catch(() => {})
          return
        }
        try {
          const profile = await fetchElevationProfile(parsed.track)
          const next = withProfileStats({ ...parsed, ...profile })
          setGpxResult(next)
          analyzeRouteSurface(next.track).then(setSurfaceAnalysis).catch(() => {})
        } catch {
          setGpxResult(parsed)
          analyzeRouteSurface(parsed.track).then(setSurfaceAnalysis).catch(() => {})
        }
      })
      .catch(() => setError('Route not found.'))
      .finally(() => setLoading(false))
  }, [id, router, token])

  if (!token) return null

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen py-8 px-4">
          <div className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>
        </main>
      </>
    )
  }

  if (error || !route) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen py-8 px-4">
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <button onClick={() => router.back()} className="flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
              <ChevronLeft size={16} /> Back
            </button>
            <p className="text-center py-16" style={{ color: 'var(--text-muted)' }}>{error}</p>
          </div>
        </main>
      </>
    )
  }

  const currentRoute = route
  const categoryEmoji = CATEGORY_EMOJI[currentRoute.category.value] ?? CATEGORIES.find(c => c.value === currentRoute.category.value)?.emoji ?? ''
  const distanceKm = gpxResult?.distanceKm ?? currentRoute.stats.distance_km
  const elevationGain = gpxResult?.elevationGain ?? currentRoute.stats.elevation_gain
  const maxGrade = gpxResult?.maxGrade ?? currentRoute.stats.max_grade
  const maxDowngrade = gpxResult?.maxDowngrade ?? currentRoute.stats.max_downgrade
  const profileStats = gpxResult?.elevationProfile.length ? statsFromElevationProfile(gpxResult.elevationProfile) : null
  const surfaceMixText = surfaceAnalysis?.summary.length
    ? surfaceAnalysis.summary.map(item => `${item.percent}% ${item.label.toLowerCase()}`).join(' - ')
    : null

  async function shareRoute() {
    const url = `${window.location.origin}/routes/view?id=${currentRoute.id}`
    const text = [
      currentRoute.title,
      distanceKm != null ? `${distanceKm} km` : null,
      elevationGain != null ? `${elevationGain} m elevation` : null,
      '',
      url,
    ].filter(Boolean).join('\n')

    if (navigator.share) {
      try {
        await navigator.share({ title: currentRoute.title, text, url })
        return
      } catch {}
    }

    await navigator.clipboard.writeText(url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen py-8 px-4">
        <div style={{ maxWidth: 860, margin: '0 auto' }} className="space-y-5">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <ChevronLeft size={16} /> Back
          </button>

          <div className="flex items-start justify-between gap-3">
            <div className="space-y-3 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full border font-medium"
                  style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(57,255,20,0.08)' }}>
                  {categoryEmoji} {route.category.label}
                </span>
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <Eye size={12} /> {route.views_count ?? 0} views
                </span>
              </div>
              <h1 className="text-3xl font-black">{route.title}</h1>
              {route.location.area_label && (
                <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <MapPin size={15} /> {route.location.area_label}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {user && route.creator?.id === user.id && (
                <button
                  onClick={() => router.push(`/routes/draw?id=${currentRoute.id}`)}
                  className="rounded-xl border px-3 py-2 flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  title="Edit route"
                >
                  <PenLine size={15} /> Edit
                </button>
              )}
              <button
                onClick={shareRoute}
                className="rounded-xl border p-2.5 transition-opacity hover:opacity-80"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
                title="Share route"
              >
                {copied ? <span className="text-xs font-bold px-1">Copied</span> : <Share2 size={18} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              ['Distance', distanceKm != null ? `${distanceKm} km` : '-'],
              ['Elevation', elevationGain != null ? `${elevationGain} m` : '-'],
              ['Max uphill', maxGrade != null ? `${maxGrade}%` : '-'],
              ['Max downhill', maxDowngrade != null ? `${Math.abs(maxDowngrade)}%` : '-'],
              ['Uphill distance', profileStats ? `${profileStats.uphillKm} km` : '-'],
              ['Downhill distance', profileStats ? `${profileStats.downhillKm} km` : '-'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <p className="text-[11px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className="text-lg font-black mt-1">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border p-4 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-bold">
                <Zap size={16} style={{ color: 'var(--primary)' }} /> Route
              </div>
              <a
                href={route.gpx_url ?? `/api/routes/${route.id}/gpx`}
                download
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-semibold"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                <Download size={13} /> GPX
              </a>
            </div>
            <LocationPickerMap
              lat={route.location.start_lat}
              lng={route.location.start_lng}
              track={gpxResult?.track}
              coloredSegments={gpxResult?.coloredSegments ?? surfaceAnalysis?.segments}
              readOnly
              height={360}
              showWindOverlay={false}
              showCloudOverlay={false}
              showMapLayerControl
            />
            {surfaceAnalysis?.summary.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {surfaceMixText && (
                  <div className="col-span-2 sm:col-span-4 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    Surface mix: <span style={{ color: 'var(--text-muted)' }}>{surfaceMixText}</span>
                  </div>
                )}
                {surfaceAnalysis.summary.map(item => (
                  <div key={item.kind} className="rounded-xl border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-7 rounded-full"
                        style={{ background: item.color }}
                      />
                      <span className="text-xs font-bold">{item.label}</span>
                    </div>
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {item.distanceKm} km · {item.percent}%
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
            {gpxResult && gpxResult.elevationProfile.length >= 2 && (
              <ElevationChart profile={gpxResult.elevationProfile} totalKm={gpxResult.distanceKm} />
            )}
          </div>

          {gpxResult?.track.length ? <WikiPhotosStrip track={gpxResult.track} /> : null}
        </div>
      </main>
    </>
  )
}

export default function RouteViewPage() {
  return (
    <Suspense fallback={null}>
      <RouteContent />
    </Suspense>
  )
}
