import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, Alert, AppState, Image, Modal, Pressable,
  Keyboard, KeyboardAvoidingView, Linking, Platform, ScrollView, Share, StyleSheet, Text, TextInput, View,
  type StyleProp, type ViewStyle,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import * as FileSystem from 'expo-file-system/legacy'
import { WeatherBadge } from '@/src/components/WeatherBadge'
import { EventMapCard, type LiveParticipant } from '@/src/components/EventMapCard'
import { LiveProgressBar } from '@/src/components/LiveProgressBar'
import { ElevationChart } from '@/src/components/ElevationChart'
import { WikiPhotosStrip } from '@/src/components/WikiPhotosStrip'
import type { ElevationPoint } from '@/src/components/ElevationChart'
import { CATEGORIES } from '@/src/lib/categories'
import { api } from '@/src/lib/api'
import { enrichGpxWithElevation, fetchElevationProfile, parseGpxTextAsync } from '@/src/lib/gpx'
import type { TrackSegment } from '@/src/lib/gpx'
import { analyzeRouteSurface, type SurfaceAnalysis } from '@/src/lib/route-surface'
import { playApplauseSound, playRandomActionSound } from '@/src/lib/action-sounds'
import { reportContent } from '@/src/lib/moderation'
import {
  openAndroidBatteryOptimizationSettings,
  postForegroundLocation,
  startLiveLocationTracking,
  stopLiveLocationTracking,
} from '@/src/lib/live-location'
import { useAuthStore } from '@/src/store/auth'
import { useBadgesStore } from '@/src/store/badges'
import { palette, spacing } from '@/src/theme'
import { SupportFitMeetCard } from '@/src/components/SupportFitMeetCard'

type MomentCoverPosition = { x: number; y: number }
type GpxActivityStats = {
  distanceKm: number
  elevGain: number
  maxGrade: number
  maxDowngrade: number
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Participant {
  id: number
  name: string
  avatar: string | null
  checked_in_at?: string | null
  lat?: number
  lng?: number
  speed_kmh?: number | null
  live_updated_at?: string
}

interface EventComment {
  id: number
  body: string
  created_at: string
  user: Participant
  is_mine: boolean
  can_delete: boolean
}

interface MentionDraft {
  id: number
  name: string
}

interface EventDetail {
  id: number
  title: string
  description: string | null
  category: { value: string; label: string }
  location: { lat: number | null; lng: number | null; address: string | null }
  schedule: { start_at: string; timezone: string; duration_minutes: number | null }
  activity: {
    distance_km: number | null
    elevation_gain: number | null
    pace: string | null
    max_grade: number | null
    max_downgrade: number | null
    gpx_url: string | null
  }
  participants_count: number
  max_participants: number | null
  views_count: number
  status: string
  is_full: boolean
  is_joined: boolean
  is_organizer: boolean
  notify_on_join: boolean
  checked_in_at: string | null
  checked_in_count?: number
  live_sharing_enabled: boolean
  is_in_progress: boolean
  is_private: boolean
  image_url: string | null
  moment_image_url: string | null
  moment_cover: MomentCoverPosition | null
  youtube_url: string | null
  link_url: string | null
  organizer: Participant | null
  participants: Participant[]
  skill_level: string | null
}

type ReminderOffset = '1h' | '5h' | '1d'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.emoji])
)

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function checkInWindow(event: EventDetail) {
  const start = new Date(event.schedule.start_at).getTime()
  const durationMs = (event.schedule.duration_minutes ?? 60) * 60 * 1000
  return {
    opensAt: start - 30 * 60 * 1000,
    closesAt: start + durationMs + 2 * 60 * 60 * 1000,
  }
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

function canCheckInNow(event: EventDetail) {
  const now = Date.now()
  const { opensAt, closesAt } = checkInWindow(event)
  return event.status === 'active' && event.is_joined && !event.checked_in_at && now >= opensAt && now <= closesAt
}

function statsFromElevationProfile(profile: ElevationPoint[]) {
  let elevGain = 0
  let maxGrade = 0
  let maxDowngrade = 0
  let uphillKm = 0
  let downhillKm = 0

  for (let i = 1; i < profile.length; i++) {
    const distKm = profile[i].km - profile[i - 1].km
    const eleM = profile[i].ele - profile[i - 1].ele
    if (eleM > 0) elevGain += eleM
    if (distKm > 0) {
      const grade = (eleM / (distKm * 1000)) * 100
      if (grade > maxGrade) maxGrade = grade
      if (grade < maxDowngrade) maxDowngrade = grade
      if (grade > 0) uphillKm += distKm
      if (grade < 0) downhillKm += distKm
    }
  }

  return {
    elevGain: Math.round(elevGain),
    maxGrade: Math.round(maxGrade * 10) / 10,
    maxDowngrade: Math.round(maxDowngrade * 10) / 10,
    uphillKm: Math.round(uphillKm * 10) / 10,
    downhillKm: Math.round(downhillKm * 10) / 10,
  }
}

function gpxStatsFromParsed(parsed: GpxActivityStats & { elevationProfile?: ElevationPoint[] }) {
  const profileStats = parsed.elevationProfile && parsed.elevationProfile.length >= 2
    ? statsFromElevationProfile(parsed.elevationProfile)
    : null

  return {
    distanceKm: parsed.distanceKm,
    elevGain: parsed.elevGain || profileStats?.elevGain || 0,
    maxGrade: parsed.maxGrade || profileStats?.maxGrade || 0,
    maxDowngrade: parsed.maxDowngrade || profileStats?.maxDowngrade || 0,
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

function statsUpToProgress(profile: ElevationPoint[], progress: number) {
  const n = Math.max(2, Math.ceil(progress * profile.length))
  const visible = profile.slice(0, n)
  let gain = 0
  for (let i = 1; i < visible.length; i++) {
    const d = visible[i].ele - visible[i - 1].ele
    if (d > 0) gain += d
  }
  return {
    distanceKm: Math.round((visible[visible.length - 1]?.km ?? 0) * 10) / 10,
    elevGain: Math.round(gain),
  }
}

function activeMentionAt(text: string, cursor: number) {
  if (cursor < 1) return null

  let tokenStart = cursor - 1
  while (tokenStart >= 0) {
    const char = text[tokenStart]
    if (char === '@') break
    if (/\s/.test(char)) return null
    tokenStart -= 1
  }

  if (tokenStart < 0 || text[tokenStart] !== '@') return null

  const query = text.slice(tokenStart + 1, cursor)
  if (query.includes('@')) return null

  return { start: tokenStart, end: cursor, query }
}

function matchesMention(name: string, query: string) {
  const normalizedName = name.trim().toLowerCase()
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) return true
  if (normalizedName.includes(normalizedQuery)) return true

  return normalizedName.split(/\s+/).some((part) => part.startsWith(normalizedQuery))
}

function youtubeVideoId(url: string | null | undefined) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] ?? null
    if (!host.endsWith('youtube.com')) return null

    const watchId = parsed.searchParams.get('v')
    if (watchId) return watchId

    const parts = parsed.pathname.split('/').filter(Boolean)
    if (['shorts', 'embed', 'live'].includes(parts[0])) return parts[1] ?? null
  } catch {}
  return url.match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/)?.[1] ?? null
}

function youtubeEmbedHtml(videoId: string) {
  const safeId = videoId.replace(/[^\w-]/g, '')
  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: 0; display: block; background: #000; }
  </style>
</head>
<body>
  <iframe
    src="https://www.youtube.com/embed/${safeId}?autoplay=1&rel=0&playsinline=1&modestbranding=1&origin=https%3A%2F%2Ffitmeet.fit"
    title="Event video"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    allowfullscreen>
  </iframe>
</body>
</html>`
}

const REMINDER_OPTIONS: Array<{ value: ReminderOffset; label: string }> = [
  { value: '1h', label: '1h before' },
  { value: '5h', label: '5h before' },
  { value: '1d', label: '1 day before' },
]

function Avatar({ user, size = 32 }: { user: Participant; size?: number }) {
  if (user.avatar) {
    return (
      <Image
        source={{ uri: user.avatar }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    )
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: palette.accent,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#041109', fontSize: size * 0.4, fontWeight: '800' }}>
        {user.name.charAt(0).toUpperCase()}
      </Text>
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EventDetailScreen() {
  const { id, wall, checkin } = useLocalSearchParams<{ id: string; wall?: string; checkin?: string }>()
  const me = useAuthStore(s => s.user)
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView | null>(null)

  const [event,      setEvent]      = useState<EventDetail | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [acting,     setActing]     = useState(false)
  const [imageModal, setImageModal] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [activeOffsets, setActiveOffsets] = useState<ReminderOffset[]>([])
  const [selectedOffsets, setSelectedOffsets] = useState<Set<ReminderOffset>>(new Set())
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [settingReminders, setSettingReminders] = useState(false)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [showLocationConsentModal, setShowLocationConsentModal] = useState(false)
  const [showBatteryOptModal, setShowBatteryOptModal] = useState(false)
  const [startingLiveTracking, setStartingLiveTracking] = useState(false)
  const [livePositions, setLivePositions] = useState<LiveParticipant[]>([])
  const stoppedTrackerRef = useRef<Map<number, { lat: number; lng: number; movedAt: number }>>(new Map())
  const [clusterListParticipants, setClusterListParticipants] = useState<LiveParticipant[] | null>(null)
  const [viewersCount, setViewersCount] = useState(0)
  const [hasApplauded, setHasApplauded] = useState(false)
  const lastApplauseRef = useRef<string | null>(null)
  const joinedJustNow = useRef(false)
  const checkInPromptShown = useRef(false)
  const [notifyOnJoin, setNotifyOnJoin] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [participantSectionY, setParticipantSectionY] = useState<number | null>(null)
  const [youtubeOpen, setYoutubeOpen] = useState(false)
  const [coloredSegments, setColoredSegments] = useState<TrackSegment[]>([])
  const [surfaceAnalysis, setSurfaceAnalysis] = useState<SurfaceAnalysis | null>(null)
  const [surfaceLoading, setSurfaceLoading] = useState(false)
  const [surfaceChecked, setSurfaceChecked] = useState(false)
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[]>([])
  const [gpxTrack, setGpxTrack] = useState<[number, number][]>([])
  const [gpxStats, setGpxStats] = useState<GpxActivityStats | null>(null)
  const [gpxLoading, setGpxLoading] = useState(false)
  const [gpxError, setGpxError] = useState(false)
  const [playState, setPlayState] = useState<'idle' | 'playing' | 'paused'>('idle')
  const [playProgress, setPlayProgress] = useState(0)
  const [playMilestone, setPlayMilestone] = useState<{ km: number; exiting: boolean } | null>(null)
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
    const totalKm = elevationProfile[elevationProfile.length - 1]?.km ?? 0
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

      // Throttled to ~30fps: driving React state (and two WebView postMessage
      // bridges for the map + elevation chart) at the full 60fps refresh rate
      // causes jank on slower devices for no visible benefit.
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
  const [showWall, setShowWall] = useState(wall === '1')
  const [comments, setComments] = useState<EventComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentSending, setCommentSending] = useState(false)
  const [commentCount, setCommentCount] = useState(0)
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<number | null>(null)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [commentSelection, setCommentSelection] = useState({ start: 0, end: 0 })
  const [selectedMentions, setSelectedMentions] = useState<MentionDraft[]>([])
  const [zoomAvatar, setZoomAvatar] = useState<string | null>(null)
  const [mapEnabled, setMapEnabled] = useState(false)
  const [momentUploading, setMomentUploading] = useState(false)

  const loadEvent = useCallback(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    api.get(`/events/${id}`)
      .then(({ data }) => setEvent(data.data))
      .catch(() => setError('Could not load event.'))
      .finally(() => setLoading(false))
  }, [id])

  useFocusEffect(loadEvent)

  async function pickAndUploadMoment() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to upload a moment.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    })
    if (result.canceled || !result.assets[0]) return

    await uploadMoment(result.assets[0])
  }

  async function uploadMoment(moment: ImagePicker.ImagePickerAsset) {
    const form = new FormData()
    form.append('image', {
      uri: moment.uri,
      name: moment.fileName ?? 'moment.jpg',
      type: moment.mimeType ?? 'image/jpeg',
    } as never)
    form.append('cover_x', '0.5')
    form.append('cover_y', '0.5')

    setMomentUploading(true)
    try {
      const { data } = await api.post(`/events/${id}/moment`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setEvent(prev => prev ? {
        ...prev,
        moment_image_url: data.moment_image_url,
        moment_cover: data.moment_cover ?? { x: 0.5, y: 0.5 },
      } : prev)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      Alert.alert('Error', msg ?? 'Could not upload moment.')
    } finally {
      setMomentUploading(false)
    }
  }

  useEffect(() => {
    setYoutubeOpen(false)
  }, [event?.id, event?.youtube_url])

  useEffect(() => {
    if (wall === '1') setShowWall(true)
  }, [wall])

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height)
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)
    })
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0)
    })

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  useEffect(() => {
    setColoredSegments([])
    setSurfaceAnalysis(null)
    setSurfaceLoading(false)
    setSurfaceChecked(false)
    setElevationProfile([])
    setGpxTrack([])
    setGpxStats(null)
    setGpxError(false)
    if (!event?.activity.gpx_url) {
      setGpxLoading(false)
      return
    }
    setGpxLoading(true)
    const token = useAuthStore.getState().token
    const separator = event.activity.gpx_url.includes('?') ? '&' : '?'
    fetch(`${event.activity.gpx_url}${separator}t=${Date.now()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => {
        if (!r.ok) throw new Error(`GPX request failed: ${r.status}`)
        return r.text()
      })
      .then(async xml => {
        const parsed = await parseGpxTextAsync(xml)
        if (parsed.track.length < 2) {
          setGpxError(true)
          return
        }
        setGpxTrack(parsed.track)
        setGpxStats(gpxStatsFromParsed(parsed))
        setSurfaceLoading(true)
        analyzeRouteSurface(parsed.track)
          .then((analysis) => {
            setSurfaceAnalysis(analysis)
          })
          .catch(() => {})
          .finally(() => {
            setSurfaceLoading(false)
            setSurfaceChecked(true)
          })
        if (parsed.coloredSegments.length > 0) setColoredSegments(parsed.coloredSegments)
        if (parsed.elevationProfile.length >= 2) setElevationProfile(parsed.elevationProfile)
        else {
          fetchElevationProfile(parsed.track)
            .then((profile) => {
              const profileStats = statsFromElevationProfile(profile.elevationProfile)
              setGpxStats({
                distanceKm: parsed.distanceKm,
                elevGain: parsed.elevGain || profileStats.elevGain,
                maxGrade: parsed.maxGrade || profileStats.maxGrade,
                maxDowngrade: parsed.maxDowngrade || profileStats.maxDowngrade,
              })
              if (profile.coloredSegments.length > 0) setColoredSegments(profile.coloredSegments)
              if (profile.elevationProfile.length >= 2) setElevationProfile(profile.elevationProfile)
            })
            .catch(() => {})
        }
      })
      .catch(() => setGpxError(true))
      .finally(() => setGpxLoading(false))
  }, [event?.activity.gpx_url])

  useEffect(() => {
    if (!id) return
    api.get('/events/my-reminders')
      .then(({ data }) => {
        const offsets = ((data.data as Record<string, ReminderOffset[]>)[id] ?? [])
          .filter((offset): offset is ReminderOffset => offset === '1h' || offset === '5h' || offset === '1d')
        setActiveOffsets(offsets)
        setSelectedOffsets(new Set(offsets))
      })
      .catch(() => {
        setActiveOffsets([])
        setSelectedOffsets(new Set())
      })
  }, [id])

  useEffect(() => {
    if (event?.is_joined) setNotifyOnJoin(event.notify_on_join)
  }, [event?.notify_on_join, event?.is_joined])

  // Poll live positions of checked-in, sharing participants while the event is running.
  // Anyone can watch and applaud, joined or not -- only actually appearing as a
  // marker requires having joined, checked in, and turned sharing on.
  // Route-gated: without a GPX route, "stopped" detection would misfire constantly
  // for stationary activities (yoga, gym meetups, etc.), so live tracking only
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
            if (!isFirstLoad) playApplauseSound().catch(() => {})
          }
        })
        .catch(() => {})
    }
    fetchPositions()
    const intervalId = setInterval(fetchPositions, 12000)
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') fetchPositions()
    })
    return () => {
      cancelled = true
      clearInterval(intervalId)
      subscription.remove()
    }
  }, [event?.id, event?.is_in_progress, event?.activity.gpx_url])

  // Always run a foreground watcher while this screen is open and sharing is
  // on, even when background permission is granted and the TaskManager task
  // is registered -- the background task runs as a headless callback outside
  // the normal app JS context, and in testing it has repeatedly registered
  // successfully (persistent "Sharing..." notification showing) while never
  // once actually posting a location. The foreground watcher runs in the
  // same JS context as everything else here, so it's the reliable path
  // whenever the screen is open; the background task is just a best-effort
  // supplement for when the user navigates away or backgrounds the app.
  useEffect(() => {
    if (!event?.id || !event.live_sharing_enabled || !event.is_in_progress) return
    let subscription: Location.LocationSubscription | null = null
    let cancelled = false
    const eventId = event.id
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 15 },
      (loc) => postForegroundLocation(eventId, loc),
    ).then((sub) => {
      if (cancelled) sub.remove()
      else subscription = sub
    }).catch(() => {})
    return () => {
      cancelled = true
      subscription?.remove()
    }
  }, [event?.id, event?.live_sharing_enabled, event?.is_in_progress])

  useEffect(() => {
    if (checkin !== '1' || checkInPromptShown.current || !event) return
    checkInPromptShown.current = true

    if (canCheckInNow(event)) {
      Alert.alert('Check in', 'Mark that you made it to this event?', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Check in', onPress: () => checkIn() },
      ])
    }
  }, [checkin, event?.id, event?.checked_in_at, event?.is_joined])

  const loadComments = useCallback(async () => {
    if (!id || !event) return
    if (!(event.is_joined || event.is_organizer || event.organizer?.id === me?.id)) return

    setCommentsLoading(true)
    try {
      const { data } = await api.get(`/events/${id}/comments`)
      setComments((data.data ?? []) as EventComment[])
      setCommentCount(data.meta?.count ?? (data.data ?? []).length ?? 0)
    } catch {
      setComments([])
      setCommentCount(0)
    } finally {
      setCommentsLoading(false)
    }
  }, [event, id, me?.id])

  useEffect(() => {
    if (!showWall) return
    loadComments().catch(() => {})
  }, [showWall, loadComments])

  function closeReminderModal() {
    setShowReminderModal(false)
    if (joinedJustNow.current) {
      joinedJustNow.current = false
      setTimeout(() => setShowSupportModal(true), 350)
    }
  }

  async function join() {
    if (!event) return
    setActing(true)
    try {
      const { data } = await api.post(`/events/${event.id}/join`)
      if (data.data) setEvent(data.data)
      else {
        const fresh = await api.get(`/events/${event.id}`)
        setEvent(fresh.data.data)
      }
      setSelectedOffsets(new Set(activeOffsets))
      joinedJustNow.current = true
      playRandomActionSound().catch(() => {})
      if (data.newly_unlocked?.length) useBadgesStore.getState().enqueue(data.newly_unlocked)
      setShowReminderModal(true)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not join.'
      Alert.alert('Error', msg)
    } finally { setActing(false) }
  }

  async function leave() {
    if (!event) return
    Alert.alert('Leave event', 'Leave this event and clear your reminders?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          setActing(true)
          try {
            if (event.live_sharing_enabled) await stopLiveLocationTracking(event.id)
            const { data } = await api.post(`/events/${event.id}/leave`)
            await api.post(`/events/${event.id}/remind`, { offsets: [] }).catch(() => {})
            setActiveOffsets([])
            setSelectedOffsets(new Set())
            if (data.data) setEvent(data.data)
            else {
              const fresh = await api.get(`/events/${event.id}`)
              setEvent(fresh.data.data)
            }
          } catch (e: unknown) {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not leave event.'
            Alert.alert('Error', msg)
          } finally { setActing(false) }
        },
      },
    ])
  }

  function openReminderModal() {
    setSelectedOffsets(new Set(activeOffsets))
    setShowReminderModal(true)
  }

  async function saveReminders() {
    if (!event) return
    setSettingReminders(true)
    try {
      const offsets = Array.from(selectedOffsets)
      await api.post(`/events/${event.id}/remind`, { offsets })
      setActiveOffsets(offsets)
      closeReminderModal()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not save reminders.'
      Alert.alert('Error', msg)
    } finally {
      setSettingReminders(false)
    }
  }

  async function toggleNotifyOnJoin() {
    if (!event) return
    const next = !notifyOnJoin
    setNotifyOnJoin(next)
    try {
      await api.post(`/events/${event.id}/join-notifications`, { enabled: next })
    } catch {
      setNotifyOnJoin(!next)
    }
  }

  async function checkIn() {
    if (!event || checkingIn) return

    setCheckingIn(true)
    try {
      const { data } = await api.post(`/events/${event.id}/check-in`)
      let nextEvent: EventDetail = data.data
      if (!nextEvent) {
        const fresh = await api.get(`/events/${event.id}`)
        nextEvent = fresh.data.data
      }
      setEvent(nextEvent)
      if (nextEvent.activity.gpx_url != null && !nextEvent.live_sharing_enabled) {
        setShowLocationConsentModal(true)
      }
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not check in.'
      Alert.alert('Error', msg)
    } finally {
      setCheckingIn(false)
    }
  }

  async function beginLiveLocationSharing() {
    if (!event) return
    setStartingLiveTracking(true)
    try {
      const result = await startLiveLocationTracking(event.id)
      if (!result.started) {
        setShowLocationConsentModal(false)
        Alert.alert('Location permission needed', 'Enable location access in Settings to share your position with the group.')
        return
      }
      setEvent((prev) => (prev ? { ...prev, live_sharing_enabled: true } : prev))
      setShowLocationConsentModal(false)
      if (Platform.OS === 'android' && result.background) {
        setShowBatteryOptModal(true)
      }
    } finally {
      setStartingLiveTracking(false)
    }
  }

  async function stopLiveLocationSharing() {
    if (!event) return
    setEvent((prev) => (prev ? { ...prev, live_sharing_enabled: false } : prev))
    await stopLiveLocationTracking(event.id)
  }

  async function sendApplause() {
    if (!event || hasApplauded) return
    setHasApplauded(true)
    playApplauseSound().catch(() => {})
    try {
      const { data } = await api.post(`/events/${event.id}/applause`)
      if (data.last_applause_at) lastApplauseRef.current = data.last_applause_at
    } catch {}
  }

  function toggleReminder(offset: ReminderOffset) {
    setSelectedOffsets((prev) => {
      const next = new Set(prev)
      if (next.has(offset)) next.delete(offset)
      else next.add(offset)
      return next
    })
  }

  async function cancelEvent() {
    if (!event) return
    Alert.alert('Cancel event', 'This cannot be undone. Cancel this event?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel event', style: 'destructive', onPress: async () => {
          setActing(true)
          try {
            await api.delete(`/events/${event.id}`)
            const { data } = await api.get(`/events/${event.id}`)
            setEvent(data.data)
          } catch {
            Alert.alert('Error', 'Could not cancel event.')
          } finally { setActing(false) }
        },
      },
    ])
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  if (error || !event) {
    return (
      <SafeAreaView style={styles.safe}>
        <Pressable style={[styles.backBtn, { margin: spacing.md }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={palette.text} />
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Event not found.'}</Text>
        </View>
      </SafeAreaView>
    )
  }

  const cancelled  = event.status === 'cancelled'
  const past       = new Date(event.schedule.start_at).getTime() < Date.now()
  const emoji      = CATEGORY_EMOJI[event.category.value] ?? '📍'
  const isOrg      = event.is_organizer || event.organizer?.id === me?.id
  const checkedInCount = event.checked_in_count ?? event.participants.filter(p => p.checked_in_at).length
  const checkInAvailable = canCheckInNow(event)
  const canAccessWall = event.is_joined || isOrg
  const activityDistanceKm = gpxStats?.distanceKm ?? event.activity.distance_km ?? null
  const activityElevGain = gpxStats?.elevGain ?? event.activity.elevation_gain ?? null
  const activityMaxGrade = gpxStats?.maxGrade ?? event.activity.max_grade ?? null
  const activityMaxDowngrade = gpxStats?.maxDowngrade ?? event.activity.max_downgrade ?? null
  const activityProfileStats = elevationProfile.length >= 2
    ? statsFromElevationProfile(elevationProfile)
    : null
  const playStats = isAnimating && elevationProfile.length >= 2
    ? statsUpToProgress(elevationProfile, playProgress)
    : null
  const wallMembers = [
    ...(event.organizer ? [event.organizer] : []),
    ...event.participants,
  ].filter((participant, index, arr) => arr.findIndex((entry) => entry.id === participant.id) === index)
  const mentionState = activeMentionAt(commentDraft, commentSelection.start)
  const mentionSuggestions = mentionState
    ? wallMembers
        .filter((participant) => participant.id !== me?.id)
        .filter((participant) => matchesMention(participant.name, mentionState.query))
        .slice(0, 6)
    : []

  function shareEvent() {
    const d = new Date(event!.schedule.start_at)
    const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    Share.share({
      title: event!.title,
      message: [
        event!.title,
        `📅 ${date} · ${time}`,
        event!.location.address ? `📍 ${event!.location.address}` : null,
        `👥 ${event!.participants_count} joined`,
        '',
        `Join on FitMeet 👉 https://fitmeet.fit/events/share?id=${event!.id}`,
      ].filter(Boolean).join('\n'),
    })
  }

  async function openGpxRoute() {
    if (!event?.activity.gpx_url) return
    try {
      const token = useAuthStore.getState().token
      const baseUrl = api.defaults.baseURL ?? 'https://api.fitmeet.fit/api'
      const endpoint = event.is_private
        ? `${baseUrl}/events/${event.id}/gpx`
        : `${baseUrl}/events/public/${event.id}/gpx`
      const filename = `${event.title.trim().replace(/\s+/g, '-')}.gpx`
      const fileUri = FileSystem.cacheDirectory + filename
      await FileSystem.downloadAsync(endpoint, fileUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const raw = await FileSystem.readAsStringAsync(fileUri)
      const enriched = await enrichGpxWithElevation(raw)
      await FileSystem.writeAsStringAsync(fileUri, enriched)
      if (Platform.OS === 'ios') {
        await Share.share({ url: fileUri })
      } else {
        const perms = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()
        if (!perms.granted) return
        const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
          perms.directoryUri, filename, 'application/gpx+xml',
        )
        await FileSystem.writeAsStringAsync(destUri, enriched)
        Alert.alert('GPX saved', `${filename} saved to selected folder.`)
      }
    } catch {
      Alert.alert('GPX route', 'Could not download GPX file.')
    }
  }

  async function sendComment() {
    if (!event || !canAccessWall || !commentDraft.trim() || commentSending) return
    setCommentSending(true)
    try {
      const activeMentionIds = selectedMentions
        .filter((mention) => commentDraft.includes(`@${mention.name}`))
        .map((mention) => mention.id)

      const { data } = await api.post(`/events/${event.id}/comments`, {
        body: commentDraft.trim(),
        mention_user_ids: activeMentionIds,
      })
      const next = data.data as EventComment
      setComments((prev) => [...prev, next])
      setCommentCount((prev) => prev + 1)
      setCommentDraft('')
      setCommentSelection({ start: 0, end: 0 })
      setSelectedMentions([])
      setShowWall(true)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not post comment.'
      Alert.alert('Error', msg)
    } finally {
      setCommentSending(false)
    }
  }

  async function deleteComment(commentId: number) {
    if (!event) return
    try {
      await api.delete(`/events/${event.id}/comments/${commentId}`)
      setComments((prev) => prev.filter((comment) => comment.id !== commentId))
      setCommentCount((prev) => Math.max(0, prev - 1))
      setPendingDeleteCommentId((current) => current === commentId ? null : current)
    } catch {
      Alert.alert('Error', 'Could not delete comment.')
    }
  }

  function insertMention(participant: Participant) {
    if (!mentionState) return

    const inserted = `@${participant.name} `
    const nextDraft =
      commentDraft.slice(0, mentionState.start) +
      inserted +
      commentDraft.slice(mentionState.end)

    const nextCursor = mentionState.start + inserted.length

    setCommentDraft(nextDraft)
    setCommentSelection({ start: nextCursor, end: nextCursor })
    setSelectedMentions((prev) => {
      const filtered = prev.filter((mention) => mention.id !== participant.id)
      return [...filtered, { id: participant.id, name: participant.name }]
    })

    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true })
    })
  }

  // ─── Action button ──────────────────────────────────────────────────────
  function openAvatarZoom(avatar: string | null) {
    if (!avatar) return
    setZoomAvatar(avatar)
  }

  function scrollToParticipants() {
    if (!event) return
    if (event.participants_count <= 0) return

    setShowParticipants(true)

    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, (participantSectionY ?? 0) - spacing.md),
          animated: true,
        })
      }, 80)
    })
  }

  let actionLabel = 'Join Event'
  let actionStyle: StyleProp<ViewStyle> = styles.joinBtn
  let actionLabelStyle = styles.actionLabel
  let actionFn    = join
  let actionDisabled = false
  const showActionRow = event.status === 'active' || event.is_joined
  const ytId = youtubeVideoId(event.youtube_url)
  const surfaceMixText = surfaceAnalysis?.summary.length
    ? surfaceAnalysis.summary.map(item => `${item.percent}% ${item.label.toLowerCase()}`).join(' - ')
    : null
  const showSurfaceSection = Boolean(event.activity.gpx_url && (surfaceLoading || surfaceChecked || surfaceAnalysis?.summary.length))
  if (cancelled) {
    actionLabel = 'Event Cancelled'
    actionDisabled = true
  } else if (past && !event.is_joined) {
    actionLabel = 'Event Ended'
    actionDisabled = true
  } else if (event.is_joined) {
    actionLabel = 'Leave Event'
    actionStyle = styles.leaveBtn
    actionLabelStyle = styles.leaveActionLabel
    actionFn    = leave
  } else if (event.is_full) {
    actionLabel = 'Event Full'
    actionDisabled = true
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
      {/* Full-screen image modal */}
      {event?.image_url && (
        <Modal visible={imageModal} transparent animationType="fade" onRequestClose={() => setImageModal(false)}>
          <Pressable style={styles.imgOverlay} onPress={() => setImageModal(false)}>
            <Image source={{ uri: event.image_url }} style={styles.imgFull} resizeMode="contain" />
            <Pressable style={styles.imgClose} onPress={() => setImageModal(false)}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </Pressable>
        </Modal>
      )}
      <Modal visible={!!zoomAvatar} transparent animationType="fade" onRequestClose={() => setZoomAvatar(null)}>
        <Pressable style={styles.imgOverlay} onPress={() => setZoomAvatar(null)}>
          {zoomAvatar ? <Image source={{ uri: zoomAvatar }} style={styles.imgFull} resizeMode="contain" /> : null}
          <Pressable style={styles.imgClose} onPress={() => setZoomAvatar(null)}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
        </Pressable>
      </Modal>
      <ScrollView
        ref={scrollRef}
        scrollEnabled={!mapEnabled}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + keyboardHeight }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={palette.text} />
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {!isOrg && (
              <Pressable style={styles.shareBtn} onPress={() => reportContent('event', event.id)}>
                <Ionicons name="flag-outline" size={20} color={palette.text} />
              </Pressable>
            )}
            <Pressable style={styles.shareBtn} onPress={shareEvent}>
              <Ionicons name="share-outline" size={20} color={palette.text} />
            </Pressable>
          </View>
        </View>

        {/* Cover image */}
        {event.image_url ? (
          <Pressable onPress={() => setImageModal(true)}>
            <Image source={{ uri: event.image_url }} style={styles.coverImage} resizeMode="cover" />
          </Pressable>
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={{ fontSize: 56 }}>{emoji}</Text>
          </View>
        )}

        {/* Moment image or upload button */}
        {(() => {
          const endedAt = new Date(event.schedule.start_at).getTime() + (event.schedule.duration_minutes ?? 60) * 60000
          const withinWindow = past && (Date.now() - endedAt) < 48 * 3600000
          if (event.moment_image_url) {
            return (
              <View style={styles.momentSection}>
                <Text style={styles.momentLabel}>📸 Moment</Text>
                <Image source={{ uri: event.moment_image_url }} style={styles.momentImage} resizeMode="cover" />
                {isOrg && withinWindow && (
                  <Pressable style={styles.momentReplaceBtn} onPress={pickAndUploadMoment} disabled={momentUploading}>
                    <Ionicons name="camera-outline" size={14} color={palette.textDim} />
                    <Text style={styles.momentReplaceText}>{momentUploading ? 'Uploading…' : 'Replace'}</Text>
                  </Pressable>
                )}
              </View>
            )
          }
          if (isOrg && withinWindow) {
            return (
              <Pressable style={styles.momentUploadBtn} onPress={pickAndUploadMoment} disabled={momentUploading}>
                {momentUploading
                  ? <ActivityIndicator size="small" color={palette.accent} />
                  : <>
                      <Ionicons name="camera-outline" size={20} color={palette.accent} />
                      <Text style={styles.momentUploadText}>Add Moment</Text>
                    </>
                }
              </Pressable>
            )
          }
          return null
        })()}

        {/* Header */}
        <View style={styles.section}>
          <View style={styles.badgeRow}>
            <View style={styles.catBadge}>
              <Text style={styles.catBadgeText}>{emoji} {event.category.label}</Text>
            </View>
            {cancelled && <View style={styles.cancelBadge}><Text style={styles.cancelBadgeText}>Cancelled</Text></View>}
            {event.is_full && !cancelled && <View style={styles.fullBadge}><Text style={styles.fullBadgeText}>Full</Text></View>}
            {event.is_joined && <View style={styles.joinedBadge}><Text style={styles.joinedBadgeText}>✓ Going</Text></View>}
            {past && !cancelled && <View style={styles.pastBadge}><Text style={styles.pastBadgeText}>Past</Text></View>}
          </View>
          <Text style={styles.title}>{event.title}</Text>
          {event.skill_level && (
            <Text style={styles.skillLevel}>Level: {event.skill_level}</Text>
          )}
        </View>

        {/* Details */}
        <View style={styles.card}>
          <DetailRow icon="calendar-outline" primary={formatDate(event.schedule.start_at)} />
          <DetailRow icon="time-outline" primary={
            formatTime(event.schedule.start_at) +
            (event.schedule.duration_minutes ? ` · ${event.schedule.duration_minutes} min` : '')
          } />
          {event.location.lat != null && event.location.lng != null && !cancelled && !past && (
            <WeatherBadge
              lat={event.location.lat}
              lng={event.location.lng}
              isoDate={event.schedule.start_at.slice(0, 10)}
              hour={new Date(event.schedule.start_at).getHours()}
            />
          )}
          {event.location.address ? (
            <DetailRow icon="location-outline" primary={event.location.address} />
          ) : null}
          <Pressable disabled={event.participants_count <= 0} onPress={scrollToParticipants}>
            <DetailRow icon="people-outline" primary={
              `${event.participants_count} joined` +
              (event.max_participants ? ` · max ${event.max_participants}` : '')
            } />
          </Pressable>
          {(activityDistanceKm != null || activityElevGain != null || event.activity.pace) ? (
            <DetailRow
              icon="flash-outline"
              iconColor={palette.accent}
              primary={
                playStats
                  ? `${playStats.distanceKm} km · ↑${playStats.elevGain} m`
                  : [
                      activityDistanceKm != null && `${activityDistanceKm} km`,
                      activityElevGain != null && `↑${activityElevGain} m`,
                      event.activity.pace           && `⏱ ${event.activity.pace}`,
                    ].filter(Boolean).join(' · ')
              }
            />
          ) : null}
          {(activityMaxGrade != null || activityMaxDowngrade != null) ? (
            <DetailRow
              icon="trending-up-outline"
              iconColor="#58beff"
              primary={[
                activityMaxGrade != null && `▲ ${activityMaxGrade}%`,
                activityMaxDowngrade != null && `▼ ${Math.abs(activityMaxDowngrade)}%`,
              ].filter(Boolean).join('  ')}
            />
          ) : null}
          {activityProfileStats ? (
            <DetailRow
              icon="trail-sign-outline"
              iconColor="#58beff"
              primary={`Uphill ${activityProfileStats.uphillKm} km · Downhill ${activityProfileStats.downhillKm} km`}
            />
          ) : null}
          {event.views_count > 0 ? (
            <DetailRow icon="eye-outline" primary={`${event.views_count} seen`} />
          ) : null}
          {event.activity.gpx_url ? (
            <Pressable style={styles.gpxActionRow} onPress={openGpxRoute}>
              <Ionicons name="map-outline" size={16} color={gpxError ? '#ff6b6b' : palette.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={styles.detailPrimary}>
                  {gpxLoading ? 'Loading GPX route...' : gpxError ? 'GPX route attached' : 'GPX route attached'}
                </Text>
                <Text style={styles.detailSecondary}>
                  {gpxError ? 'Tap to open file' : 'Tap to open or download'}
                </Text>
              </View>
              <Ionicons name="download-outline" size={17} color={palette.accent} />
            </Pressable>
          ) : null}
          {event.is_private ? (
            <DetailRow icon="lock-closed-outline" primary="Private event" />
          ) : null}
        </View>

        {/* Map */}
        {event.location.lat != null && event.location.lng != null && (
          <EventMapCard
            lat={event.location.lat}
            lng={event.location.lng}
            startAt={event.schedule.start_at}
            emoji={CATEGORY_EMOJI[event.category.value] ?? '📍'}
            elevationSegments={coloredSegments}
            surfaceSegments={surfaceAnalysis?.segments}
            participants={livePositions}
            onClusterTap={setClusterListParticipants}
            viewersCount={viewersCount}
            onApplausePress={sendApplause}
            hasApplauded={hasApplauded}
            playProgress={isAnimating ? playProgress : null}
            playMilestone={isAnimating ? playMilestone : null}
            playState={gpxTrack.length >= 2 ? playState : undefined}
            onPlayToggle={gpxTrack.length >= 2 ? handlePlayToggle : undefined}
            playSpeed={playSpeed}
            onSpeedToggle={toggleSpeed}
            onMapEnabledChange={setMapEnabled}
            loading={gpxLoading || surfaceLoading}
          />
        )}

        {livePositions.length > 0 && gpxTrack.length >= 2 && (
          <LiveProgressBar track={gpxTrack} participants={livePositions} onGroupTap={setClusterListParticipants} />
        )}

        {showSurfaceSection ? (
          <View style={styles.surfaceSection}>
            <Text style={styles.surfaceMixText}>
              Surface mix:{' '}
              <Text style={styles.surfaceMixMuted}>
                {surfaceMixText ?? (surfaceLoading ? 'checking road surface...' : 'surface data unavailable')}
              </Text>
            </Text>
            {surfaceAnalysis?.summary.length ? (
              <View style={styles.surfaceGrid}>
                {surfaceAnalysis.summary.map(item => (
                  <View key={item.kind} style={styles.surfaceCard}>
                    <View style={styles.surfaceLabelRow}>
                      <View style={[styles.surfaceSwatch, { backgroundColor: item.color }]} />
                      <Text style={styles.surfaceLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>{item.label}</Text>
                    </View>
                    <Text style={styles.surfaceMeta} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{item.distanceKm} km - {item.percent}%</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Elevation profile */}
        {elevationProfile.length >= 2 && (
          <View style={{ paddingHorizontal: spacing.md }}>
            <ElevationChart profile={elevationProfile} progress={isAnimating ? playProgress : null} onScrub={handleScrub} />
          </View>
        )}

        {gpxTrack.length > 0 && (
          <View style={{ paddingHorizontal: spacing.md }}>
            <WikiPhotosStrip track={gpxTrack} />
          </View>
        )}

        {/* Description */}
        {event.description ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>About</Text>
            <Text style={styles.description} selectable>{event.description}</Text>
          </View>
        ) : null}

        {/* Read more link */}
        {event.link_url ? (
          <Pressable
            style={styles.readMoreBtn}
            onPress={() => event.link_url && Linking.openURL(event.link_url)}
          >
            <Text style={styles.readMoreText}>Read more…</Text>
            <Ionicons name="open-outline" size={16} color={palette.accent} />
          </Pressable>
        ) : null}

        {/* YouTube */}
        {event.youtube_url ? (
          <View style={styles.card}>
            <View style={styles.videoHeader}>
              <Ionicons name="logo-youtube" size={18} color="#FF0000" />
              <Text style={styles.cardLabel}>Video</Text>
            </View>
            {ytId ? (
              youtubeOpen ? (
                <View style={styles.ytPlayer}>
                  <WebView
                    source={{ html: youtubeEmbedHtml(ytId), baseUrl: 'https://fitmeet.fit' }}
                    originWhitelist={['https://*', 'about:blank']}
                    javaScriptEnabled
                    domStorageEnabled
                    mediaPlaybackRequiresUserAction={false}
                    allowsFullscreenVideo
                    allowsInlineMediaPlayback
                    setSupportMultipleWindows={false}
                    mixedContentMode="always"
                    sharedCookiesEnabled
                    thirdPartyCookiesEnabled
                    userAgent="Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
                    style={{ flex: 1, backgroundColor: '#000' }}
                  />
                </View>
              ) : (
                <Pressable onPress={() => setYoutubeOpen(true)} style={styles.ytThumb}>
                  <Image
                    source={{ uri: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                  />
                  <View style={styles.ytPlayBtn}>
                    <Ionicons name="play" size={28} color="#fff" />
                  </View>
                </Pressable>
              )
            ) : null}
            <Pressable onPress={() => event.youtube_url && Linking.openURL(event.youtube_url)}>
              <Text style={styles.ytLink}>Open on YouTube</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.card}>
          <Pressable style={styles.cardHeader} onPress={() => setShowWall((value) => !value)}>
            <View style={styles.wallHeader}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={palette.accent} />
              <Text style={styles.cardLabel}>Event Wall{commentCount > 0 ? ` (${commentCount})` : ''}</Text>
            </View>
            <Ionicons
              name={showWall ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={palette.textDim}
            />
          </Pressable>

          {showWall && (
            <View style={styles.wallBody}>
              {!canAccessWall ? (
                <Text style={styles.wallHint}>Join this event to unlock the Event Wall.</Text>
              ) : (
                <>
                  {commentsLoading ? (
                    <ActivityIndicator color={palette.accent} style={{ paddingVertical: 8 }} />
                  ) : comments.length === 0 ? (
                    <Text style={styles.wallHint}>No comments yet. Start the conversation.</Text>
                  ) : (
                    <View style={styles.commentList}>
                        {comments.map((comment) => (
                          <View key={comment.id} style={styles.commentRow}>
                            <Avatar user={comment.user} size={34} />
                            <View style={styles.commentBubble}>
                            <View style={styles.commentMetaRow}>
                              <Text style={styles.commentAuthor}>{comment.user.name}</Text>
                              <Text style={styles.commentTime}>{formatTime(comment.created_at)}</Text>
                            </View>
                              <Text style={styles.commentBody}>{comment.body}</Text>
                            </View>
                            {comment.can_delete && (
                              pendingDeleteCommentId === comment.id ? (
                                <View style={styles.commentDeleteConfirm}>
                                  <Text style={styles.commentDeleteConfirmText}>Delete?</Text>
                                  <Pressable onPress={() => deleteComment(comment.id)} hitSlop={8} style={styles.commentDeleteConfirmBtn}>
                                    <Text style={styles.commentDeleteConfirmBtnText}>Delete</Text>
                                  </Pressable>
                                  <Pressable onPress={() => setPendingDeleteCommentId(null)} hitSlop={8} style={styles.commentDeleteCancelBtn}>
                                    <Text style={styles.commentDeleteCancelBtnText}>Cancel</Text>
                                  </Pressable>
                                </View>
                              ) : (
                                <Pressable onPress={() => setPendingDeleteCommentId(comment.id)} hitSlop={8} style={styles.commentDeleteBtn}>
                                  <Ionicons name="trash-outline" size={15} color="#f87171" />
                                </Pressable>
                              )
                            )}
                            {!comment.can_delete && (
                              <Pressable onPress={() => reportContent('comment', comment.id)} hitSlop={8} style={styles.commentDeleteBtn}>
                                <Ionicons name="flag-outline" size={15} color={palette.textDim} />
                              </Pressable>
                            )}
                          </View>
                        ))}
                      </View>
                  )}

                  <View style={styles.commentComposer}>
                    <View style={styles.commentInputWrap}>
                      {mentionSuggestions.length > 0 && (
                        <View style={styles.mentionMenu}>
                          {mentionSuggestions.map((participant) => (
                            <Pressable
                              key={participant.id}
                              style={styles.mentionOption}
                              onPress={() => insertMention(participant)}
                            >
                              <Avatar user={participant} size={28} />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.mentionName}>{participant.name}</Text>
                              </View>
                            </Pressable>
                          ))}
                        </View>
                      )}
                      <TextInput
                        style={styles.commentInput}
                        value={commentDraft}
                        onChangeText={(text) => {
                          setCommentDraft(text)
                          setSelectedMentions((prev) => prev.filter((mention) => text.includes(`@${mention.name}`)))
                        }}
                        onSelectionChange={(event) => setCommentSelection(event.nativeEvent.selection)}
                        onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)}
                        selection={commentSelection}
                        placeholder="Write a comment..."
                        placeholderTextColor={palette.textDim}
                        multiline
                        maxLength={1000}
                      />
                    </View>
                    <Pressable
                      style={[styles.commentSendBtn, (!commentDraft.trim() || commentSending) && styles.disabledBtn]}
                      onPress={sendComment}
                      disabled={!commentDraft.trim() || commentSending}
                    >
                      {commentSending
                        ? <ActivityIndicator size="small" color="#041109" />
                        : <Ionicons name="send" size={16} color="#041109" />
                      }
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          )}
        </View>

        {/* Organizer */}
        {event.organizer ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Organizer</Text>
            <Pressable style={styles.personRow} onPress={() => router.push(`/user/${event.organizer!.id}` as never)}>
              <Avatar user={event.organizer} size={36} />
              <Text style={styles.personName}>{event.organizer.name}</Text>
              {isOrg && (
                <View style={styles.youBadge}><Text style={styles.youBadgeText}>You</Text></View>
              )}
            </Pressable>
          </View>
        ) : null}

        {/* Participants */}
        {event.participants.length > 0 && (
          <View
            style={styles.card}
            onLayout={(eventLayout) => setParticipantSectionY(eventLayout.nativeEvent.layout.y)}
          >
            <Pressable style={styles.cardHeader} onPress={() => setShowParticipants(v => !v)}>
              <Text style={styles.cardLabel}>Checked in {checkedInCount}/{event.participants_count}</Text>
              <Ionicons
                name={showParticipants ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={palette.textDim}
              />
            </Pressable>
            {showParticipants && (
              <View style={styles.participantList}>
                {event.participants.map(p => {
                  const live = livePositions.find(lp => lp.id === p.id)
                  return (
                    <Pressable key={p.id} style={styles.participantRow} onPress={() => router.push(`/user/${p.id}` as never)}>
                      <Avatar user={p} size={34} />
                      <View style={styles.participantInfo}>
                        <Text style={styles.participantName} numberOfLines={1}>{p.name}</Text>
                        <Text style={p.checked_in_at ? styles.participantChecked : styles.participantWaiting}>
                          {live ? `📍 Live${live.speed_kmh != null ? ` · ${live.speed_kmh.toFixed(1)} km/h` : ''}`
                            : p.checked_in_at ? `Checked in · ${formatTime(p.checked_in_at)}` : 'Waiting'}
                        </Text>
                      </View>
                    </Pressable>
                  )
                })}
              </View>
            )}
          </View>
        )}

        {/* Check-in */}
        {event.is_joined && !cancelled && (checkInAvailable || event.checked_in_at) && (
          <View style={styles.checkInCard}>
            <View style={styles.checkInCardRow}>
              <View style={styles.checkInCopy}>
                <Text style={styles.checkInTitle}>{event.checked_in_at ? 'Checked in' : 'Ready to check in?'}</Text>
                <Text style={styles.checkInSub}>
                  {event.checked_in_at ? `You checked in at ${formatTime(event.checked_in_at)}.` : 'Mark that you made it to this event.'}
                </Text>
              </View>
              {event.checked_in_at ? (
                <View style={styles.checkedChip}>
                  <Ionicons name="checkmark-circle" size={16} color={palette.accent} />
                  <Text style={styles.checkedChipText}>Done</Text>
                </View>
              ) : (
                <Pressable style={[styles.checkInBtn, checkingIn && styles.disabledBtn]} onPress={checkIn} disabled={checkingIn}>
                  {checkingIn ? (
                    <ActivityIndicator size="small" color="#041109" />
                  ) : (
                    <Text style={styles.checkInBtnText}>Check in</Text>
                  )}
                </Pressable>
              )}
            </View>
            {event.checked_in_at && event.activity.gpx_url != null && (
              <Pressable
                style={styles.notifyJoinRow}
                onPress={() => (event.live_sharing_enabled ? stopLiveLocationSharing() : setShowLocationConsentModal(true))}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifyJoinLabel}>Sharing location</Text>
                  <Text style={styles.notifyJoinSub}>Let other checked-in participants see you live on the map.</Text>
                </View>
                <View style={[styles.toggle, event.live_sharing_enabled && styles.toggleOn]}>
                  <View style={[styles.toggleThumb, event.live_sharing_enabled && styles.toggleThumbOn]} />
                </View>
              </Pressable>
            )}
          </View>
        )}

        {/* Organizer actions */}
        {(isOrg || me?.is_admin) && !cancelled && (
          <View style={{ gap: spacing.sm }}>
            {isOrg && (
              <Pressable
                style={styles.editBtn}
                onPress={() => router.push(`/event/edit/${event.id}` as never)}
              >
                <Ionicons name="create-outline" size={16} color={palette.accent} />
                <Text style={styles.editBtnText}>Edit Event</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.cancelEventBtn}
              onPress={cancelEvent}
              disabled={acting}
            >
              <Ionicons name="close-circle-outline" size={16} color="#f87171" />
              <Text style={styles.cancelEventBtnText}>Cancel Event</Text>
            </Pressable>
          </View>
        )}

        {/* Join / Leave + reminders */}
        {showActionRow && (
          <View style={styles.actionRow}>
            <Pressable
              style={[actionStyle, styles.actionFlex, (actionDisabled || acting) && styles.disabledBtn]}
              onPress={actionFn}
              disabled={actionDisabled || acting}
            >
              {acting ? (
                <ActivityIndicator size="small" color={event.is_joined ? '#f87171' : '#041109'} />
              ) : (
                <Text style={actionLabelStyle}>{actionLabel}</Text>
              )}
            </Pressable>
            {event.is_joined && !cancelled && !past ? (
              <Pressable
                style={[styles.reminderBtn, activeOffsets.length > 0 && styles.reminderBtnActive]}
                onPress={openReminderModal}
                disabled={acting}
              >
                <Ionicons
                  name={activeOffsets.length > 0 ? 'notifications' : 'notifications-outline'}
                  size={20}
                  color={activeOffsets.length > 0 ? palette.accent : palette.textMuted}
                />
              </Pressable>
            ) : null}
          </View>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
      <Modal visible={showReminderModal} transparent animationType="slide" onRequestClose={closeReminderModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeReminderModal}>
          <Pressable style={styles.reminderModal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <Ionicons name="notifications-outline" size={22} color={palette.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{event?.is_joined ? 'Event reminder' : 'Successfully joined!'}</Text>
                <Text style={styles.modalSubtitle}>Want a reminder before it starts?</Text>
              </View>
              <Pressable style={styles.modalClose} onPress={closeReminderModal}>
                <Ionicons name="close" size={20} color={palette.textMuted} />
              </Pressable>
            </View>

            <View style={styles.reminderOptions}>
              {REMINDER_OPTIONS.map((option) => {
                const active = selectedOffsets.has(option.value)
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.reminderOption, active && styles.reminderOptionActive]}
                    onPress={() => toggleReminder(option.value)}
                  >
                    <Ionicons
                      name={active ? 'checkmark-circle' : 'notifications-outline'}
                      size={15}
                      color={active ? palette.accent : palette.textMuted}
                    />
                    <Text style={[styles.reminderOptionText, active && styles.reminderOptionTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            {event?.is_joined && (
              <Pressable style={styles.notifyJoinRow} onPress={toggleNotifyOnJoin}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifyJoinLabel}>Notify me when others join</Text>
                  <Text style={styles.notifyJoinSub}>Get a push when a new participant joins this event.</Text>
                </View>
                <View style={[styles.toggle, notifyOnJoin && styles.toggleOn]}>
                  <View style={[styles.toggleThumb, notifyOnJoin && styles.toggleThumbOn]} />
                </View>
              </Pressable>
            )}

            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondary} onPress={closeReminderModal}>
                <Text style={styles.modalSecondaryText}>Skip</Text>
              </Pressable>
              <Pressable style={[styles.modalPrimary, settingReminders && styles.disabledBtn]} onPress={saveReminders} disabled={settingReminders}>
                {settingReminders ? (
                  <ActivityIndicator size="small" color="#041109" />
                ) : (
                  <Text style={styles.modalPrimaryText}>{selectedOffsets.size === 0 ? 'Clear Reminders' : 'Save Reminders'}</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showSupportModal} transparent animationType="fade" onRequestClose={() => setShowSupportModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowSupportModal(false)}>
          <Pressable style={styles.reminderModal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIcon, { backgroundColor: 'rgba(246,198,91,0.12)', borderColor: 'rgba(246,198,91,0.28)' }]}>
                <Ionicons name="beer-outline" size={22} color="#f6c65b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>You're in! 🎉</Text>
                <Text style={styles.modalSubtitle}>FitMeet stays free — support it if you feel like it.</Text>
              </View>
              <Pressable style={styles.modalClose} onPress={() => setShowSupportModal(false)}>
                <Ionicons name="close" size={20} color={palette.textMuted} />
              </Pressable>
            </View>
            <SupportFitMeetCard
              title="Buy me a beer"
              subtitle="Every coffee or beer helps keep this app running and improving."
              onPurchased={() => setShowSupportModal(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showLocationConsentModal} transparent animationType="slide" onRequestClose={() => setShowLocationConsentModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowLocationConsentModal(false)}>
          <Pressable style={styles.reminderModal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <Ionicons name="navigate-outline" size={22} color={palette.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Share your live location?</Text>
                <Text style={styles.modalSubtitle}>
                  See everyone on the map during this event — works even while your phone is locked or in your pocket.
                </Text>
              </View>
              <Pressable style={styles.modalClose} onPress={() => setShowLocationConsentModal(false)}>
                <Ionicons name="close" size={20} color={palette.textMuted} />
              </Pressable>
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondary} onPress={() => setShowLocationConsentModal(false)}>
                <Text style={styles.modalSecondaryText}>Not now</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimary, startingLiveTracking && styles.disabledBtn]}
                onPress={beginLiveLocationSharing}
                disabled={startingLiveTracking}
              >
                {startingLiveTracking ? (
                  <ActivityIndicator size="small" color="#041109" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Share location</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showBatteryOptModal} transparent animationType="fade" onRequestClose={() => setShowBatteryOptModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowBatteryOptModal(false)}>
          <Pressable style={styles.reminderModal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <Ionicons name="battery-charging-outline" size={22} color={palette.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Keep tracking reliable</Text>
                <Text style={styles.modalSubtitle}>
                  Some Android phones pause apps in the background to save battery. Exempt FitMeet so your location keeps updating for the group.
                </Text>
              </View>
              <Pressable style={styles.modalClose} onPress={() => setShowBatteryOptModal(false)}>
                <Ionicons name="close" size={20} color={palette.textMuted} />
              </Pressable>
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondary} onPress={() => setShowBatteryOptModal(false)}>
                <Text style={styles.modalSecondaryText}>Skip</Text>
              </Pressable>
              <Pressable
                style={styles.modalPrimary}
                onPress={() => {
                  openAndroidBatteryOptimizationSettings()
                  setShowBatteryOptModal(false)
                }}
              >
                <Text style={styles.modalPrimaryText}>Open settings</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!clusterListParticipants} transparent animationType="fade" onRequestClose={() => setClusterListParticipants(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setClusterListParticipants(null)}>
          <Pressable style={styles.reminderModal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <Ionicons name="people-outline" size={22} color={palette.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{clusterListParticipants?.length ?? 0} people here</Text>
              </View>
              <Pressable style={styles.modalClose} onPress={() => setClusterListParticipants(null)}>
                <Ionicons name="close" size={20} color={palette.textMuted} />
              </Pressable>
            </View>
            <View style={styles.participantList}>
              {clusterListParticipants?.map((p) => (
                <Pressable key={p.id} style={styles.participantRow} onPress={() => router.push(`/user/${p.id}` as never)}>
                  <Avatar user={p} size={34} />
                  <View style={styles.participantInfo}>
                    <Text style={styles.participantName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.participantChecked}>
                      {p.speed_kmh != null ? `${p.speed_kmh.toFixed(1)} km/h` : 'Live'}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function DetailRow({ icon, primary, secondary, iconColor }: {
  icon: string; primary: string; secondary?: string; iconColor?: string
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon as 'flash-outline'} size={16} color={iconColor ?? palette.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailPrimary}>{primary}</Text>
        {secondary ? <Text style={styles.detailSecondary}>{secondary}</Text> : null}
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: palette.bg },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { gap: spacing.md },
  errorText: { color: palette.textMuted, fontSize: 15 },

  topBar: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: palette.panel,
    alignItems: 'center', justifyContent: 'center',
  },
  shareBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: palette.panel,
    alignItems: 'center', justifyContent: 'center',
  },

  momentSection: { marginHorizontal: spacing.md, marginTop: 8 },
  momentLabel: { color: palette.textDim, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 6 },
  momentImage: { width: '100%', height: 200, borderRadius: 14 },
  momentReplaceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-end', marginTop: 6, paddingVertical: 4, paddingHorizontal: 8,
    borderRadius: 8, borderWidth: 1, borderColor: palette.line,
  },
  momentReplaceText: { color: palette.textDim, fontSize: 11 },
  momentUploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: spacing.md, marginTop: 8,
    paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(108,255,47,0.3)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(108,255,47,0.05)',
  },
  momentUploadText: { color: palette.accent, fontSize: 14, fontWeight: '700' },
  coverPickerModal: {
    marginHorizontal: spacing.md,
    borderRadius: 24,
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: palette.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  coverPickerFrame: {
    height: 300,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#020403',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  coverPickerImage: { width: '100%', height: '100%' },
  coverPickerTarget: {
    position: 'absolute',
    width: 24,
    height: 24,
    marginLeft: -12,
    marginTop: -12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: palette.accent,
    backgroundColor: 'rgba(57,255,20,0.18)',
  },
  coverPreviewBlock: { gap: 8 },
  coverPreviewLabel: {
    color: palette.textDim,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  coverPreviewImage: { width: '100%', height: 150, borderRadius: 14 },

  coverImage: { marginHorizontal: spacing.md, borderRadius: 16, height: 220 },
  imgOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  imgFull:    { width: '100%', height: '80%' },
  imgClose:   { position: 'absolute', top: 50, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  coverPlaceholder: {
    height: 160, marginHorizontal: spacing.md, borderRadius: 16,
    backgroundColor: palette.panel,
    alignItems: 'center', justifyContent: 'center',
  },

  section:  { paddingHorizontal: spacing.md, gap: spacing.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  catBadge:       { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(57,255,20,0.1)', borderWidth: 1, borderColor: 'rgba(57,255,20,0.3)' },
  catBadgeText:   { color: palette.accent, fontSize: 12, fontWeight: '700' },
  cancelBadge:    { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)' },
  cancelBadgeText:{ color: '#f87171', fontSize: 12, fontWeight: '700' },
  fullBadge:      { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(251,146,60,0.1)', borderWidth: 1, borderColor: 'rgba(251,146,60,0.3)' },
  fullBadgeText:  { color: '#fb923c', fontSize: 12, fontWeight: '700' },
  joinedBadge:    { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(57,255,20,0.15)', borderWidth: 1, borderColor: palette.accent },
  joinedBadgeText:{ color: palette.accent, fontSize: 12, fontWeight: '700' },
  pastBadge:      { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: palette.panelRaised, borderWidth: 1, borderColor: palette.line },
  pastBadgeText:  { color: palette.textMuted, fontSize: 12, fontWeight: '700' },

  title:      { color: palette.text, fontSize: 24, fontWeight: '800', lineHeight: 30 },
  skillLevel: { color: palette.textMuted, fontSize: 13, textTransform: 'capitalize' },

  card: {
    marginHorizontal: spacing.md,
    backgroundColor: palette.panel,
    borderRadius: 18, borderWidth: 1, borderColor: palette.line,
    padding: spacing.md, gap: 10,
  },
  readMoreBtn: {
    marginHorizontal: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(108,255,47,0.35)',
    backgroundColor: 'rgba(108,255,47,0.05)',
    paddingVertical: 14,
  },
  readMoreText: { color: palette.accent, fontSize: 14, fontWeight: '700' },
  cardLabel: { color: palette.text, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  detailRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  gpxActionRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 2 },
  detailPrimary:  { color: palette.text, fontSize: 15, lineHeight: 21 },
  detailSecondary:{ color: palette.textMuted, fontSize: 14 },

  surfaceSection: { paddingHorizontal: spacing.md, gap: 8 },
  surfaceMixText: { color: palette.text, fontSize: 13, fontWeight: '900' },
  surfaceMixMuted: { color: palette.textMuted, fontWeight: '700' },
  surfaceGrid: { flexDirection: 'row', flexWrap: 'nowrap', gap: 6 },
  surfaceCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: palette.panel,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 8,
  },
  surfaceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  surfaceSwatch: { width: 18, height: 7, borderRadius: 999 },
  surfaceLabel: { color: palette.text, fontSize: 10, fontWeight: '800', flex: 1 },
  surfaceMeta: { color: palette.textMuted, fontSize: 9.5, marginTop: 4 },

  description: { color: palette.textMuted, fontSize: 14, lineHeight: 22 },

  ytThumb: {
    height: 200, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#000', alignItems: 'center', justifyContent: 'center',
  },
  ytPlayer: { height: 220, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' },
  videoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wallHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ytPlayBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  ytLink: { color: '#FF4B4B', fontSize: 13, fontWeight: '800' },

  personRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personName:  { color: palette.text, fontSize: 15, fontWeight: '700', flex: 1 },
  youBadge:    { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: 'rgba(57,255,20,0.1)', borderWidth: 1, borderColor: palette.accent },
  youBadgeText:{ color: palette.accent, fontSize: 11, fontWeight: '700' },

  participantList: { gap: 10 },
  participantRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  participantInfo: { flex: 1, gap: 2 },
  participantName: { color: palette.text, fontSize: 13, fontWeight: '700' },
  participantChecked: { color: palette.accent, fontSize: 12, fontWeight: '700' },
  participantWaiting: { color: palette.textDim, fontSize: 12, fontWeight: '600' },

  wallBody: { gap: 12 },
  wallHint: { color: palette.textMuted, fontSize: 13, lineHeight: 20 },
  commentList: { gap: 10 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  commentBubble: {
    flex: 1,
    backgroundColor: palette.panelRaised,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  commentMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  commentAuthor: { color: palette.text, fontSize: 13, fontWeight: '800', flex: 1 },
  commentTime: { color: palette.textDim, fontSize: 11, fontWeight: '600' },
  commentBody: { color: palette.textMuted, fontSize: 13, lineHeight: 20 },
  commentDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentDeleteConfirm: {
    gap: 6,
    alignItems: 'flex-end',
    paddingTop: 2,
  },
  commentDeleteConfirmText: {
    color: palette.textDim,
    fontSize: 11,
    fontWeight: '700',
  },
  commentDeleteConfirmBtn: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.28)',
  },
  commentDeleteConfirmBtnText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '800',
  },
  commentDeleteCancelBtn: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: palette.panelRaised,
    borderWidth: 1,
    borderColor: palette.line,
  },
  commentDeleteCancelBtnText: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  commentComposer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  commentInputWrap: { flex: 1, gap: 8 },
  commentInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panelRaised,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: palette.text,
    fontSize: 14,
  },
  mentionMenu: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panelRaised,
    overflow: 'hidden',
  },
  mentionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  mentionName: { color: palette.text, fontSize: 13, fontWeight: '700' },
  commentSendBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  joinBtn: {
    height: 56, borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  leaveBtn: {
    height: 56, borderRadius: 18,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  actionRow: { marginHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionFlex: { flex: 1 },
  reminderBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderBtnActive: {
    borderColor: palette.accent,
    backgroundColor: 'rgba(57,255,20,0.1)',
  },
  disabledBtn: { opacity: 0.45 },
  actionLabel: { color: '#041109', fontSize: 16, fontWeight: '800' },
  leaveActionLabel: { color: '#f87171', fontSize: 16, fontWeight: '800' },

  checkInCard: {
    marginHorizontal: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(57,255,20,0.28)',
    backgroundColor: 'rgba(57,255,20,0.07)',
    padding: spacing.md,
    gap: 10,
  },
  checkInCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkInCopy: { flex: 1, gap: 3 },
  checkInTitle: { color: palette.text, fontSize: 15, fontWeight: '800' },
  checkInSub: { color: palette.textMuted, fontSize: 12, lineHeight: 17 },
  checkInBtn: {
    minWidth: 92,
    height: 42,
    borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  checkInBtnText: { color: '#041109', fontSize: 13, fontWeight: '800' },
  checkedChip: {
    height: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(57,255,20,0.35)',
    backgroundColor: 'rgba(57,255,20,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
  },
  checkedChipText: { color: palette.accent, fontSize: 12, fontWeight: '800' },

  editBtn: {
    marginHorizontal: spacing.md,
    height: 48, borderRadius: 16,
    borderWidth: 1, borderColor: palette.accent,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  editBtnText: { color: palette.accent, fontSize: 14, fontWeight: '700' },
  cancelEventBtn: {
    marginHorizontal: spacing.md,
    height: 48, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  cancelEventBtnText: { color: '#f87171', fontSize: 14, fontWeight: '700' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  reminderModal: {
    backgroundColor: palette.panel,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.md,
    gap: spacing.md,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(57,255,20,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(57,255,20,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { color: palette.text, fontSize: 18, fontWeight: '800' },
  modalSubtitle: { color: palette.textMuted, fontSize: 13, marginTop: 2 },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: palette.panelRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reminderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  reminderOptionActive: {
    borderColor: palette.accent,
    backgroundColor: 'rgba(57,255,20,0.08)',
  },
  reminderOptionText: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  reminderOptionTextActive: { color: palette.accent },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryText: { color: palette.textMuted, fontSize: 14, fontWeight: '700' },
  modalPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryText: { color: '#041109', fontSize: 14, fontWeight: '800' },
  notifyJoinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  notifyJoinLabel: { color: palette.text, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  notifyJoinSub: { color: palette.textMuted, fontSize: 12, lineHeight: 16 },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.12)',
    padding: 3,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: palette.accent },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.textMuted,
    alignSelf: 'flex-start',
  },
  toggleThumbOn: {
    backgroundColor: '#041109',
    alignSelf: 'flex-end',
  },
})
