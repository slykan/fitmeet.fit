'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Calendar, MapPin, Users, Zap, ChevronLeft, Lock, Pencil, ChevronDown, ChevronUp, Bell, Check, X, Share2, XCircle, Download, Wind, Cloud, Eye, CheckCircle2, Camera, Flag, Play, Pause, FastForward, Mountain, Milestone, Route as RouteIcon, ArrowUpRight, Maximize2, Minimize2 } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import { WeatherBadge } from '@/components/WeatherBadge'
import { EventWall } from '@/components/event-wall'
import ElevationChart from '@/components/elevation-chart'
import { WikiPhotosStrip } from '@/components/wiki-photos-strip'
import { MapLoadingOverlay } from '@/components/map-loading-overlay'
import { shortAddress } from '@/lib/format-address'
import { formatEventDateTime } from '@/lib/event-time'
import { getYouTubeVideoId } from '@/lib/youtube'
import { fetchRelevantEventWeather, isLiveEventWeatherWindow, windDirectionLabelDetailed, type EventWeather } from '@/lib/weather'
import { fetchRadarFrames, type RadarFrame } from '@/lib/radar'
import api from '@/lib/api'
import { playApplauseSound, playRandomActionSound } from '@/lib/action-sounds'
import { useBadgesStore } from '@/store/badges'
import { fetchElevationProfile, parseGpxAsync, GpxResult } from '@/lib/parse-gpx'
import { analyzeRouteSurface, type SurfaceAnalysis } from '@/lib/route-surface'
import { reportContent } from '@/lib/moderation'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import type { LiveParticipant } from '@/components/location-picker-map'
import { LiveProgressBar } from '@/components/live-progress-bar'

function initialsFor(name: string) {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

const LocationPickerMap = dynamic(() => import('@/components/location-picker-map'), { ssr: false })

interface Participant {
  id: number
  name: string
  avatar: string | null
  checked_in_at?: string | null
}

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string
    types?: Array<{ description: string; accept: Record<string, string[]> }>
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>
      close: () => Promise<void>
    }>
  }>
}

function gpxEndpoint(event: Event) {
  return event.is_private ? `/events/${event.id}/gpx` : `/events/public/${event.id}/gpx`
}

interface Event {
  id: number
  title: string
  description: string | null
  image_url: string | null
  category: { value: string; label: string }
  location: { lat: number; lng: number; address: string | null }
  schedule: { start_at: string; timezone: string; duration_minutes: number | null }
  activity: { distance_km: number | null; elevation_gain: number | null; pace: string | null; max_grade: number | null; max_downgrade: number | null; gpx_url: string | null }
  skill_level: string | null
  max_participants: number | null
  participants_count: number
  views_count: number
  comments_count: number
  participants: Participant[]
  is_full: boolean
  is_private: boolean
  status: string
  is_organizer: boolean
  is_joined: boolean
  checked_in_at: string | null
  checked_in_count?: number
  is_in_progress: boolean
  moment_image_url: string | null
  moment_cover: { x: number; y: number } | null
  youtube_url: string | null
  link_url: string | null
  organizer: { id: number; name: string; avatar: string | null }
}

const STOPPED_THRESHOLD_MS = 60_000
const STOPPED_DISTANCE_M = 25

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// Flags a participant as "stopped" once they haven't moved more than ~25m in
// 60s — approximate (GPS jitter, not a real crash/incident detector), just a
// visual safety cue. Anchor position only updates on a genuine move, so slow
// jitter can't drift the anchor and mask a real stop.
function applyStoppedFlags(
  positions: LiveParticipant[],
  tracker: Map<number, { lat: number; lng: number; movedAt: number }>,
): LiveParticipant[] {
  const now = Date.now()
  const seenIds = new Set<number>()
  const result = positions.map((p) => {
    seenIds.add(p.id)
    const prev = tracker.get(p.id)
    if (!prev) {
      tracker.set(p.id, { lat: p.lat, lng: p.lng, movedAt: now })
      return { ...p, stopped: false }
    }
    const distance = haversineMeters(prev.lat, prev.lng, p.lat, p.lng)
    if (distance > STOPPED_DISTANCE_M) {
      tracker.set(p.id, { lat: p.lat, lng: p.lng, movedAt: now })
      return { ...p, stopped: false }
    }
    return { ...p, stopped: now - prev.movedAt >= STOPPED_THRESHOLD_MS }
  })
  for (const id of Array.from(tracker.keys())) {
    if (!seenIds.has(id)) tracker.delete(id)
  }
  return result
}

function formatCheckInTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function checkInWindow(event: Event) {
  const start = new Date(event.schedule.start_at).getTime()
  const durationMs = (event.schedule.duration_minutes ?? 60) * 60 * 1000
  return {
    opensAt: start - 30 * 60 * 1000,
    closesAt: start + durationMs + 2 * 60 * 60 * 1000,
  }
}

function canCheckInNow(event: Event) {
  const now = Date.now()
  const { opensAt, closesAt } = checkInWindow(event)
  return event.status === 'active' && event.is_joined && !event.checked_in_at && now >= opensAt && now <= closesAt
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

  const profileStats = statsFromElevationProfile(result.elevationProfile)
  return {
    ...result,
    elevationGain: result.elevationGain || profileStats.elevationGain,
    maxGrade: result.maxGrade || profileStats.maxGrade,
    maxDowngrade: result.maxDowngrade || profileStats.maxDowngrade,
  }
}

// Pace-based, not a fixed total duration — so every route plays at the same
// real-world speed instead of longer routes racing through in the same wall-clock time.
const PLAY_MS_PER_KM_NORMAL = 1500 // 15s per 10km
const PLAY_MS_PER_KM_FAST = 500    // 5s per 10km
const PLAY_FAST_FORWARD_RATE = PLAY_MS_PER_KM_NORMAL / PLAY_MS_PER_KM_FAST
const MILESTONE_STEP_KM = 10
const MILESTONE_PAUSE_MS = 600
const MILESTONE_LABEL_MS = 5000
const MILESTONE_EXIT_MS = 350
const PROGRESS_UPDATE_INTERVAL_MS = 1000 / 30

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

function EventContent() {
  const searchParams = useSearchParams()
  const { token, user, hasHydrated } = useAuthStore()
  const router       = useRouter()
  const id           = searchParams.get('id')
  const wall         = searchParams.get('wall')

  const [event,    setEvent]    = useState<Event | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [joining,  setJoining]  = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [livePositions, setLivePositions] = useState<LiveParticipant[]>([])
  const stoppedTrackerRef = useRef<Map<number, { lat: number; lng: number; movedAt: number }>>(new Map())
  const [clusterListParticipants, setClusterListParticipants] = useState<LiveParticipant[] | null>(null)
  const [viewersCount, setViewersCount] = useState(0)
  const [hasApplauded, setHasApplauded] = useState(false)
  const lastApplauseRef = useRef<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)
  const [gpxResult, setGpxResult] = useState<GpxResult | null>(null)
  const [surfaceAnalysis, setSurfaceAnalysis] = useState<SurfaceAnalysis | null>(null)
  const [gpxLoading, setGpxLoading] = useState(false)
  const [surfaceLoading, setSurfaceLoading] = useState(false)
  const [playState, setPlayState] = useState<'idle' | 'playing' | 'paused'>('idle')
  const [playProgress, setPlayProgress] = useState(0)
  const [playMilestone, setPlayMilestone] = useState<{ km: number; exiting: boolean } | null>(null)
  const [showElevationLayer, setShowElevationLayer] = useState(true)
  const [showSurfaceLayer, setShowSurfaceLayer] = useState(false)
  const [showKmMarkers, setShowKmMarkers] = useState(false)
  const [playSpeed, setPlaySpeed] = useState(1)
  const playSpeedRef = useRef(1)
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

  function toggleSpeed() {
    const next = playSpeedRef.current === 1 ? PLAY_FAST_FORWARD_RATE : 1
    playSpeedRef.current = next
    setPlaySpeed(next)
    if (playState === 'playing') {
      if (playFrameRef.current != null) cancelAnimationFrame(playFrameRef.current)
      runAnimation(playProgress)
    }
  }

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
      playSpeedRef.current = 1
      setPlaySpeed(1)
      if (milestoneExitTimerRef.current != null) clearTimeout(milestoneExitTimerRef.current)
      if (milestoneClearTimerRef.current != null) clearTimeout(milestoneClearTimerRef.current)
    }
    runAnimation(resumeFrom)
  }

  // Dragging on the elevation chart takes manual control of the head marker —
  // cancel any running auto-play loop so it doesn't fight the dragged
  // position, and drop into 'paused' (not 'idle') so the map/chart keep
  // showing the head marker at wherever the viewer left it.
  function handleScrub(progress: number) {
    if (playFrameRef.current != null) {
      cancelAnimationFrame(playFrameRef.current)
      playFrameRef.current = null
    }
    if (playMilestone) setPlayMilestone(null)
    if (milestoneExitTimerRef.current != null) clearTimeout(milestoneExitTimerRef.current)
    if (milestoneClearTimerRef.current != null) clearTimeout(milestoneClearTimerRef.current)
    setPlayState('paused')
    setPlayProgress(progress)
  }

  function runAnimation(resumeFrom: number) {
    setPlayState('playing')
    const totalKm = gpxResult?.distanceKm ?? 0
    const durationMs = Math.max(totalKm, 0.1) * PLAY_MS_PER_KM_NORMAL
    let virtualElapsed = resumeFrom * durationMs
    let lastFrameTime = performance.now()
    let pauseUntil: number | null = null
    let lastUpdateTime = 0
    const step = (now: number) => {
      const dt = now - lastFrameTime
      lastFrameTime = now
      if (pauseUntil != null) {
        if (now < pauseUntil) {
          playFrameRef.current = requestAnimationFrame(step)
          return
        }
        pauseUntil = null
      } else {
        virtualElapsed += dt * playSpeedRef.current
      }
      const p = Math.min(1, virtualElapsed / durationMs)

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
  const [showParticipants, setShowParticipants] = useState(false)
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [selectedOffsets,  setSelectedOffsets]  = useState<Set<string>>(new Set())
  const [settingReminders, setSettingReminders] = useState(false)
  const [activeOffsets,    setActiveOffsets]    = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [weather, setWeather] = useState<EventWeather | null>(null)
  const [radarFrame, setRadarFrame] = useState<RadarFrame | null>(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [showWindOverlay, setShowWindOverlay] = useState(false)
  const [showCloudOverlay, setShowCloudOverlay] = useState(false)
  const [isMapInteracting, setIsMapInteracting] = useState(false)
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)
  const [weatherCenter, setWeatherCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [weatherRefreshTick, setWeatherRefreshTick] = useState(0)
  const [momentUploading, setMomentUploading] = useState(false)
  const momentInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isMapFullscreen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMapFullscreen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isMapFullscreen])

  useEffect(() => {
    if (!hasHydrated) return
    if (!token) { router.replace('/login'); return }
    if (!id)    { router.replace('/');      return }

    api.get(`/events/${id}`)
      .then(({ data }) => {
        const loadedEvent = data.data as Event
        setEvent(loadedEvent)
        if (loadedEvent.location?.lat != null && loadedEvent.location?.lng != null) {
          setWeatherCenter({ lat: loadedEvent.location.lat, lng: loadedEvent.location.lng })
        }
        if (loadedEvent.activity?.gpx_url) {
          setGpxLoading(true)
          api.get(gpxEndpoint(loadedEvent), { responseType: 'text' })
            .then(async (r) => {
              const parsed = await parseGpxAsync(r.data)
              setSurfaceLoading(true)
              analyzeRouteSurface(parsed.track).then(setSurfaceAnalysis).catch(() => {}).finally(() => setSurfaceLoading(false))
              if (parsed.elevationProfile.length >= 2) {
                setGpxResult(withProfileStats(parsed))
                return
              }
              try {
                const profile = await fetchElevationProfile(parsed.track)
                setGpxResult(withProfileStats({
                  ...parsed,
                  ...profile,
                }))
              } catch {
                setGpxResult(parsed)
              }
            })
            .catch(() => {})
            .finally(() => setGpxLoading(false))
        } else {
          setGpxResult(null)
          setSurfaceAnalysis(null)
        }
      })
      .catch(() => setError('Event not found.'))
      .finally(() => setLoading(false))

    // Load existing reminders for this event
    api.get('/events/my-reminders').then(({ data }) => {
      const offsets = (data.data as Record<string, string[]>)[id] ?? []
      setActiveOffsets(offsets)
    }).catch(() => {})
  }, [hasHydrated, id, token, router])

  useEffect(() => {
    if (!event?.location || event.location.lat == null || event.location.lng == null) return
    if (!weatherCenter) return
    fetchRelevantEventWeather(
      weatherCenter.lat,
      weatherCenter.lng,
      event.schedule.start_at,
      event.schedule.timezone,
    )
      .then(setWeather)
      .catch(() => setWeather(null))
  }, [event?.id, event?.schedule?.start_at, event?.schedule?.timezone, weatherCenter, weatherRefreshTick])

  useEffect(() => {
    if (!event) return
    if (!isLiveEventWeatherWindow(event.schedule.start_at, event.schedule.timezone)) return
    fetchRadarFrames()
      .then(result => setRadarFrame(result ? result.frames[result.nowIndex] ?? null : null))
      .catch(() => setRadarFrame(null))
  }, [event?.id, event?.schedule?.start_at, event?.schedule?.timezone, weatherRefreshTick])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setWeatherRefreshTick((tick) => tick + 1)
    }, 15 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [])

  // Route-gated: without a GPX route, "stopped" detection would misfire for
  // stationary activities (yoga, gym meetups, etc.), so live tracking only
  // activates for events that have an imported route.
  useEffect(() => {
    if (!event?.id || !event.is_in_progress || !event.activity.gpx_url) {
      setLivePositions([])
      stoppedTrackerRef.current.clear()
      lastApplauseRef.current = null
      return
    }
    let cancelled = false
    const eventId = event.id
    const fetchPositions = () => {
      api.get(`/events/${eventId}/live-positions`)
        .then(({ data }) => {
          if (cancelled) return
          setLivePositions(applyStoppedFlags(data.data ?? [], stoppedTrackerRef.current))
          setViewersCount(data.viewers_count ?? 0)
          setHasApplauded(Boolean(data.applauded))
          const applauseAt: string | null = data.last_applause_at ?? null
          if (applauseAt && applauseAt !== lastApplauseRef.current) {
            const isFirstLoad = lastApplauseRef.current === null
            lastApplauseRef.current = applauseAt
            if (!isFirstLoad) playApplauseSound()
          }
        })
        .catch(() => {})
    }
    fetchPositions()
    const interval = window.setInterval(fetchPositions, 6000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [event?.id, event?.is_in_progress, event?.checked_in_at, event?.activity.gpx_url])

  async function handleJoin() {
    if (!event) return
    setJoining(true)
    setError(null)
    try {
      const { data: res } = await api.post(`/events/${event.id}/join`)
      playRandomActionSound()
      if (res.newly_unlocked?.length) useBadgesStore.getState().enqueue(res.newly_unlocked)
      setEvent(e => e ? { ...e, is_joined: true, participants_count: e.participants_count + 1 } : e)
      setActiveOffsets([])
      setSelectedOffsets(new Set())
      setShowReminderModal(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to join.'
      setError(msg)
    } finally {
      setJoining(false)
    }
  }

  async function handleSetReminders() {
    if (!event) { setShowReminderModal(false); return }
    setSettingReminders(true)
    try {
      const offsets = Array.from(selectedOffsets)
      await api.post(`/events/${event.id}/remind`, { offsets })
      setActiveOffsets(offsets)
    } catch {}
    finally {
      setSettingReminders(false)
      setShowReminderModal(false)
    }
  }

  function openReminderModal() {
    setSelectedOffsets(new Set(activeOffsets))
    setShowReminderModal(true)
  }

  async function handleLeave() {
    if (!event) return
    setJoining(true)
    setError(null)
    try {
      await api.post(`/events/${event.id}/leave`)
      setEvent(e => e ? { ...e, is_joined: false, participants_count: e.participants_count - 1 } : e)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to leave.'
      setError(msg)
    } finally {
      setJoining(false)
    }
  }

  async function handleCheckIn() {
    if (!event || checkingIn) return
    setCheckingIn(true)
    setError(null)
    try {
      const { data } = await api.post(`/events/${event.id}/check-in`)
      if (data.data) {
        setEvent(data.data)
      } else {
        const fresh = await api.get(`/events/${event.id}`)
        setEvent(fresh.data.data)
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not check in.'
      setError(msg)
    } finally {
      setCheckingIn(false)
    }
  }

  async function sendApplause() {
    if (!event || hasApplauded) return
    setHasApplauded(true)
    playApplauseSound()
    try {
      const { data } = await api.post(`/events/${event.id}/applause`)
      if (data.last_applause_at) lastApplauseRef.current = data.last_applause_at
    } catch {}
  }

  async function handleShare() {
    if (!event || typeof window === 'undefined') return
    const version = encodeURIComponent(`${event.schedule.start_at}-${event.schedule.timezone}`)
    const url = `${window.location.origin}/events/share/${event.id}?v=${version}`
    try {
      if (navigator.share) {
        await navigator.share({
          title: event.title,
          text: `${event.category.label} on FitMeet`,
          url,
        })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  async function handleGpxDownload() {
    if (!event?.activity.gpx_url || typeof window === 'undefined') return

    try {
      const { data } = await api.get(gpxEndpoint(event), { responseType: 'blob' })
      const blob = data instanceof Blob
        ? data
        : new Blob([data], { type: 'application/gpx+xml' })
      const filename = `${event.title.trim().replace(/\s+/g, '-')}.gpx`
      const saveFilePicker = (window as SavePickerWindow).showSaveFilePicker

      if (saveFilePicker) {
        const handle = await saveFilePicker({
          suggestedName: filename,
          types: [{ description: 'GPX route', accept: { 'application/gpx+xml': ['.gpx'] } }],
        })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
        return
      }

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.rel = 'noopener'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') return
      alert('Could not download GPX.')
    }
  }

  async function handleCancelEvent() {
    if (!event) return
    if (!confirm('Cancel this event? Joined users will be notified.')) return

    setCancelling(true)
    setError(null)
    try {
      await api.delete(`/events/${event.id}`)
      setEvent(current => current ? { ...current, status: 'cancelled' } : current)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to cancel event.'
      setError(msg)
    } finally {
      setCancelling(false)
    }
  }

  function resetMomentInput() {
    if (momentInputRef.current) momentInputRef.current.value = ''
  }

  async function uploadMomentFile(file: File) {
    if (!event) return
    const form = new FormData()
    form.append('image', file)
    form.append('cover_x', '0.5')
    form.append('cover_y', '0.5')
    setMomentUploading(true)
    try {
      const { data } = await api.post(`/events/${event.id}/moment`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setEvent(cur => cur ? {
        ...cur,
        moment_image_url: data.moment_image_url,
        moment_cover: data.moment_cover ?? { x: 0.5, y: 0.5 },
      } : cur)
      resetMomentInput()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Upload failed.'
      alert(msg)
    } finally {
      setMomentUploading(false)
    }
  }

  const cancelled = event?.status === 'cancelled'
  const checkInAvailable = event ? canCheckInNow(event) : false
  const checkedInCount = event
    ? event.checked_in_count ?? event.participants.filter(p => p.checked_in_at).length
    : 0
  const activityDistanceKm = gpxResult?.distanceKm ?? event?.activity.distance_km ?? null
  const activityElevationGain = gpxResult?.elevationGain ?? event?.activity.elevation_gain ?? null
  const activityMaxGrade = gpxResult?.maxGrade ?? event?.activity.max_grade ?? null
  const activityMaxDowngrade = gpxResult?.maxDowngrade ?? event?.activity.max_downgrade ?? null
  const activityProfileStats = gpxResult?.elevationProfile.length
    ? statsFromElevationProfile(gpxResult.elevationProfile)
    : null
  const playStats = isAnimating && gpxResult
    ? statsUpToProgress(gpxResult.elevationProfile, playProgress)
    : null
  const rainDataReliable = event ? isLiveEventWeatherWindow(event.schedule.start_at, event.schedule.timezone) : false
  const surfaceMixText = surfaceAnalysis?.summary.length
    ? surfaceAnalysis.summary.map(item => `${item.percent}% ${item.label.toLowerCase()}`).join(' - ')
    : null

  return (
    <>
    <main className="min-h-screen py-8 px-4">
    <div style={{ maxWidth: 1024, margin: '0 auto' }}>
      {loading && (
        <div className="text-center py-20 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      )}

      {error && !event && (
        <div className="text-center py-20">
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{error}</p>
          <Link href="/"><Button variant="ghost">Go home</Button></Link>
        </div>
      )}

      {event && (
        <div className="space-y-5">

          <div className="rounded-2xl border p-7" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs px-2.5 py-1 rounded-full font-medium border"
                style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(57,255,20,0.08)' }}>
                {event.category.label}
              </span>
              {event.status === 'cancelled' && (
                <span className="text-xs px-2.5 py-1 rounded-full border font-medium"
                  style={{ borderColor: '#f87171', color: '#f87171', background: 'rgba(248,113,113,0.08)' }}>
                  Cancelled
                </span>
              )}
              {event.is_private && (
                <span className="text-xs flex items-center gap-1 px-2.5 py-1 rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  <Lock size={10} /> Private
                </span>
              )}
              {event.skill_level && (
                <span className="text-xs px-2.5 py-1 rounded-full border capitalize" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  {event.skill_level}
                </span>
              )}
              <button
                type="button"
                onClick={handleShare}
                className="text-xs flex items-center gap-1 px-2.5 py-1 rounded-full border transition-colors hover:bg-[--border]"
                style={{ borderColor: 'var(--border)', color: copied ? 'var(--primary)' : 'var(--text-muted)' }}
              >
                <Share2 size={10} /> {copied ? 'Copied' : 'Share'}
              </button>
              {!event.is_organizer && (
                <button
                  type="button"
                  onClick={() => reportContent('event', event.id)}
                  className="text-xs flex items-center gap-1 px-2.5 py-1 rounded-full border transition-colors hover:bg-[--border]"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  <Flag size={10} /> Report
                </button>
              )}
            </div>

            <h1 className="text-2xl font-bold leading-snug mb-4">{event.title}</h1>

            {event.image_url && (
              <button
                type="button"
                onClick={() => setShowImageModal(true)}
                className="mb-5 block w-full overflow-hidden rounded-2xl border text-left transition-opacity hover:opacity-95"
                style={{ borderColor: 'var(--border)' }}
              >
                <img
                  src={event.image_url}
                  alt={event.title}
                  className="block w-full object-cover"
                  style={{ aspectRatio: '16 / 9' }}
                />
              </button>
            )}

            {/* Moment */}
            {(() => {
              const endedAt = new Date(event.schedule.start_at).getTime() + (event.schedule.duration_minutes ?? 60) * 60000
              const ended = endedAt < Date.now()
              const withinWindow = ended && (Date.now() - endedAt) < 48 * 3600000
              if (event.moment_image_url) {
                return (
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>📸 Moment</p>
                    <div className="relative overflow-hidden rounded-2xl" style={{ border: '1px solid var(--border)' }}>
                      <img
                        src={event.moment_image_url}
                        alt="Moment"
                        className="w-full object-cover"
                        style={{
                          aspectRatio: '4/3',
                          objectPosition: '50% 50%',
                        }}
                      />
                      {event.is_organizer && withinWindow && (
                        <>
                          <input ref={momentInputRef} type="file" accept="image/*" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadMomentFile(f) }} />
                          <button
                            onClick={() => momentInputRef.current?.click()}
                            disabled={momentUploading}
                            className="absolute bottom-2 right-2 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold"
                            style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}
                          >
                            <Camera size={12} /> {momentUploading ? 'Uploading…' : 'Replace'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              }
              if (event.is_organizer && withinWindow) {
                return (
                  <div className="mb-5">
                    <input ref={momentInputRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadMomentFile(f) }} />
                    <button
                      onClick={() => momentInputRef.current?.click()}
                      disabled={momentUploading}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold transition-opacity hover:opacity-80"
                      style={{ border: '1.5px dashed rgba(57,255,20,0.35)', background: 'rgba(57,255,20,0.04)', color: 'var(--primary)' }}
                    >
                      <Camera size={16} />
                      {momentUploading ? 'Uploading…' : 'Add Moment'}
                    </button>
                  </div>
                )
              }
              return null
            })()}

            {event.description && (
              <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>{event.description}</p>
            )}

            {event.link_url && (
              <a
                href={event.link_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mb-5 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all hover:opacity-80"
                style={{ borderColor: 'rgba(57,255,20,0.35)', color: 'var(--primary)', background: 'rgba(57,255,20,0.05)' }}
              >
                Read more… <ArrowUpRight size={14} />
              </a>
            )}

            {event.status === 'cancelled' && (
              <div className="mb-5 rounded-xl border px-4 py-3 text-sm"
                style={{ borderColor: 'rgba(248,113,113,0.35)', background: 'rgba(248,113,113,0.08)', color: '#fca5a5' }}>
                This event has been cancelled. Joined participants were notified.
              </div>
            )}

            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm">
                <Calendar size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span>{formatEventDateTime(event.schedule.start_at, event.schedule.timezone)}</span>
                {event.schedule.duration_minutes && <span style={{ color: 'var(--text-muted)' }}>· {event.schedule.duration_minutes} min</span>}
              </div>
              {event.location.address && (
                <div className="flex items-start gap-2.5 text-sm">
                  <MapPin size={15} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                  <span style={{ color: 'var(--text-muted)' }}>{shortAddress(event.location.address ?? '')}</span>
                </div>
              )}
              <div className="text-sm">
                <div className="flex items-center gap-2.5">
                  <Users size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span>
                    {checkedInCount > 0 ? `Checked in ${checkedInCount}/${event.participants_count}` : `${event.participants_count} joined`}
                    {event.max_participants ? ` · max ${event.max_participants}` : ''}
                    {event.is_full && <span className="ml-2 text-red-400">· Full</span>}
                  </span>
                  {event.participants_count > 0 && (
                    <button
                      onClick={() => setShowParticipants(s => !s)}
                      className="flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full border transition-colors hover:bg-[--border]"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    >
                      {showParticipants ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}
                </div>
                {(event.views_count ?? 0) > 0 && (
                  <div className="flex items-center gap-2.5 mt-1">
                    <Eye size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{event.views_count} seen</span>
                  </div>
                )}
                {showParticipants && event.participants?.length > 0 && (
                  <div className="mt-2 ml-6 grid gap-2 sm:grid-cols-2">
                    {event.participants.map(p => (
                      <a key={p.id} href={`/users/view?id=${p.id}`}
                        className="flex items-center gap-2 text-xs px-2.5 py-2 rounded-xl border transition-opacity hover:opacity-70"
                        style={{ borderColor: 'var(--border)', background: 'var(--background)', color: 'var(--text-primary)' }}>
                        {p.avatar ? (
                          <Image src={p.avatar} alt={p.name} width={28} height={28} className="rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] text-black flex-shrink-0"
                            style={{ background: 'var(--primary)' }}>
                            {initialsFor(p.name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium">{p.name}</div>
                          <div style={{ color: p.checked_in_at ? 'var(--primary)' : 'var(--text-muted)' }}>
                            {p.checked_in_at ? `Checked in · ${formatCheckInTime(p.checked_in_at)}` : 'Waiting'}
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {(activityDistanceKm != null || event.activity.pace || activityElevationGain != null || activityMaxGrade != null || activityMaxDowngrade != null) && (
                <div className="flex items-start gap-2.5 text-sm">
                  <Zap size={15} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                  <span style={{ color: playStats ? 'var(--primary)' : 'var(--text-muted)' }}>
                    {playStats
                      ? `${playStats.distanceKm} km · ↑${playStats.elevationGain} m`
                      : [
                          activityDistanceKm != null && `${activityDistanceKm} km`,
                          activityElevationGain != null && `↑${activityElevationGain} m`,
                          activityMaxGrade != null && `▲ ${activityMaxGrade}%`,
                          activityMaxDowngrade != null && `▼ ${Math.abs(activityMaxDowngrade)}%`,
                          event.activity.pace,
                        ].filter(Boolean).join(' · ')}
                    {activityProfileStats && (
                      <span className="block mt-1">
                        Uphill {activityProfileStats.uphillKm} km · Downhill {activityProfileStats.downhillKm} km
                      </span>
                    )}
                  </span>
                </div>
              )}
              {event.location.lat != null && event.location.lng != null && (
                <WeatherBadge
                  lat={event.location.lat}
                  lng={event.location.lng}
                  startAt={event.schedule.start_at}
                  timezone={event.schedule.timezone}
                  weather={weather}
                />
              )}
              {event.activity.gpx_url && (
                <div className="flex items-start gap-2.5 text-sm">
                  <Download size={15} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                  <button
                    type="button"
                    onClick={handleGpxDownload}
                    className="inline-flex items-center gap-2 font-medium transition-opacity hover:opacity-75"
                    style={{ color: 'var(--primary)' }}
                  >
                    Download GPX
                  </button>
                </div>
              )}
            </div>
          </div>

          {(event.location.lat != null && event.location.lng != null) && (
            <div className={isMapFullscreen ? 'fixed inset-0 z-[9999] bg-[#060c1a]' : 'relative'}>
              <LocationPickerMap
                lat={event.location.lat}
                lng={event.location.lng}
                onViewChange={(lat, lng) => {
                  setWeatherCenter(prev => {
                    if (prev && Math.abs(prev.lat - lat) < 0.00001 && Math.abs(prev.lng - lng) < 0.00001) {
                      return prev
                    }
                    return { lat, lng }
                  })
                }}
                onInteractionChange={setIsMapInteracting}
                track={gpxResult?.track}
                elevationSegments={gpxResult?.coloredSegments}
                surfaceSegments={surfaceAnalysis?.segments}
                playProgress={isAnimating ? playProgress : null}
                playMilestone={isAnimating ? playMilestone : null}
                showElevationLayer={showElevationLayer}
                showSurfaceLayer={showSurfaceLayer}
                showKmMarkers={showKmMarkers}
                weather={weather}
                weatherVariant="hub"
                showWindOverlay={showWindOverlay && !isMapInteracting && !isAnimating}
                showCloudOverlay={showCloudOverlay && rainDataReliable && !isMapInteracting && !isAnimating}
                radarFrame={rainDataReliable && !isAnimating ? radarFrame : null}
                showMapLayerControl
                readOnly
                height={isMapFullscreen ? 'fill' : 720}
                participants={livePositions}
                onClusterTap={setClusterListParticipants}
                viewersCount={viewersCount}
                onApplausePress={sendApplause}
                hasApplauded={hasApplauded}
              />
              <button
                type="button"
                onClick={() => setIsMapFullscreen(v => !v)}
                title={isMapFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                className="absolute top-3 right-3 z-[750] inline-flex items-center justify-center rounded-[10px] border transition-colors"
                style={{
                  width: 32, height: 32,
                  borderColor: 'rgba(255,255,255,0.12)',
                  background: 'rgba(7,11,24,0.78)',
                }}
              >
                {isMapFullscreen
                  ? <Minimize2 size={15} color="var(--text-muted)" />
                  : <Maximize2 size={15} color="var(--text-muted)" />}
              </button>
              {(gpxLoading || surfaceLoading) && <MapLoadingOverlay />}
              <div
                className="absolute inset-x-0 bottom-0 z-[700] flex items-center justify-between gap-3 border-t px-3 py-2 sm:px-4"
                style={{
                  background: 'rgba(7,11,24,0.7)',
                  borderColor: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowWindOverlay(v => !v)}
                    className="inline-flex items-center justify-center rounded-[10px] border transition-colors"
                    style={{
                      width: 32, height: 32,
                      borderColor: showWindOverlay ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                      background: showWindOverlay ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <Wind size={15} color={showWindOverlay ? '#031109' : 'var(--text-muted)'} />
                  </button>
                  {rainDataReliable && (
                    <button
                      type="button"
                      onClick={() => setShowCloudOverlay(v => !v)}
                      className="inline-flex items-center justify-center rounded-[10px] border transition-colors"
                      style={{
                        width: 32, height: 32,
                        borderColor: showCloudOverlay ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                        background: showCloudOverlay ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                      }}
                    >
                      <Cloud size={15} color={showCloudOverlay ? '#031109' : 'var(--text-muted)'} />
                    </button>
                  )}
                  {gpxResult && gpxResult.track.length >= 2 && (
                    <button
                      type="button"
                      onClick={handlePlayToggle}
                      disabled={surfaceLoading}
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
                  )}
                  {isAnimating && (
                    <button
                      type="button"
                      onClick={toggleSpeed}
                      className="inline-flex items-center justify-center rounded-[10px] border transition-colors"
                      style={{
                        width: 32, height: 32,
                        borderColor: playSpeed !== 1 ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                        background: playSpeed !== 1 ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                      }}
                    >
                      <FastForward size={15} color={playSpeed !== 1 ? '#031109' : 'var(--text-muted)'} />
                    </button>
                  )}
                  {(surfaceAnalysis?.segments?.length || gpxResult?.coloredSegments?.length) ? (
                    <>
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
                    </>
                  ) : null}
                </div>
                {weather && (
                  <div
                    className="hidden items-center gap-2 text-xs font-semibold sm:inline-flex"
                    style={{ color: '#d7dfef' }}
                  >
                    <span>{weather.tempCurrent ?? weather.tempMax}°</span>
                    <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.16)', display: 'inline-block' }} />
                    <span>{weather.windSpeed} km/h</span>
                    <span style={{ color: '#58beff', fontWeight: 700 }}>{windDirectionLabelDetailed(weather.windDir)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {livePositions.length > 0 && gpxResult?.track && gpxResult.track.length >= 2 && (
            <LiveProgressBar track={gpxResult.track} participants={livePositions} onGroupTap={setClusterListParticipants} />
          )}

          {surfaceAnalysis?.summary.length ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2">
              {surfaceMixText && (
                <div className="col-span-3 sm:col-span-4 text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  Surface mix: <span style={{ color: 'var(--text-muted)' }}>{surfaceMixText}</span>
                </div>
              )}
              {surfaceAnalysis.summary.map(item => (
                <div key={item.kind} className="rounded-lg border px-2 py-1.5 sm:rounded-xl sm:p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <span className="inline-block h-2 w-5 flex-shrink-0 rounded-full sm:w-8" style={{ background: item.color }} />
                    <span className="min-w-0 truncate text-[10px] font-bold leading-tight sm:text-xs" style={{ color: 'var(--text-primary)' }}>{item.label}</span>
                  </div>
                  <p className="mt-1 truncate text-[10px] sm:text-xs" style={{ color: 'var(--text-muted)' }}>{item.distanceKm} km - {item.percent}%</p>
                </div>
              ))}
            </div>
          ) : null}

          {gpxResult && gpxResult.elevationProfile.length >= 2 && (
            <div>
              <p className="text-xs font-medium mb-2 px-1" style={{ color: 'var(--text-muted)' }}>Elevation profile</p>
              <ElevationChart
                profile={gpxResult.elevationProfile}
                totalKm={gpxResult.distanceKm}
                progress={isAnimating ? playProgress : undefined}
                onScrub={handleScrub}
              />
            </div>
          )}

          {gpxResult?.track.length ? <WikiPhotosStrip track={gpxResult.track} /> : null}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          <YouTubeEmbed url={event.youtube_url} />

          <EventWall
            eventId={event.id}
            initialCount={event.comments_count ?? 0}
            canAccess={event.is_joined || event.is_organizer}
            initiallyOpen={wall === '1'}
            mentionUsers={(event.participants ?? [])
              .filter(participant => participant.id != null && participant.name)
              .map(participant => ({
                id: participant.id,
                name: participant.name,
                avatar: participant.avatar,
              }))}
          />

          {event.is_joined && !cancelled && (checkInAvailable || event.checked_in_at) && (
            <div className="rounded-2xl border p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div>
                <div className="font-bold text-base">{event.checked_in_at ? 'Checked in' : 'Ready to check in?'}</div>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  {event.checked_in_at ? `You checked in at ${formatCheckInTime(event.checked_in_at)}.` : 'Mark that you made it to this event.'}
                </p>
              </div>
              {event.checked_in_at ? (
                <div className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"
                  style={{ borderColor: 'rgba(57,255,20,0.4)', color: 'var(--primary)', background: 'rgba(57,255,20,0.08)' }}>
                  <CheckCircle2 size={17} /> Done
                </div>
              ) : (
                <Button size="lg" loading={checkingIn} onClick={handleCheckIn} className="sm:min-w-36">
                  Check in
                </Button>
              )}
            </div>
          )}

          {event.status === 'active' && (
            event.is_joined ? (
              <div className="flex gap-2">
                <Button variant="ghost" size="lg" className="flex-1 border" loading={joining} onClick={handleLeave}>Leave event</Button>
                <button
                  onClick={openReminderModal}
                  title="Reminders"
                  className="flex-shrink-0 px-4 rounded-xl border transition-colors hover:bg-[--border]"
                  style={{
                    borderColor: activeOffsets.length > 0 ? 'var(--primary)' : 'var(--border)',
                    color:       activeOffsets.length > 0 ? 'var(--primary)' : 'var(--text-muted)',
                  }}
                >
                  <Bell size={18} fill={activeOffsets.length > 0 ? 'var(--primary)' : 'none'} />
                </button>
              </div>
            ) : (
              <Button size="lg" className="w-full" loading={joining} onClick={handleJoin} disabled={event.is_full}>
                {event.is_full ? 'Event is full' : 'Join event'}
              </Button>
            )
          )}

          {(event.is_organizer || user?.is_admin) && event.status === 'active' && (
            <div className="flex gap-2">
              {event.is_organizer && (
                <Button size="lg" variant="ghost" className="flex-1 border flex items-center gap-2"
                  onClick={() => router.push(`/events/edit?id=${event.id}`)}>
                  <Pencil size={15} /> Edit event
                </Button>
              )}
              <Button size="lg" variant="ghost" loading={cancelling} className="flex-1 border text-red-400 hover:text-red-400 flex items-center gap-2"
                onClick={handleCancelEvent}>
                <XCircle size={15} /> Cancel event
              </Button>
            </div>
          )}

          <a href={`/users/view?id=${event.organizer.id}`}
            className="rounded-2xl border p-5 flex items-center gap-3 transition-opacity hover:opacity-70"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>Organized by</div>
            {event.organizer.avatar ? (
              <Image src={event.organizer.avatar} alt={event.organizer.name} width={32} height={32} className="rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-black" style={{ background: 'var(--primary)' }}>
                {initialsFor(event.organizer.name)}
              </div>
            )}
            <span className="font-medium text-sm">{event.organizer.name}</span>
          </a>

        </div>
      )}
    </div>
    </main>

      {showImageModal && event?.image_url && (
      <div
        className="fixed inset-0 z-[1900] flex items-center justify-center p-4"
        style={{ background: 'rgba(5,8,22,0.88)' }}
        onClick={() => setShowImageModal(false)}
      >
        <button
          type="button"
          onClick={() => setShowImageModal(false)}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border"
          style={{ borderColor: 'rgba(255,255,255,0.18)', color: '#fff', background: 'rgba(255,255,255,0.06)' }}
        >
          <X size={18} />
        </button>
        <img
          src={event.image_url}
          alt={event.title}
          className="max-h-[90vh] max-w-[92vw] rounded-2xl object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}

    {/* Reminder modal */}
    {showReminderModal && event && (
      <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.7)' }}>
        <div className="w-full rounded-2xl border p-6 space-y-5"
          style={{ maxWidth: 420, background: 'var(--surface)', borderColor: 'var(--border)' }}>

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl mb-1">🎉</div>
              <h2 className="font-bold text-lg">Successfully joined!</h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Want a reminder before it starts?
              </p>
            </div>
            <button onClick={() => setShowReminderModal(false)} style={{ color: 'var(--text-muted)' }}>
              <X size={20} />
            </button>
          </div>

          {/* Offset toggles */}
          <div className="flex gap-2 flex-wrap">
            {(['1h', '5h', '1d'] as const).map(offset => {
              const label = offset === '1h' ? '1h before' : offset === '5h' ? '5h before' : '1 day before'
              const active = selectedOffsets.has(offset)
              return (
                <button
                  key={offset}
                  onClick={() => setSelectedOffsets(prev => {
                    const next = new Set(prev)
                    next.has(offset) ? next.delete(offset) : next.add(offset)
                    return next
                  })}
                  className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border font-medium transition-all"
                  style={{
                    borderColor: active ? 'var(--primary)' : 'var(--border)',
                    color:       active ? 'var(--primary)' : 'var(--text-muted)',
                    background:  active ? 'rgba(57,255,20,0.08)' : 'transparent',
                  }}
                >
                  {active && <Check size={13} />}
                  <Bell size={13} />
                  {label}
                </button>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowReminderModal(false)}
              className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:bg-[--border]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              Skip
            </button>
            <button
              onClick={handleSetReminders}
              disabled={settingReminders}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: 'var(--primary)', color: '#000' }}
            >
              {settingReminders ? 'Saving…' : selectedOffsets.size === 0 ? 'Clear Reminders' : 'Save Reminders'}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Live-position cluster list */}
      {clusterListParticipants && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setClusterListParticipants(null)}>
          <div className="w-full rounded-2xl border p-6 space-y-4"
            style={{ maxWidth: 420, background: 'var(--surface)', borderColor: 'var(--border)' }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h2 className="font-bold text-lg">{clusterListParticipants.length} people here</h2>
              <button onClick={() => setClusterListParticipants(null)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            <div className="space-y-1">
              {clusterListParticipants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2">
                  {p.avatar ? (
                    <Image src={p.avatar} alt={p.name} width={34} height={34} className="rounded-full object-cover" />
                  ) : (
                    <div className="flex h-[34px] w-[34px] items-center justify-center rounded-full font-bold"
                      style={{ background: 'var(--border)', color: 'var(--text)' }}>
                      {initialsFor(p.name)}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {p.speed_kmh != null ? `${p.speed_kmh.toFixed(1)} km/h` : 'Live'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </>
  )
}

function YouTubeEmbed({ url }: { url: string | null | undefined }) {
  if (!url) return null
  const ytId = getYouTubeVideoId(url)
  if (!ytId) return null
  return (
    <div className="mb-5 rounded-2xl overflow-hidden border" style={{ borderColor: 'var(--border)', position: 'relative', paddingBottom: '56.25%', height: 0 }}>
      <iframe
        src={`https://www.youtube.com/embed/${ytId}?rel=0`}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Event video"
      />
    </div>
  )
}

export default function EventPage() {
  return (
    <>
      <Navbar />
      <Suspense>
        <EventContent />
      </Suspense>
    </>
  )
}
