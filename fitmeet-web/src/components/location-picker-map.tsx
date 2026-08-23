'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents, useMap, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { TrackSegment } from '@/lib/parse-gpx'
import { weatherCloudStrength, weatherRainStrength, windDirectionLabel, type EventWeather } from '@/lib/weather'

// Fix Leaflet default marker icons (broken in bundlers)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const finishIcon = L.divIcon({
  className: 'fm-finish-marker',
  html: '<div style="display:flex;align-items:center;justify-content:center;font-size:22px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.6));">🏁</div>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
})

const headIcon = L.divIcon({
  className: 'fm-head-marker',
  html: '<div style="width:14px;height:14px;border-radius:999px;background:radial-gradient(circle at 35% 30%, #ff9a8a 0%, #ff2d2d 55%, #8b0000 100%);box-shadow:0 1px 3px rgba(0,0,0,0.5), inset 0 -1px 2px rgba(0,0,0,0.35);"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

function milestoneIcon(km: number, exiting: boolean) {
  return L.divIcon({
    className: 'fm-milestone-marker',
    html: `
      <style>
        @keyframes fmMilestonePopIn { 0%{opacity:0;transform:scale(0.4);} 65%{opacity:1;transform:scale(1.15);} 100%{opacity:1;transform:scale(1);} }
        @keyframes fmMilestonePopOut { 0%{opacity:1;transform:scale(1) translateY(0);} 100%{opacity:0;transform:scale(0.5) translateY(-6px);} }
      </style>
      <div style="width:90px;height:30px;display:flex;align-items:center;justify-content:center;animation:${exiting ? 'fmMilestonePopOut 0.35s ease-in both' : 'fmMilestonePopIn 0.35s cubic-bezier(.34,1.56,.64,1) both'};">
        <span style="background:#0b1120;border:1px solid #39ff14;color:#eafff0;font-weight:800;font-size:12px;padding:4px 10px;border-radius:999px;box-shadow:0 4px 10px rgba(0,0,0,0.45);white-space:nowrap;">${km} km</span>
      </div>
    `,
    iconSize: [90, 30],
    iconAnchor: [45, 44],
  })
}

function staticKmIcon(km: number) {
  return L.divIcon({
    className: 'fm-static-km-marker',
    html: `<div style="width:70px;height:22px;display:flex;align-items:center;justify-content:center;">
      <span style="background:#0b1120;border:1px solid #39ff14;color:#eafff0;font-weight:800;font-size:11px;padding:3px 8px;border-radius:999px;box-shadow:0 2px 6px rgba(0,0,0,0.4);white-space:nowrap;">${km} km</span>
    </div>`,
    iconSize: [70, 22],
    iconAnchor: [35, 32],
  })
}

export interface LiveParticipant {
  id: number
  name: string
  avatar: string | null
  lat: number
  lng: number
  speed_kmh: number | null
  /** Hasn't moved meaningfully in ~60s — shown as a pulsing red ring (approximate safety cue, not a real incident detector). */
  stopped?: boolean
}

function initialFor(name: string) {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

// Icons are cached by content key so an unchanged participant (same avatar,
// speed rounded to the nearest km/h) gets the exact same L.divIcon instance
// back across polls — otherwise every poll tick creates a brand-new icon,
// forcing Leaflet to tear down and rebuild the marker's DOM (setIcon), which
// visibly flashes empty/black for a frame before the background-image repaints.
const participantIconCache = new Map<string, L.DivIcon>()
const clusterIconCache = new Map<number, L.DivIcon>()

function participantIcon(p: LiveParticipant) {
  const speedKey = p.speed_kmh != null ? Math.round(p.speed_kmh) : 'x'
  const key = `${p.id}|${p.avatar ?? ''}|${speedKey}|${p.stopped ? 1 : 0}`
  const cached = participantIconCache.get(key)
  if (cached) return cached

  const ringClass = p.stopped ? ' fm-stopped-ring' : ''
  const borderColor = p.stopped ? '#ff3b30' : '#39ff14'
  const avatarHtml = p.avatar
    ? `<div class="${ringClass.trim()}" style="width:32px;height:32px;border-radius:999px;background:#0b1120;background-image:url('${p.avatar}');background-size:cover;background-position:center;border:2px solid ${borderColor};box-shadow:0 2px 6px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;color:#eafff0;font-weight:800;font-size:12px;">${initialFor(p.name)}</div>`
    : `<div class="${ringClass.trim()}" style="width:32px;height:32px;border-radius:999px;background:#0b1120;border:2px solid ${borderColor};display:flex;align-items:center;justify-content:center;color:#eafff0;font-weight:800;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,0.5);">${initialFor(p.name)}</div>`
  const speedHtml = p.speed_kmh != null
    ? `<div style="margin-top:2px;background:#0b1120;border:1px solid rgba(57,255,20,0.5);color:#eafff0;font-size:9px;font-weight:700;padding:1px 5px;border-radius:999px;white-space:nowrap;">${p.speed_kmh.toFixed(1)} km/h</div>`
    : ''
  const icon = L.divIcon({
    className: 'fm-participant-marker',
    html: `<div style="display:flex;flex-direction:column;align-items:center;">${avatarHtml}${speedHtml}</div>`,
    iconSize: [60, 50],
    iconAnchor: [30, 25],
  })
  participantIconCache.set(key, icon)
  return icon
}

function clusterIcon(count: number) {
  const cached = clusterIconCache.get(count)
  if (cached) return cached
  const icon = L.divIcon({
    className: 'fm-cluster-marker',
    html: `<div style="width:34px;height:34px;border-radius:999px;background:#39ff14;color:#041109;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.5);border:2px solid #0b1120;">${count}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
  clusterIconCache.set(count, icon)
  return icon
}

// Hand-rolled greedy pixel-distance clustering (not a Leaflet plugin — this
// codebase re-implements map logic per platform rather than sharing it, and
// group sizes here are small). Re-clusters on zoom/move since screen-pixel
// distance between two fixed lat/lngs changes with zoom.
function LiveParticipantsLayer({
  participants,
  onClusterTap,
}: {
  participants: LiveParticipant[]
  onClusterTap?: (participants: LiveParticipant[]) => void
}) {
  const map = useMap()
  const [tick, setTick] = useState(0)
  useMapEvents({
    zoomend: () => setTick((t) => t + 1),
    moveend: () => setTick((t) => t + 1),
  })

  const groups = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    tick
    const pts = participants.map((p) => ({ p, pt: map.latLngToContainerPoint([p.lat, p.lng]) }))
    const used = new Array(pts.length).fill(false)
    const result: LiveParticipant[][] = []
    for (let i = 0; i < pts.length; i++) {
      if (used[i]) continue
      const group = [pts[i].p]
      used[i] = true
      for (let j = i + 1; j < pts.length; j++) {
        if (used[j]) continue
        const dx = pts[i].pt.x - pts[j].pt.x
        const dy = pts[i].pt.y - pts[j].pt.y
        if (Math.sqrt(dx * dx + dy * dy) < 40) {
          group.push(pts[j].p)
          used[j] = true
        }
      }
      result.push(group)
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, map, tick])

  return (
    <>
      {groups.map((group) =>
        group.length === 1 ? (
          <Marker key={group[0].id} position={[group[0].lat, group[0].lng]} icon={participantIcon(group[0])} />
        ) : (
          <Marker
            key={group.map((p) => p.id).join('-')}
            position={[
              group.reduce((sum, p) => sum + p.lat, 0) / group.length,
              group.reduce((sum, p) => sum + p.lng, 0) / group.length,
            ]}
            icon={clusterIcon(group.length)}
            eventHandlers={{ click: () => onClusterTap?.(group) }}
          />
        ),
      )}
    </>
  )
}

function segmentPopupText(distanceKm: number, avgGrade: number) {
  const arrow = avgGrade > 0 ? '↑' : avgGrade < 0 ? '↓' : ''
  return `${distanceKm} km · ${arrow}${Math.abs(avgGrade)}%`
}

// Truncates a colored segment list to the first `count` points, splitting the
// segment that straddles the cut so the reveal animation's leading edge lands
// mid-segment instead of always snapping to a full segment boundary.
function revealedSegments(segments: TrackSegment[], count: number): TrackSegment[] {
  const result: TrackSegment[] = []
  let consumed = 0
  for (const seg of segments) {
    if (consumed >= count) break
    const remaining = count - consumed
    if (remaining >= seg.coords.length) {
      result.push(seg)
      consumed += seg.coords.length
    } else {
      // Cut to exactly `remaining` points (not clamped to a 2-point minimum):
      // revealedSegmentsWithHead always appends the interpolated head after
      // this, so clamping up here would overshoot the true cut point by one
      // real track vertex — then appending head (which sits *behind* that
      // overshot vertex) drew a visible one-point "hook" back on itself.
      result.push({ ...seg, coords: seg.coords.slice(0, Math.max(1, remaining)) })
      break
    }
  }
  return result
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function cumulativeDistancesKm(coords: [number, number][]): number[] {
  const cum: number[] = [0]
  for (let i = 1; i < coords.length; i++) {
    cum.push(cum[i - 1] + haversineKm(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]))
  }
  return cum
}

// Maps a 0..1 playback progress to a point on the track by real-world distance
// travelled, not by point count — GPX points aren't evenly spaced (hilly/curvy
// stretches pack in far more points per km than flat/straight ones), so indexing
// by point-count fraction made the play-animation head speed up and stutter on
// dense stretches. Returns the point index just before the target distance plus
// the interpolation fraction into the next point, so the caller can lerp a
// sub-point position and get continuous, constant real-world speed.
function progressToTrackPointer(cumDistKm: number[], progress: number): { index: number; t: number } | null {
  if (cumDistKm.length < 2) return null
  const total = cumDistKm[cumDistKm.length - 1]
  if (total <= 0) return null
  const target = Math.max(0, Math.min(1, progress)) * total
  let lo = 0, hi = cumDistKm.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (cumDistKm[mid] <= target) lo = mid; else hi = mid - 1
  }
  const index = Math.min(lo, cumDistKm.length - 2)
  const segLen = cumDistKm[index + 1] - cumDistKm[index]
  const t = segLen > 0 ? (target - cumDistKm[index]) / segLen : 0
  return { index, t }
}

function lerpCoord(a: [number, number], b: [number, number], t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

// Appends the interpolated head position as an extra vertex so the drawn
// line's leading edge always lands exactly under the head marker, instead of
// snapping to the nearest whole track point.
function revealedSegmentsWithHead(segments: TrackSegment[], count: number, head: [number, number] | null): TrackSegment[] {
  const revealed = revealedSegments(segments, count)
  if (!head || revealed.length === 0) return revealed
  const last = revealed[revealed.length - 1]
  return [...revealed.slice(0, -1), { ...last, coords: [...last.coords, head] }]
}

function computeKmMarkerPoints(coords: [number, number][], stepKm: number) {
  const points: { km: number; pos: [number, number] }[] = []
  let cum = 0
  let next = stepKm
  for (let i = 1; i < coords.length; i++) {
    const [lat1, lng1] = coords[i - 1]
    const [lat2, lng2] = coords[i]
    const segLen = haversineKm(lat1, lng1, lat2, lng2)
    while (segLen > 0 && next <= cum + segLen) {
      const t = (next - cum) / segLen
      points.push({ km: Math.round(next), pos: [lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t] })
      next += stepKm
    }
    cum += segLen
  }
  return points
}

interface Props {
  lat?:             number | null
  lng?:             number | null
  onChange?:        (lat: number, lng: number) => void
  onViewChange?:    (lat: number, lng: number) => void
  onInteractionChange?: (moving: boolean) => void
  track?:           [number, number][]
  coloredSegments?: TrackSegment[]
  elevationSegments?: TrackSegment[]
  surfaceSegments?: TrackSegment[]
  /** 0..1 reveal fraction while the route "play" animation runs. Omit/null for the normal, fully-drawn route. */
  playProgress?:    number | null
  /** Shows a "X km" badge above the play-animation head marker while a distance milestone is being announced. */
  playMilestone?:   { km: number; exiting: boolean } | null
  /** Static (non-animated) route coloring/marker layers — independent toggles, all default except elevation are off. */
  showElevationLayer?: boolean
  showSurfaceLayer?:   boolean
  showKmMarkers?:      boolean
  readOnly?:        boolean
  height?:          number
  weather?:         EventWeather | null
  weatherVariant?:  'default' | 'hub'
  showWindOverlay?: boolean
  showCloudOverlay?: boolean
  showMapLayerControl?: boolean
  radarFrame?: { path: string } | null
  /** Live positions of checked-in, sharing participants — read-only maps only. */
  participants?: LiveParticipant[]
  onClusterTap?: (participants: LiveParticipant[]) => void
}

const LIGHTNING_POSITIONS = [
  { left: '15%', top: '22%' },
  { left: '42%', top: '58%' },
  { left: '68%', top: '30%' },
  { left: '82%', top: '68%' },
  { left: '30%', top: '78%' },
] as const

const MAP_BASE_LAYERS = [
  {
    name: 'Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  },
  {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19,
  },
  {
    name: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap',
    maxZoom: 17,
  },
]

type MapBaseLayerName = (typeof MAP_BASE_LAYERS)[number]['name']

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onChange(e.latlng.lat, e.latlng.lng) })
  return null
}

function ReadOnlyViewSync({
  onViewChange,
  onInteractionChange,
}: {
  onViewChange?: (lat: number, lng: number) => void
  onInteractionChange?: (moving: boolean) => void
}) {
  useMapEvents({
    movestart: () => onInteractionChange?.(true),
    zoomstart: () => onInteractionChange?.(true),
    moveend: (event) => {
      onInteractionChange?.(false)
      const center = event.target.getCenter()
      onViewChange?.(center.lat, center.lng)
    },
    zoomend: (event) => {
      onInteractionChange?.(false)
      const center = event.target.getCenter()
      onViewChange?.(center.lat, center.lng)
    },
  })

  return null
}

function FitTrack({ coords }: { coords: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (coords.length > 1) map.fitBounds(L.latLngBounds(coords), { padding: [20, 20] })
  }, [map, coords])
  return null
}

// Zooms in and re-centers on the play-animation head marker's position for as
// long as this is mounted (i.e. only while the animation is running — the
// surrounding branch swaps back to <FitTrack> once playback ends, which
// naturally restores the full-route view).
function PlayCameraFollow({ position }: { position: [number, number] }) {
  const map = useMap()
  const followZoomRef = useRef<number | null>(null)
  useEffect(() => {
    followZoomRef.current = Math.min(map.getZoom() + 2, 17)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    map.setView(position, followZoomRef.current ?? map.getZoom(), { animate: false })
  }, [map, position])
  return null
}

// Renders a colored elevation segment along with a much wider, near-invisible
// twin underneath it purely to widen the tap/click target — the visible line
// is thin by design, but that makes it hard to hit precisely on a touchscreen.
// Both copies carry the same popup so a hit on either one shows it.
function ColoredSegment({ seg, weight, opacity }: { seg: TrackSegment; weight: number; opacity: number }) {
  const hasInfo = seg.distanceKm != null && seg.avgGrade != null
  return (
    <>
      {hasInfo && (
        <Polyline positions={seg.coords} pathOptions={{ color: seg.color, weight: 22, opacity: 0.02 }}>
          <Popup>{segmentPopupText(seg.distanceKm!, seg.avgGrade!)}</Popup>
        </Polyline>
      )}
      <Polyline
        positions={seg.coords}
        pathOptions={{ color: seg.color, weight, opacity, dashArray: seg.dashArray, lineCap: 'round', lineJoin: 'round' }}
      >
        {hasInfo && <Popup>{segmentPopupText(seg.distanceKm!, seg.avgGrade!)}</Popup>}
      </Polyline>
    </>
  )
}

export function WindOverlay({
  weather,
  variant = 'default',
  showWind = true,
  showClouds = true,
  showBadge = true,
}: {
  weather: EventWeather | null | undefined
  variant?: 'default' | 'hub'
  showWind?: boolean
  showClouds?: boolean
  showBadge?: boolean
}) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const apply = () => setIsMobile(media.matches)

    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [])

  const isHub = variant === 'hub'

  const particles = useMemo(
    () =>
      Array.from({ length: isHub ? (isMobile ? 90 : 75) : (isMobile ? 35 : 28) }, (_, i) => ({
        id: i,
        left: ((i * 19) % 126) - 12,
        top: (i * (isHub ? (isMobile ? 3.2 : 4) : (isMobile ? 4.8 : 6))) % 100,
        delay: (i * (isHub ? (isMobile ? 0.045 : 0.055) : (isMobile ? 0.07 : 0.09))).toFixed(2),
        size: (isHub ? (isMobile ? 2.2 : 1.9) : (isMobile ? 2 : 1.8)) + (i % 2) * 0.6,
        durationOffset: (i % 6) * 0.22,
        wavePhase: i % 2 === 0 ? 1 : -1,
        waveAmp: 4 + (i % 3) * 2,
      })),
    [isHub, isMobile],
  )

  if (!weather || (!showWind && !showClouds)) return null

  const visualBearing = (weather.windDir + 180) % 360
  const windTransformAngle = (((visualBearing - 90) % 360) + 360) % 360
  const windGradientAngle = visualBearing
  const effectiveWind = Math.max(8, weather.windSpeed)
  const isCloudy = showClouds && weather.code > 0 && weather.code <= 48
  const isRainy = showClouds && ((weather.code >= 51 && weather.code <= 67) || (weather.code >= 80 && weather.code <= 82))
  const duration = Math.max(4.4, 10.6 - effectiveWind * 0.08)
  const distance = Math.min(158, 46 + effectiveWind * 2.4)
  const opacity = Math.min(
    isHub ? (isMobile ? 0.98 : 0.96) : (isMobile ? 0.9 : 0.82),
    (isHub ? (isMobile ? 0.68 : 0.62) : (isMobile ? 0.52 : 0.42)) + effectiveWind / (isHub ? (isMobile ? 68 : 74) : (isMobile ? 88 : 95)),
  )
  const streamOpacity = Math.min(
    isHub ? (isMobile ? 1 : 1) : (isMobile ? 0.9 : 0.9),
    (isHub ? (isMobile ? 0.76 : 0.74) : (isMobile ? 0.56 : 0.5)) + effectiveWind / (isHub ? (isMobile ? 64 : 64) : (isMobile ? 84 : 86)),
  )
  const glowOpacity = Math.min(
    isHub ? (isMobile ? 0.3 : 0.24) : (isMobile ? 0.22 : 0.16),
    (isHub ? (isMobile ? 0.1 : 0.07) : (isMobile ? 0.07 : 0.04)) + effectiveWind / (isHub ? (isMobile ? 120 : 150) : (isMobile ? 160 : 220)),
  )
  const cloudStrength = weatherCloudStrength(weather.code)
  const rainStrength = weatherRainStrength(weather.code, weather.precipitation)
  const cloudOpacity = isCloudy
    ? (isHub ? (isMobile ? 1 : 0.92) : (isMobile ? 0.26 : 0.18)) * cloudStrength
    : 0
  const rainOpacity = isRainy
    ? (isHub ? (isMobile ? 0.82 : 0.66) : (isMobile ? 0.26 : 0.18)) * rainStrength
    : 0
  const hasAtmosphere = isCloudy || isRainy
  const windFieldOpacity = showWind && hasAtmosphere
    ? (isHub ? (isMobile ? 0.04 : 0.026) : (isMobile ? 0.08 : 0.05))
    : 0
  const glowBaseOpacity = showWind && hasAtmosphere
    ? glowOpacity * (isHub ? 0.56 : 0.82)
    : 0
  const hubParticleBoost = isHub ? (isMobile ? 1.2 : 1.16) : 1

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 500,
          background: showWind
            ? `linear-gradient(${windGradientAngle}deg, rgba(${isHub ? '28,66,38' : '32,72,42'},${glowBaseOpacity * 0.64}), rgba(255,255,255,0.01), rgba(${isHub ? '110,182,134' : '122,194,144'},${Math.min((glowBaseOpacity + (isHub ? (isMobile ? 0.14 : 0.1) : (isMobile ? 0.1 : 0.06))) * 0.66, isHub ? (isMobile ? 0.28 : 0.2) : (isMobile ? 0.24 : 0.16))}))`
            : 'transparent',
        }}
      >
        {cloudOpacity > 0 && (
          <svg
            viewBox="0 0 1000 1000"
            preserveAspectRatio="xMidYMid slice"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              opacity: isHub ? 0.85 : 0.78,
              mixBlendMode: 'screen',
            }}
          >
            <defs>
              <filter id="fitmeet-cloud-blur" x="-15%" y="-15%" width="130%" height="130%">
                <feGaussianBlur stdDeviation="38" />
              </filter>
            </defs>
            <g filter="url(#fitmeet-cloud-blur)">
              {!isHub && (
                <>
                  <path
                    d="M22 148 C92 92, 198 86, 304 122 C408 156, 476 144, 560 116 C686 74, 808 88, 930 156 L930 344 C836 316, 738 306, 630 328 C488 356, 360 348, 240 314 C148 288, 78 286, 22 300 Z"
                    fill={`rgba(180,195,220,${cloudOpacity * 0.9})`}
                  />
                  <path
                    d="M96 446 C194 396, 302 392, 404 428 C490 458, 576 466, 662 444 C772 416, 866 422, 968 470 L968 654 C862 626, 754 620, 632 644 C508 668, 392 666, 278 636 C188 612, 112 612, 34 632 L34 496 C56 482, 74 462, 96 446 Z"
                    fill={`rgba(165,182,210,${cloudOpacity * 0.85})`}
                  />
                  <path
                    d="M146 702 C246 668, 344 670, 450 698 C552 724, 646 726, 742 700 C826 678, 906 680, 980 710 L980 864 C900 850, 822 848, 730 860 C618 876, 504 878, 394 860 C294 844, 198 838, 98 850 L98 728 C114 720, 128 708, 146 702 Z"
                    fill={`rgba(172,188,214,${cloudOpacity * 0.82})`}
                  />
                </>
              )}
              <ellipse cx="232" cy="248" rx="120" ry="54" fill={`rgba(210,220,238,${cloudOpacity * 0.45})`} />
              <ellipse cx="712" cy="214" rx="146" ry="62" fill={`rgba(205,216,235,${cloudOpacity * 0.4})`} />
              <ellipse cx="554" cy="560" rx="162" ry="70" fill={`rgba(212,222,240,${cloudOpacity * 0.36})`} />
              <ellipse cx="302" cy="780" rx="152" ry="62" fill={`rgba(200,212,232,${cloudOpacity * 0.32})`} />
              {isHub && (
                <>
                  <ellipse cx="144" cy="150" rx="154" ry="74" fill={`rgba(236,242,248,${cloudOpacity * 0.56})`} />
                  <ellipse cx="374" cy="244" rx="196" ry="88" fill={`rgba(214,224,240,${cloudOpacity * 0.52})`} />
                  <ellipse cx="798" cy="188" rx="188" ry="82" fill={`rgba(232,238,246,${cloudOpacity * 0.5})`} />
                  <ellipse cx="664" cy="454" rx="226" ry="96" fill={`rgba(214,224,240,${cloudOpacity * 0.48})`} />
                  <ellipse cx="212" cy="594" rx="202" ry="92" fill={`rgba(236,242,248,${cloudOpacity * 0.48})`} />
                  <ellipse cx="842" cy="714" rx="214" ry="98" fill={`rgba(220,230,244,${cloudOpacity * 0.46})`} />
                  <ellipse cx="480" cy="820" rx="242" ry="104" fill={`rgba(236,242,248,${cloudOpacity * 0.42})`} />
                </>
              )}
            </g>
          </svg>
        )}

        {rainOpacity > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: isHub
                ? `linear-gradient(180deg, rgba(186,206,228,${Math.min(rainOpacity * 0.44, 0.44)}), rgba(186,206,228,${Math.min(rainOpacity * 0.24, 0.24)}))`
                : `repeating-linear-gradient(${windGradientAngle + 18}deg, rgba(84,152,214,0) 0px, rgba(84,152,214,0) 8px, rgba(84,152,214,${Math.min(rainOpacity * 0.96, 0.96)}) 10px, rgba(84,152,214,0) 14px)`,
              opacity: isHub ? 0.9 : 0.42,
              animation: isHub ? 'none' : 'fitmeet-rain-shift 7s linear infinite',
            }}
          />
        )}

        {showWind && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `repeating-linear-gradient(${windGradientAngle}deg, rgba(200,222,245,0) 0px, rgba(200,222,245,0) 12px, rgba(220,236,255,${Math.min(streamOpacity * (isHub ? (isMobile ? 0.11 : 0.085) : (isMobile ? 0.075 : 0.055)), isHub ? (isMobile ? 0.11 : 0.085) : (isMobile ? 0.06 : 0.04))}) 13px, rgba(200,222,245,0) 18px)`,
              opacity: windFieldOpacity,
            }}
          />
        )}

        {showWind && particles.map((particle) => (
          <span
            key={particle.id}
            style={{
              position: 'absolute',
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              transform: `rotate(${windTransformAngle}deg)`,
            }}
          >
            <span
              style={{
                position: 'relative',
                display: 'block',
                opacity: 0,
                transform: 'translate3d(0, 0, 0) scale(0.7)',
                animationName: 'fitmeet-wind-drift',
                animationDuration: `${duration + particle.durationOffset}s`,
                animationDelay: `${particle.delay}s`,
                animationIterationCount: 'infinite',
                animationTimingFunction: 'linear',
                ['--wind-distance' as string]: `${distance}px`,
                ['--wind-wave-dir' as string]: particle.wavePhase,
                ['--wind-wave' as string]: `${particle.waveAmp}px`,
              }}
            >
              {/* fading trail behind the dot */}
              <span
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: '50%',
                  transform: 'translateY(-50%)',
                  width: `${particle.size * 7}px`,
                  height: `${Math.max(particle.size * 0.55, 1)}px`,
                  borderRadius: 999,
                  background: `linear-gradient(90deg, rgba(210,232,255,0), rgba(210,232,255,${Math.min(opacity * (isHub ? 0.6 : 0.5), 0.6)}))`,
                }}
              />
              {/* dot */}
              <span
                style={{
                  display: 'block',
                  width: `${particle.size}px`,
                  height: `${particle.size}px`,
                  borderRadius: 999,
                  background: `rgba(255,255,255,${Math.min(opacity * (isHub ? 1.3 : 1.14), 1)})`,
                  boxShadow: `0 0 4px 1.5px rgba(5,8,8,${Math.min(opacity * hubParticleBoost * 0.88, 0.88)}), 0 0 16px rgba(210,232,255,${Math.min(opacity * hubParticleBoost, 1)})`,
                }}
              />
            </span>
          </span>
        ))}
      </div>

      {showBadge && showWind && (
        <div
          style={{
            position: 'absolute',
            right: 12,
            top: 12,
            zIndex: 600,
            pointerEvents: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.14)',
            background: 'rgba(5,8,22,0.72)',
            backdropFilter: 'blur(8px)',
            color: '#d7dfef',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <span>{weather.tempMin}°/{weather.tempMax}°</span>
          <span
            style={{
              width: 1,
              height: 12,
              background: 'rgba(255,255,255,0.16)',
              display: 'inline-block',
            }}
          />
          <span
            style={{
              color: '#58beff',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {windDirectionLabel(weather.windDir)}
          </span>
          <span>{weather.windSpeed} km/h</span>
        </div>
      )}


      <style>{`
        @keyframes fitmeet-wind-drift {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) scale(0.7);
          }
          12% {
            opacity: 1;
          }
          32% {
            transform: translate3d(calc(var(--wind-distance) * 0.32), calc(var(--wind-wave-dir, 1) * var(--wind-wave, 5px)), 0) scale(0.85);
          }
          58% {
            transform: translate3d(calc(var(--wind-distance) * 0.58), calc(var(--wind-wave-dir, 1) * var(--wind-wave, 5px) * -1), 0) scale(0.92);
          }
          82% {
            transform: translate3d(calc(var(--wind-distance) * 0.82), calc(var(--wind-wave-dir, 1) * var(--wind-wave, 5px) * 0.6), 0) scale(0.98);
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--wind-distance), 0, 0) scale(1);
          }
        }

        @keyframes fitmeet-rain-shift {
          0% {
            transform: translate3d(-14px, -10px, 0);
          }
          100% {
            transform: translate3d(10px, 14px, 0);
          }
        }
      `}</style>
    </>
  )
}

export default function LocationPickerMap({
  lat,
  lng,
  onChange,
  onViewChange,
  onInteractionChange,
  track,
  coloredSegments,
  elevationSegments,
  surfaceSegments,
  playProgress = null,
  playMilestone = null,
  showElevationLayer = true,
  showSurfaceLayer = false,
  showKmMarkers = false,
  readOnly = false,
  height = 220,
  weather = null,
  weatherVariant = 'default',
  showWindOverlay = true,
  showCloudOverlay = true,
  showMapLayerControl = false,
  radarFrame = null,
  participants,
  onClusterTap,
}: Props) {
  const hasPin      = lat != null && lng != null
  const allCoords   = useMemo(
    () => {
      const layeredCoords = [
        ...(surfaceSegments ?? []),
        ...(elevationSegments ?? []),
        ...(coloredSegments ?? []),
      ].flatMap(segment => segment.coords)
      return layeredCoords.length > 0 ? layeredCoords : track ?? []
    },
    [coloredSegments, elevationSegments, surfaceSegments, track],
  )
  // Single, sequentially-ordered segment list for the "play" reveal animation.
  // (allCoords above concatenates multiple segment layers that each re-trace the
  // whole route, which would make the snake loop back on itself mid-animation.)
  // Elevation-graded color takes priority so the reveal paints in the same
  // grade colors as the static Elevation toggle, not a flat color.
  const playSegments = useMemo(
    () => {
      return elevationSegments?.length ? elevationSegments
        : surfaceSegments?.length ? surfaceSegments
        : coloredSegments?.length ? coloredSegments
        : null
    },
    [coloredSegments, elevationSegments, surfaceSegments],
  )
  const playCoords = useMemo(
    () => (playSegments ? playSegments.flatMap(segment => segment.coords) : track ?? []),
    [playSegments, track],
  )
  // Cumulative real-world distance at each playCoords point — lets progress
  // map to distance travelled instead of raw point count (see progressToTrackPointer).
  const playCumDistKm = useMemo(() => cumulativeDistancesKm(playCoords), [playCoords])
  const playPointer = playProgress != null
    ? progressToTrackPointer(playCumDistKm, playProgress)
    : null
  const headPosition = playPointer
    ? lerpCoord(playCoords[playPointer.index], playCoords[playPointer.index + 1], playPointer.t)
    : null
  // Frozen at the coordinate where the milestone was hit — deliberately not
  // re-computed as playProgress advances, so the badge stays put at that
  // point on the route instead of following the moving head marker.
  const milestonePosition = useMemo(
    () => (playMilestone ? headPosition : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playMilestone?.km, playCoords],
  )
  // Static "X km" waypoint badges shown along the whole route when the km-markers
  // toggle is on — independent of the play-animation milestones above.
  const kmMarkerPoints = useMemo(() => computeKmMarkerPoints(allCoords, 10), [allCoords])
  const hasTrack    = allCoords.length > 1
  const hasLayeredSegments = Boolean(surfaceSegments?.length || elevationSegments?.length)
  const [selectedLayerName, setSelectedLayerName] = useState<MapBaseLayerName>('Standard')
  const [layerMenuOpen, setLayerMenuOpen] = useState(false)
  const selectedLayer = MAP_BASE_LAYERS.find(layer => layer.name === selectedLayerName) ?? MAP_BASE_LAYERS[0]

  const center: [number, number] = hasPin
    ? [lat!, lng!]
    : hasTrack ? allCoords[0]
    : [44.5, 16.5]

  const zoom = hasPin || hasTrack ? 11 : 5

  return (
    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: `${height}px`, width: '100%' }}
        scrollWheelZoom={false}
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          key={showMapLayerControl ? selectedLayer.name : MAP_BASE_LAYERS[0].name}
          url={showMapLayerControl ? selectedLayer.url : MAP_BASE_LAYERS[0].url}
          attribution={showMapLayerControl ? selectedLayer.attribution : MAP_BASE_LAYERS[0].attribution}
          maxZoom={showMapLayerControl ? selectedLayer.maxZoom : MAP_BASE_LAYERS[0].maxZoom}
        />
        {showCloudOverlay && radarFrame && (
          <TileLayer
            url={`https://tilecache.rainviewer.com${radarFrame.path}/512/{z}/{x}/{y}/2/1_1.png`}
            opacity={0.85}
            zIndex={221}
            maxZoom={19}
            maxNativeZoom={7}
          />
        )}
        {!readOnly && onChange && <ClickHandler onChange={onChange} />}
        {readOnly && <ReadOnlyViewSync onViewChange={onViewChange} onInteractionChange={onInteractionChange} />}
        {hasPin && <Marker position={[lat!, lng!]} />}

        {playProgress != null && playPointer && playCoords.length > 1 ? (
          <>
            {playSegments ? (
              revealedSegmentsWithHead(playSegments, Math.max(2, playPointer.index + 1), headPosition).map((seg, i) => (
                <ColoredSegment key={i} seg={seg} weight={5} opacity={0.95} />
              ))
            ) : (
              <Polyline
                positions={[...playCoords.slice(0, Math.max(2, playPointer.index + 1)), ...(headPosition ? [headPosition] : [])]}
                pathOptions={{ color: '#39ff14', weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
              />
            )}
            <Marker
              position={headPosition!}
              icon={headIcon}
            />
            {playMilestone && milestonePosition && (
              <Marker
                position={milestonePosition}
                icon={milestoneIcon(playMilestone.km, playMilestone.exiting)}
                zIndexOffset={1000}
              />
            )}
            <PlayCameraFollow position={headPosition!} />
          </>
        ) : hasLayeredSegments ? (
          <>
            {showSurfaceLayer && surfaceSegments?.map((seg, i) => (
              <Polyline
                key={`surface-${i}`}
                positions={seg.coords}
                pathOptions={{ color: seg.color, weight: 9, opacity: 0.72, dashArray: seg.dashArray, lineCap: 'round', lineJoin: 'round' }}
              />
            ))}
            {showElevationLayer && elevationSegments?.map((seg, i) => (
              <ColoredSegment key={`elevation-${i}`} seg={seg} weight={4} opacity={0.98} />
            ))}
            {!showSurfaceLayer && !showElevationLayer && (
              <Polyline positions={allCoords} pathOptions={{ color: '#39ff14', weight: 4, opacity: 0.9 }} />
            )}
            <FitTrack coords={allCoords} />
          </>
        ) : coloredSegments && coloredSegments.length > 0 ? (
          <>
            {coloredSegments.map((seg, i) => (
              <Polyline
                key={i}
                positions={seg.coords}
                pathOptions={{ color: seg.color, weight: 4, opacity: 0.95, dashArray: seg.dashArray, lineCap: 'round', lineJoin: 'round' }}
              />
            ))}
            <FitTrack coords={allCoords} />
          </>
        ) : hasTrack && (
          <>
            <Polyline
              positions={allCoords}
              pathOptions={{ color: '#39ff14', weight: 4, opacity: 0.9 }}
            />
            <FitTrack coords={allCoords} />
          </>
        )}

        {(playCoords.length > 0 || allCoords.length > 0) && (playProgress == null || playProgress >= 1) && (
          <Marker
            position={playCoords.length > 0 ? playCoords[playCoords.length - 1] : allCoords[allCoords.length - 1]}
            icon={finishIcon}
          />
        )}

        {showKmMarkers && (playProgress == null || playProgress >= 1) && kmMarkerPoints.map(p => (
          <Marker key={p.km} position={p.pos} icon={staticKmIcon(p.km)} />
        ))}

        {readOnly && participants && participants.length > 0 && (
          <LiveParticipantsLayer participants={participants} onClusterTap={onClusterTap} />
        )}
      </MapContainer>
      {readOnly && participants && participants.length > 0 && (
        <style>{`
          @keyframes fm-stopped-pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(255,59,48,0.9); }
            50% { box-shadow: 0 0 0 7px rgba(255,59,48,0); }
          }
          .fm-stopped-ring { animation: fm-stopped-pulse 1.2s ease-in-out infinite; }
        `}</style>
      )}
      {readOnly && participants && participants.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 12,
            top: 12,
            zIndex: 820,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '7px 10px',
            borderRadius: 999,
            border: '1px solid rgba(255,90,90,0.4)',
            background: 'rgba(7,13,28,0.9)',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: '#ff3b30',
              animation: 'fm-live-pulse 1.8s ease-in-out infinite',
            }}
          />
          <span style={{ color: '#ff6b6b', fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>LIVE</span>
          <style>{`
            @keyframes fm-live-pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.35; }
            }
          `}</style>
        </div>
      )}
      {showMapLayerControl && (
        <div
          style={{
            position: 'absolute',
            right: 12,
            top: weather && showWindOverlay ? 54 : 12,
            zIndex: 820,
          }}
        >
          <button
            type="button"
            onClick={() => setLayerMenuOpen(open => !open)}
            style={{
              minWidth: 104,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.16)',
              background: 'rgba(5,8,22,0.86)',
              color: '#f5f7ff',
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 800,
              boxShadow: '0 10px 28px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(8px)',
            }}
          >
            {selectedLayer.name}
          </button>
          {layerMenuOpen && (
            <div
              style={{
                marginTop: 8,
                minWidth: 122,
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(5,8,22,0.94)',
                padding: 4,
                boxShadow: '0 14px 32px rgba(0,0,0,0.35)',
                backdropFilter: 'blur(10px)',
              }}
            >
              {MAP_BASE_LAYERS.map(layer => {
                const active = layer.name === selectedLayer.name
                return (
                  <button
                    key={layer.name}
                    type="button"
                    onClick={() => {
                      setSelectedLayerName(layer.name)
                      setLayerMenuOpen(false)
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      border: 0,
                      borderRadius: 10,
                      background: active ? 'var(--primary)' : 'transparent',
                      color: active ? '#041109' : '#f5f7ff',
                      padding: '8px 10px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {layer.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
      {readOnly && (
        <WindOverlay
          weather={weather}
          variant={weatherVariant}
          showWind={showWindOverlay}
          showClouds={showCloudOverlay && !radarFrame}
        />
      )}
      {showCloudOverlay && radarFrame && weather && weather.code >= 95 && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 501 }}>
          {LIGHTNING_POSITIONS.map((pos, i) => (
            <span
              key={i}
              className="fm-lpm-lightning-bolt"
              style={{
                left: pos.left,
                top: pos.top,
                animationDelay: `${i * 0.6}s`,
                animationDuration: `${2.6 + (i % 3) * 0.6}s`,
              }}
            />
          ))}
          <style>{`
            .fm-lpm-lightning-bolt {
              position: absolute;
              width: 16px;
              height: 16px;
              border-radius: 999px;
              background: radial-gradient(circle, rgba(255,244,160,0.98), rgba(255,214,64,0.6) 55%, transparent 100%);
              box-shadow: 0 0 18px 7px rgba(255,214,64,0.55);
              opacity: 0;
              animation-name: fm-lpm-lightning-flash;
              animation-timing-function: ease-in-out;
              animation-iteration-count: infinite;
            }
            @keyframes fm-lpm-lightning-flash {
              0%, 90%   { opacity: 0; transform: scale(0.6); }
              91%       { opacity: 1; transform: scale(1.2); }
              93%       { opacity: 0.15; transform: scale(0.85); }
              94.5%     { opacity: 1; transform: scale(1.25); }
              97%       { opacity: 0; transform: scale(0.6); }
              100%      { opacity: 0; transform: scale(0.6); }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}
