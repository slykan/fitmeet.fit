'use client'

import dynamic from 'next/dynamic'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, Download, Eye, MapPin, Mountain, Milestone, Pause, PenLine, Play, Route as RouteIcon, Share2, Trash2, Zap } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import ElevationChart from '@/components/elevation-chart'
import { WikiPhotosStrip } from '@/components/wiki-photos-strip'
import { MapLoadingOverlay } from '@/components/map-loading-overlay'
import api from '@/lib/api'
import { CATEGORIES, CATEGORY_EMOJI } from '@/lib/categories'
import { fetchElevationProfile, parseGpxAsync, type GpxResult } from '@/lib/parse-gpx'
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

function statsUpToProgress(profile: GpxResult['elevationProfile'], progress: number) {
  const n = Math.max(2, Math.ceil(progress * profile.length))
  const visible = profile.slice(0, n)
  let gain = 0
  for (let i = 1; i < visible.length; i++) {
    const d = visible[i].ele - visible[i - 1].ele
    if (d > 0) gain += d
  }
  return {
    distanceKm: Math.round((visible[visible.length - 1]?.km ?? 0) * 10) / 10,
    elevationGain: Math.round(gain),
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

const ROUTE_PLAY_DURATION_MS = 15000
const MILESTONE_STEP_KM = 10
const MILESTONE_PAUSE_MS = 30
const MILESTONE_LABEL_MS = 5000
const MILESTONE_EXIT_MS = 350
const PROGRESS_UPDATE_INTERVAL_MS = 1000 / 30

function RouteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token, user, hasHydrated } = useAuthStore()
  const id = searchParams.get('id')
  const [route, setRoute] = useState<ActivityRoute | null>(null)
  const [gpxResult, setGpxResult] = useState<GpxResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [surfaceAnalysis, setSurfaceAnalysis] = useState<SurfaceAnalysis | null>(null)
  const [surfaceLoading, setSurfaceLoading] = useState(false)
  const [playState, setPlayState] = useState<'idle' | 'playing' | 'paused'>('idle')
  const [playProgress, setPlayProgress] = useState(0)
  const [playMilestone, setPlayMilestone] = useState<{ km: number; exiting: boolean } | null>(null)
  const [showElevationLayer, setShowElevationLayer] = useState(true)
  const [showSurfaceLayer, setShowSurfaceLayer] = useState(false)
  const [showKmMarkers, setShowKmMarkers] = useState(false)
  const playFrameRef = useRef<number | null>(null)
  const hitMilestonesRef = useRef<Set<number>>(new Set())
  const milestoneExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const milestoneClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isAnimating = playState !== 'idle'

  useEffect(() => {
    return () => {
      if (playFrameRef.current != null) cancelAnimationFrame(playFrameRef.current)
      if (milestoneExitTimerRef.current != null) clearTimeout(milestoneExitTimerRef.current)
      if (milestoneClearTimerRef.current != null) clearTimeout(milestoneClearTimerRef.current)
    }
  }, [])

  function handlePlayToggle() {
    if (playState === 'playing') {
      if (playFrameRef.current != null) cancelAnimationFrame(playFrameRef.current)
      setPlayState('paused')
      return
    }
    const resumeFrom = playState === 'paused' ? playProgress : 0
    if (playState === 'idle') {
      setPlayProgress(0)
      hitMilestonesRef.current = new Set()
      setPlayMilestone(null)
      if (milestoneExitTimerRef.current != null) clearTimeout(milestoneExitTimerRef.current)
      if (milestoneClearTimerRef.current != null) clearTimeout(milestoneClearTimerRef.current)
    }
    setPlayState('playing')
    const totalKm = gpxResult?.distanceKm ?? 0
    let startTime = performance.now() - resumeFrom * ROUTE_PLAY_DURATION_MS
    let pauseUntil: number | null = null
    let lastUpdateTime = 0
    const step = (now: number) => {
      if (pauseUntil != null) {
        if (now < pauseUntil) {
          playFrameRef.current = requestAnimationFrame(step)
          return
        }
        startTime += MILESTONE_PAUSE_MS
        pauseUntil = null
      }
      const p = Math.min(1, (now - startTime) / ROUTE_PLAY_DURATION_MS)

      // Throttled to ~30fps: driving React state (and, on mobile, two WebView
      // postMessage bridges) at the full 60fps refresh rate causes jank on
      // slower devices for no visible benefit.
      if (p >= 1 || now - lastUpdateTime >= PROGRESS_UPDATE_INTERVAL_MS) {
        lastUpdateTime = now
        setPlayProgress(p)

        if (totalKm > 0) {
          for (let km = MILESTONE_STEP_KM; km < totalKm; km += MILESTONE_STEP_KM) {
            if (hitMilestonesRef.current.has(km) || p < km / totalKm) continue
            hitMilestonesRef.current.add(km)
            pauseUntil = now + MILESTONE_PAUSE_MS
            if (milestoneExitTimerRef.current != null) clearTimeout(milestoneExitTimerRef.current)
            if (milestoneClearTimerRef.current != null) clearTimeout(milestoneClearTimerRef.current)
            setPlayMilestone({ km, exiting: false })
            milestoneExitTimerRef.current = setTimeout(() => {
              setPlayMilestone(current => (current ? { ...current, exiting: true } : current))
            }, MILESTONE_LABEL_MS - MILESTONE_EXIT_MS)
            milestoneClearTimerRef.current = setTimeout(() => setPlayMilestone(null), MILESTONE_LABEL_MS)
            break
          }
        }
      }

      if (p < 1) {
        playFrameRef.current = requestAnimationFrame(step)
      } else {
        setPlayState('idle')
      }
    }
    playFrameRef.current = requestAnimationFrame(step)
  }

  const playStats = isAnimating && gpxResult
    ? statsUpToProgress(gpxResult.elevationProfile, playProgress)
    : null

  useEffect(() => {
    if (!hasHydrated) return
    if (!token) { router.replace('/login'); return }
    if (!id) { router.replace('/meet'); return }

    api.get(`/routes/${id}`)
      .then(async ({ data }) => {
        setSurfaceAnalysis(null)
        const loaded = data.data as ActivityRoute
        setRoute(loaded)
        if (!loaded.gpx_url) return
        const gpx = await api.get(`/routes/${loaded.id}/gpx`, { responseType: 'text' })
        const parsed = await parseGpxAsync(gpx.data)
        setSurfaceLoading(true)
        if (parsed.elevationProfile.length >= 2) {
          const next = withProfileStats(parsed)
          setGpxResult(next)
          analyzeRouteSurface(next.track).then(setSurfaceAnalysis).catch(() => {}).finally(() => setSurfaceLoading(false))
          return
        }
        try {
          const profile = await fetchElevationProfile(parsed.track)
          const next = withProfileStats({ ...parsed, ...profile })
          setGpxResult(next)
          analyzeRouteSurface(next.track).then(setSurfaceAnalysis).catch(() => {}).finally(() => setSurfaceLoading(false))
        } catch {
          setGpxResult(parsed)
          analyzeRouteSurface(parsed.track).then(setSurfaceAnalysis).catch(() => {}).finally(() => setSurfaceLoading(false))
        }
      })
      .catch(() => setError('Route not found.'))
      .finally(() => setLoading(false))
  }, [hasHydrated, id, router, token])

  if (!hasHydrated || !token) return null

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

  async function handleDeleteRoute() {
    if (!confirm('Delete this route permanently?')) return
    try {
      await api.delete(`/routes/${currentRoute.id}`)
      router.back()
    } catch {
      alert('Could not delete route.')
    }
  }

  async function handleGpxDownload() {
    try {
      const { data } = await api.get(`/routes/${currentRoute.id}/gpx`, { responseType: 'blob' })
      const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/gpx+xml' })
      const filename = `${currentRoute.title.trim().replace(/\s+/g, '-')}.gpx`
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('Could not download GPX.')
    }
  }

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
              {user && (route.creator?.id === user.id || user.is_admin) && (
                <button
                  onClick={handleDeleteRoute}
                  className="rounded-xl border px-3 py-2 flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ background: 'rgba(248,113,113,0.08)', borderColor: 'rgba(248,113,113,0.3)', color: '#f87171' }}
                  title="Delete route"
                >
                  <Trash2 size={15} /> Delete
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

          <div className="grid grid-cols-2 gap-2">
            {[
              ['Distance', playStats ? `${playStats.distanceKm} km` : (distanceKm != null ? `${distanceKm} km` : '-')],
              ['Elevation', playStats ? `${playStats.elevationGain} m` : (elevationGain != null ? `${elevationGain} m` : '-')],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border p-3" style={{ background: 'var(--surface)', borderColor: playStats ? 'var(--primary)' : 'var(--border)' }}>
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePlayToggle}
                  disabled={surfaceLoading || !gpxResult || gpxResult.track.length < 2}
                  className="inline-flex items-center justify-center rounded-[10px] border transition-colors disabled:opacity-50"
                  style={{
                    width: 32, height: 32,
                    borderColor: playState === 'playing' ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                    background: playState === 'playing' ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                  }}
                >
                  {playState === 'playing'
                    ? <Pause size={15} color="#031109" />
                    : <Play size={15} color="var(--text-muted)" />}
                </button>
                <button
                  type="button"
                  onClick={handleGpxDownload}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-semibold"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  <Download size={13} /> GPX
                </button>
              </div>
            </div>
            {(surfaceAnalysis?.segments?.length || gpxResult?.coloredSegments?.length) ? (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setShowElevationLayer(v => !v)}
                  className="inline-flex items-center justify-center rounded-[10px] border transition-colors"
                  style={{
                    width: 32, height: 32,
                    borderColor: showElevationLayer ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                    background: showElevationLayer ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <Mountain size={15} color={showElevationLayer ? '#031109' : 'var(--text-muted)'} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowSurfaceLayer(v => !v)}
                  className="inline-flex items-center justify-center rounded-[10px] border transition-colors"
                  style={{
                    width: 32, height: 32,
                    borderColor: showSurfaceLayer ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                    background: showSurfaceLayer ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <RouteIcon size={15} color={showSurfaceLayer ? '#031109' : 'var(--text-muted)'} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowKmMarkers(v => !v)}
                  className="inline-flex items-center justify-center rounded-[10px] border transition-colors"
                  style={{
                    width: 32, height: 32,
                    borderColor: showKmMarkers ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                    background: showKmMarkers ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                  }}
                >
                  <Milestone size={15} color={showKmMarkers ? '#031109' : 'var(--text-muted)'} />
                </button>
              </div>
            ) : null}
            <div className="relative">
              <LocationPickerMap
                lat={route.location.start_lat}
                lng={route.location.start_lng}
                track={gpxResult?.track}
                elevationSegments={gpxResult?.coloredSegments}
                surfaceSegments={surfaceAnalysis?.segments}
                playProgress={isAnimating ? playProgress : null}
                playMilestone={isAnimating ? playMilestone : null}
                showElevationLayer={showElevationLayer}
                showSurfaceLayer={showSurfaceLayer}
                showKmMarkers={showKmMarkers}
                readOnly
                height={720}
                showWindOverlay={false}
                showCloudOverlay={false}
                showMapLayerControl
              />
              {surfaceLoading && <MapLoadingOverlay />}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ['Max uphill', maxGrade != null ? `${maxGrade}%` : '-'],
                ['Max downhill', maxDowngrade != null ? `${Math.abs(maxDowngrade)}%` : '-'],
                ['Uphill distance', profileStats ? `${profileStats.uphillKm} km` : '-'],
                ['Downhill distance', profileStats ? `${profileStats.downhillKm} km` : '-'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border p-3" style={{ background: 'var(--background)', borderColor: 'var(--border)' }}>
                  <p className="text-[11px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>{label}</p>
                  <p className="text-lg font-black mt-1">{value}</p>
                </div>
              ))}
            </div>

            {surfaceAnalysis?.summary.length ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2">
                {surfaceMixText && (
                  <div className="col-span-3 sm:col-span-4 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    Surface mix: <span style={{ color: 'var(--text-muted)' }}>{surfaceMixText}</span>
                  </div>
                )}
                {surfaceAnalysis.summary.map(item => (
                  <div key={item.kind} className="rounded-lg border px-2 py-1.5 sm:rounded-xl sm:px-3 sm:py-2" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span
                        className="inline-block h-2 w-5 flex-shrink-0 rounded-full sm:h-2.5 sm:w-7"
                        style={{ background: item.color }}
                      />
                      <span className="min-w-0 truncate text-[10px] font-bold leading-tight sm:text-xs">{item.label}</span>
                    </div>
                    <p className="mt-1 truncate text-[10px] sm:text-xs" style={{ color: 'var(--text-muted)' }}>
                      {item.distanceKm} km · {item.percent}%
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
            {gpxResult && gpxResult.elevationProfile.length >= 2 && (
              <ElevationChart
                profile={gpxResult.elevationProfile}
                totalKm={gpxResult.distanceKm}
                progress={isAnimating ? playProgress : undefined}
              />
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
