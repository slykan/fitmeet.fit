'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { Play, Pause, FastForward } from 'lucide-react'

export type ReplayPoint = {
  lat: number
  lng: number
  speed_kmh: number | null
  recorded_at: string
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

function FitTrack({ coords }: { coords: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (coords.length > 1) map.fitBounds(coords, { padding: [28, 28] })
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

export default function RouteReplayMap({ points }: { points: ReplayPoint[] }) {
  const [playState, setPlayState] = useState<PlayState>('idle')
  const [speedStepIndex, setSpeedStepIndex] = useState(0)
  const [headIndex, setHeadIndex] = useState(0)
  const [headFrac, setHeadFrac] = useState(0)
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number | null>(null)
  const elapsedMsRef = useRef(0)
  const speedRef = useRef(SPEED_STEPS[0])
  const frameRef = useRef<number | null>(null)

  const coords = useMemo<[number, number][]>(() => points.map((p) => [p.lat, p.lng]), [points])
  const elapsedMsList = useMemo(
    () => points.map((p) => new Date(p.recorded_at).getTime() - new Date(points[0]?.recorded_at ?? 0).getTime()),
    [points],
  )
  const totalRealMs = elapsedMsList[elapsedMsList.length - 1] ?? 0
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
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
    setPlayState('idle')
    setSpeedStepIndex(0)
    speedRef.current = SPEED_STEPS[0]
    elapsedMsRef.current = 0
    setHeadIndex(0)
    setHeadFrac(0)
    setCurrentSpeedKmh(null)
  }, [points])

  function applyElapsed(elapsedMs: number) {
    const { index, frac } = indexForElapsed(elapsedMsList, elapsedMs)
    setHeadIndex(index)
    setHeadFrac(frac)
    setCurrentSpeedKmh(points[index]?.speed_kmh ?? null)
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
      setHeadIndex(0)
      setHeadFrac(0)
    }
    runAnimation(resumeFrom)
  }

  function toggleSpeed() {
    const next = (speedStepIndex + 1) % SPEED_STEPS.length
    setSpeedStepIndex(next)
    speedRef.current = SPEED_STEPS[next]
  }

  const traveled = useMemo(() => {
    const upto = coords.slice(0, headIndex + 1)
    const a = coords[headIndex]
    const b = coords[headIndex + 1]
    if (headFrac > 0 && a && b) {
      upto.push([a[0] + (b[0] - a[0]) * headFrac, a[1] + (b[1] - a[1]) * headFrac])
    }
    return upto
  }, [coords, headIndex, headFrac])

  if (points.length < 2) return null

  const headPosition = traveled[traveled.length - 1] ?? coords[0]

  return (
    <div
      className="relative rounded-2xl overflow-hidden border"
      style={{ height: 320, borderColor: 'rgba(255,255,255,0.1)', background: '#060c1a' }}
    >
      <MapContainer
        center={coords[0]}
        zoom={13}
        zoomControl={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitTrack coords={coords} />
        <Polyline positions={coords} pathOptions={{ color: 'rgba(255,255,255,0.35)', weight: 3 }} />
        <Polyline positions={traveled} pathOptions={{ color: '#ff3b30', weight: 4 }} />
        {playState === 'playing' && <PlayCameraFollow position={headPosition} />}
        <CircleMarker
          center={headPosition}
          radius={7}
          pathOptions={{ color: '#fff', weight: 2, fillColor: '#ff3b30', fillOpacity: 1 }}
        />
      </MapContainer>
      <div className="absolute bottom-3 left-3 right-3 z-[500] flex items-end justify-between" style={{ pointerEvents: 'none' }}>
        <div className="flex gap-1.5" style={{ pointerEvents: 'auto' }}>
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
        {playState !== 'idle' && currentSpeedKmh != null && (
          <div
            className="rounded-full border px-2.5 py-1.5 text-xs font-bold"
            style={{ pointerEvents: 'auto', borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(7,11,24,0.78)', color: 'var(--text)' }}
          >
            {currentSpeedKmh.toFixed(1)} km/h
          </div>
        )}
      </div>
    </div>
  )
}
