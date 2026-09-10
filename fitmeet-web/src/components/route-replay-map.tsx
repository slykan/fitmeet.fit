'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Tooltip, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Play, Pause, FastForward } from 'lucide-react'

export type ReplayPoint = {
  lat: number
  lng: number
  speed_kmh: number | null
  recorded_at: string
}

export type ReplayTrack = {
  id: number
  name: string
  avatar: string | null
  points: ReplayPoint[]
}

type RiderPosition = {
  id: number
  name: string
  avatar: string | null
  lat: number
  lng: number
  speed: number | null
}

type PlayState = 'idle' | 'playing' | 'paused'

// Mirrors the mobile app's replay pacing (RouteReplayMap.tsx): 1500ms of
// animation per real recorded minute, clamped so a short event isn't a blink
// and a long one isn't a slog.
const ANIM_MS_PER_REAL_MINUTE = 1500
const ANIM_DURATION_MIN_MS = 8000
const ANIM_DURATION_MAX_MS = 60000
const SPEED_STEPS = [1, 2, 4]
const PROGRESS_UPDATE_INTERVAL_MS = 1000 / 20
// Same threshold as the live-tracking rider layer (location-picker-map.tsx).
const CLUSTER_PIXEL_DISTANCE = 40

function initialsFor(name: string) {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

const riderIconCache = new Map<string, L.DivIcon>()
const clusterIconCache = new Map<string, L.DivIcon>()

function riderIcon(p: RiderPosition) {
  const key = `${p.id}|${p.avatar ?? ''}`
  const cached = riderIconCache.get(key)
  if (cached) return cached
  const html = p.avatar
    ? `<div style="width:32px;height:32px;border-radius:999px;background:#0b1120;background-image:url('${p.avatar}');background-size:cover;background-position:center;border:2px solid #39ff14;box-shadow:0 2px 6px rgba(0,0,0,0.5);"></div>`
    : `<div style="width:32px;height:32px;border-radius:999px;background:#0b1120;border:2px solid #39ff14;display:flex;align-items:center;justify-content:center;color:#eafff0;font-weight:800;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,0.5);">${initialsFor(p.name)}</div>`
  const icon = L.divIcon({ className: 'fm-rider-marker', html, iconSize: [32, 32], iconAnchor: [16, 16] })
  riderIconCache.set(key, icon)
  return icon
}

function clusterDivIcon(count: number) {
  const key = String(count)
  const cached = clusterIconCache.get(key)
  if (cached) return cached
  const icon = L.divIcon({
    className: 'fm-cluster-marker',
    html: `<div style="width:34px;height:34px;border-radius:999px;background:#39ff14;color:#041109;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.5);border:2px solid #0b1120;">${count}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
  clusterIconCache.set(key, icon)
  return icon
}

// Same hand-rolled greedy pixel-distance clustering as the live rider layer
// (location-picker-map.tsx) -- merged riders show one combined speed, spread
// out riders show their own.
function RiderLayer({ positions }: { positions: RiderPosition[] }) {
  const map = useMap()
  const [tick, setTick] = useState(0)
  useMapEvents({
    zoomend: () => setTick((t) => t + 1),
    moveend: () => setTick((t) => t + 1),
  })

  const groups = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    tick
    const pts = positions.map((p) => ({ p, pt: map.latLngToContainerPoint([p.lat, p.lng]) }))
    const used = new Array(pts.length).fill(false)
    const result: RiderPosition[][] = []
    for (let i = 0; i < pts.length; i++) {
      if (used[i]) continue
      const group = [pts[i].p]
      used[i] = true
      for (let j = i + 1; j < pts.length; j++) {
        if (used[j]) continue
        const dx = pts[i].pt.x - pts[j].pt.x
        const dy = pts[i].pt.y - pts[j].pt.y
        if (Math.sqrt(dx * dx + dy * dy) < CLUSTER_PIXEL_DISTANCE) {
          group.push(pts[j].p)
          used[j] = true
        }
      }
      result.push(group)
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, map, tick])

  return (
    <>
      {groups.map((group) =>
        group.length === 1 ? (
          <Marker key={group[0].id} position={[group[0].lat, group[0].lng]} icon={riderIcon(group[0])}>
            {group[0].speed != null && (
              <Tooltip permanent direction="bottom" offset={[0, 12]} className="fm-speed-tooltip">
                {group[0].speed.toFixed(1)} km/h
              </Tooltip>
            )}
          </Marker>
        ) : (
          (() => {
            const speeds = group.map((p) => p.speed).filter((s): s is number => s != null)
            const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null
            return (
              <Marker
                key={group.map((p) => p.id).sort().join('-')}
                position={[
                  group.reduce((sum, p) => sum + p.lat, 0) / group.length,
                  group.reduce((sum, p) => sum + p.lng, 0) / group.length,
                ]}
                icon={clusterDivIcon(group.length)}
              >
                {avgSpeed != null && (
                  <Tooltip permanent direction="bottom" offset={[0, 15]} className="fm-speed-tooltip">
                    {avgSpeed.toFixed(1)} km/h
                  </Tooltip>
                )}
              </Marker>
            )
          })()
        ),
      )}
    </>
  )
}

function FitTracks({ tracksCoords }: { tracksCoords: [number, number][][] }) {
  const map = useMap()
  useEffect(() => {
    const all = tracksCoords.flat()
    if (all.length > 1) map.fitBounds(all, { padding: [28, 28] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])
  return null
}

function PlayCameraFollow({ position }: { position: [number, number] }) {
  const map = useMap()
  useEffect(() => {
    map.panTo(position, { animate: false })
  }, [map, position])
  return null
}

function indexForElapsed(elapsedMsList: number[], elapsedMs: number): { index: number; frac: number } {
  let lo = 0
  let hi = elapsedMsList.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (elapsedMsList[mid] <= elapsedMs) lo = mid
    else hi = mid - 1
  }
  const next = elapsedMsList[lo + 1]
  const frac = next != null && next > elapsedMsList[lo]
    ? Math.min(1, (elapsedMs - elapsedMsList[lo]) / (next - elapsedMsList[lo]))
    : 0
  return { index: lo, frac }
}

export default function RouteReplayMap({ tracks, height = 320 }: { tracks: ReplayTrack[]; height?: number }) {
  const [playState, setPlayState] = useState<PlayState>('idle')
  const [speedStepIndex, setSpeedStepIndex] = useState(0)
  const [positions, setPositions] = useState<RiderPosition[]>([])
  const [traveled, setTraveled] = useState<Record<number, [number, number][]>>({})
  const elapsedMsRef = useRef(0)
  const speedRef = useRef(SPEED_STEPS[0])
  const frameRef = useRef<number | null>(null)

  const validTracks = useMemo(() => tracks.filter((t) => t.points.length >= 2), [tracks])

  const prepared = useMemo(() => {
    if (validTracks.length === 0) return null
    // All riders animate against one shared real-world clock (earliest start
    // to latest finish across everyone), not their own individual spans, so
    // relative pacing between riders stays meaningful when replaying "All".
    const commonStartMs = Math.min(...validTracks.map((t) => new Date(t.points[0].recorded_at).getTime()))
    const commonEndMs = Math.max(...validTracks.map((t) => new Date(t.points[t.points.length - 1].recorded_at).getTime()))
    const totalRealMs = Math.max(0, commonEndMs - commonStartMs)
    const items = validTracks.map((t) => ({
      id: t.id,
      name: t.name,
      avatar: t.avatar,
      coords: t.points.map((p) => [p.lat, p.lng] as [number, number]),
      elapsedMsList: t.points.map((p) => new Date(p.recorded_at).getTime() - commonStartMs),
      speeds: t.points.map((p) => p.speed_kmh),
    }))
    return { items, totalRealMs }
  }, [validTracks])

  const totalRealMs = prepared?.totalRealMs ?? 0
  const animDurationMs = Math.min(
    ANIM_DURATION_MAX_MS,
    Math.max(ANIM_DURATION_MIN_MS, (totalRealMs / 60000) * ANIM_MS_PER_REAL_MINUTE),
  )

  useEffect(() => {
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  useEffect(() => {
    // New selection: stop any running animation and reset to the start.
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
    setPlayState('idle')
    setSpeedStepIndex(0)
    speedRef.current = SPEED_STEPS[0]
    elapsedMsRef.current = 0
    setPositions([])
    setTraveled({})
  }, [prepared])

  function applyElapsed(elapsedMs: number) {
    if (!prepared) return
    const nextPositions: RiderPosition[] = []
    const nextTraveled: Record<number, [number, number][]> = {}
    prepared.items.forEach((t) => {
      const { index, frac } = indexForElapsed(t.elapsedMsList, elapsedMs)
      const a = t.coords[index]
      const b = t.coords[index + 1]
      const lat = b ? a[0] + (b[0] - a[0]) * frac : a[0]
      const lng = b ? a[1] + (b[1] - a[1]) * frac : a[1]
      nextPositions.push({ id: t.id, name: t.name, avatar: t.avatar, lat, lng, speed: t.speeds[index] })
      const upto = t.coords.slice(0, index + 1)
      if (frac > 0 && b) upto.push([lat, lng])
      nextTraveled[t.id] = upto
    })
    setPositions(nextPositions)
    setTraveled(nextTraveled)
  }

  function runAnimation(resumeFromMs: number) {
    setPlayState('playing')
    let virtualElapsed = totalRealMs > 0 ? (resumeFromMs / totalRealMs) * animDurationMs : 0
    let lastFrameTime = performance.now()
    let lastUpdateTime = 0
    const step = (now: number) => {
      const dt = now - lastFrameTime
      lastFrameTime = now
      virtualElapsed += dt * speedRef.current
      const progress = Math.min(1, virtualElapsed / animDurationMs)
      const realElapsed = progress * totalRealMs
      elapsedMsRef.current = realElapsed

      if (progress >= 1 || now - lastUpdateTime >= PROGRESS_UPDATE_INTERVAL_MS) {
        lastUpdateTime = now
        applyElapsed(realElapsed)
      }

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      } else {
        setPlayState('idle')
      }
    }
    frameRef.current = requestAnimationFrame(step)
  }

  function handlePlayToggle() {
    if (playState === 'playing') {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
      setPlayState('paused')
      return
    }
    const resumeFrom = playState === 'paused' ? elapsedMsRef.current : 0
    if (playState === 'idle') {
      setPositions([])
      setTraveled({})
    }
    runAnimation(resumeFrom)
  }

  function toggleSpeed() {
    const next = (speedStepIndex + 1) % SPEED_STEPS.length
    setSpeedStepIndex(next)
    speedRef.current = SPEED_STEPS[next]
  }

  if (!prepared) return null

  const followPosition = positions.length === 1 ? [positions[0].lat, positions[0].lng] as [number, number] : null

  return (
    <div
      className="relative rounded-2xl overflow-hidden border"
      style={{ height, borderColor: 'rgba(255,255,255,0.1)', background: '#060c1a' }}
    >
      <MapContainer
        center={prepared.items[0].coords[0]}
        zoom={13}
        zoomControl={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <ZoomControl position="bottomright" />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitTracks tracksCoords={prepared.items.map((t) => t.coords)} />
        {prepared.items.map((t) => (
          <Polyline key={`full-${t.id}`} positions={t.coords} pathOptions={{ color: 'rgba(255,255,255,0.35)', weight: 3 }} />
        ))}
        {prepared.items.map((t) => (
          <Polyline key={`traveled-${t.id}`} positions={traveled[t.id] ?? []} pathOptions={{ color: '#39ff14', weight: 4 }} />
        ))}
        {playState === 'playing' && followPosition && <PlayCameraFollow position={followPosition} />}
        <RiderLayer positions={positions} />
      </MapContainer>
      <div className="absolute bottom-3 left-3 z-[500] flex gap-1.5" style={{ pointerEvents: 'auto' }}>
        <button
          type="button"
          onClick={handlePlayToggle}
          className="inline-flex items-center justify-center rounded-[10px] border transition-colors"
          style={{
            width: 32, height: 32,
            borderColor: playState === 'playing' ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
            background: playState === 'playing' ? 'var(--primary)' : 'rgba(7,11,24,0.78)',
          }}
        >
          {playState === 'playing'
            ? <Pause size={15} color="#031109" />
            : <Play size={15} color="var(--text-muted)" />}
        </button>
        {playState !== 'idle' && (
          <button
            type="button"
            onClick={toggleSpeed}
            className="inline-flex items-center justify-center gap-1 rounded-[10px] border px-2 transition-colors"
            style={{
              height: 32,
              borderColor: speedStepIndex > 0 ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
              background: speedStepIndex > 0 ? 'var(--primary)' : 'rgba(7,11,24,0.78)',
            }}
          >
            <FastForward size={14} color={speedStepIndex > 0 ? '#031109' : 'var(--text-muted)'} />
            <span
              className="text-xs font-bold"
              style={{ color: speedStepIndex > 0 ? '#031109' : 'var(--text-muted)' }}
            >
              {SPEED_STEPS[speedStepIndex]}x
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
