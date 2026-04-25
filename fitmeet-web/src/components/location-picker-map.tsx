'use client'

import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { TrackSegment } from '@/lib/parse-gpx'
import type { EventWeather } from '@/lib/weather'

// Fix Leaflet default marker icons (broken in bundlers)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface Props {
  lat?:             number | null
  lng?:             number | null
  onChange?:        (lat: number, lng: number) => void
  track?:           [number, number][]
  coloredSegments?: TrackSegment[]
  readOnly?:        boolean
  height?:          number
  weather?:         EventWeather | null
}

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onChange(e.latlng.lat, e.latlng.lng) })
  return null
}

function FitTrack({ coords }: { coords: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (coords.length > 1) map.fitBounds(L.latLngBounds(coords), { padding: [20, 20] })
  }, [map, coords])
  return null
}

function WindOverlay({ weather }: { weather: EventWeather | null | undefined }) {
  const arrowStreams = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        id: i,
        y: 8 + i * 11,
        width: 140 + (i % 3) * 44,
        delay: (i * 0.32).toFixed(2),
        durationOffset: (i % 4) * 0.22,
      })),
    [],
  )

  const particles = useMemo(
    () =>
      Array.from({ length: 44 }, (_, i) => ({
        id: i,
        left: ((i * 19) % 126) - 12,
        top: (i * 11) % 100,
        delay: (i * 0.14).toFixed(2),
        size: 2 + (i % 3),
        durationOffset: (i % 5) * 0.28,
      })),
    [],
  )

  const streams = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: i,
        left: ((i * 13) % 126) - 10,
        top: 6 + ((i * 8) % 88),
        delay: (i * 0.22).toFixed(2),
        width: 72 + (i % 4) * 34,
        durationOffset: (i % 4) * 0.4,
        thickness: 2 + (i % 2),
      })),
    [],
  )

  if (!weather) return null

  const flowAngle = weather.windDir + 180
  const effectiveWind = Math.max(8, weather.windSpeed)
  const duration = Math.max(1.6, 6.2 - effectiveWind * 0.12)
  const distance = Math.min(280, 120 + effectiveWind * 5.6)
  const opacity = Math.min(0.72, 0.28 + effectiveWind / 80)
  const streamOpacity = Math.min(0.58, 0.2 + effectiveWind / 100)
  const glowOpacity = Math.min(0.24, 0.1 + effectiveWind / 180)

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 500,
          background: `linear-gradient(${flowAngle}deg, rgba(108,255,47,${glowOpacity}), rgba(255,255,255,0.02), rgba(108,255,47,${Math.min(glowOpacity + 0.06, 0.32)}))`,
        }}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
          }}
        >
          <defs>
            <linearGradient id="fitmeet-wind-line" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(255,255,255,0)" />
              <stop offset="45%" stopColor={`rgba(235,255,245,${Math.min(streamOpacity * 0.65, 0.44)})`} />
              <stop offset="100%" stopColor={`rgba(108,255,47,${Math.min(streamOpacity + 0.12, 0.72)})`} />
            </linearGradient>
          </defs>

          <g
            style={{
              transformBox: 'fill-box',
              transformOrigin: '50% 50%',
              transform: `rotate(${flowAngle}deg)`,
            }}
          >
            {arrowStreams.map((stream) => (
              <g key={`arrow-stream-${stream.id}`}>
                <line
                  x1="-25"
                  y1={stream.y}
                  x2="18"
                  y2={stream.y}
                  stroke="url(#fitmeet-wind-line)"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  style={{
                    filter: `drop-shadow(0 0 6px rgba(108,255,47,${Math.min(streamOpacity, 0.45)}))`,
                    animationName: 'fitmeet-wind-arrowline',
                    animationDuration: `${duration + stream.durationOffset}s`,
                    animationDelay: `${stream.delay}s`,
                    animationIterationCount: 'infinite',
                    animationTimingFunction: 'linear',
                    ['--wind-line-distance' as string]: `${stream.width}%`,
                  }}
                />
                <path
                  d={`M 18 ${stream.y} l -3 -2.2 l 0 1.2 l -4 0 l 0 2 l 4 0 l 0 1.2 z`}
                  fill={`rgba(108,255,47,${Math.min(streamOpacity + 0.18, 0.82)})`}
                  style={{
                    filter: `drop-shadow(0 0 8px rgba(108,255,47,${Math.min(streamOpacity + 0.1, 0.5)}))`,
                    animationName: 'fitmeet-wind-arrowline',
                    animationDuration: `${duration + stream.durationOffset}s`,
                    animationDelay: `${stream.delay}s`,
                    animationIterationCount: 'infinite',
                    animationTimingFunction: 'linear',
                    ['--wind-line-distance' as string]: `${stream.width}%`,
                  }}
                />
              </g>
            ))}
          </g>
        </svg>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `repeating-linear-gradient(${flowAngle}deg, rgba(180,255,220,0) 0px, rgba(180,255,220,0) 20px, rgba(180,255,220,${Math.min(streamOpacity * 0.35, 0.22)}) 28px, rgba(180,255,220,0) 44px)`,
            opacity: 0.55,
          }}
        />

        {streams.map((stream) => (
          <span
            key={`stream-${stream.id}`}
            style={{
              position: 'absolute',
              left: `${stream.left}%`,
              top: `${stream.top}%`,
              transform: `rotate(${flowAngle}deg)`,
              transformOrigin: 'left center',
            }}
          >
            <span
              style={{
                display: 'block',
                width: `${stream.width}px`,
                height: `${stream.thickness}px`,
                borderRadius: 999,
                background: `linear-gradient(90deg, rgba(255,255,255,0), rgba(235,255,245,${streamOpacity * 0.7}), rgba(108,255,47,${streamOpacity}), rgba(255,255,255,0))`,
                boxShadow: `0 0 12px rgba(108,255,47,${streamOpacity * 0.8})`,
                animationName: 'fitmeet-wind-stream',
                animationDuration: `${duration + stream.durationOffset}s`,
                animationDelay: `${stream.delay}s`,
                animationIterationCount: 'infinite',
                animationTimingFunction: 'linear',
                ['--wind-distance' as string]: `${distance}px`,
              }}
            />
          </span>
        ))}

        {particles.map((particle) => (
          <span
            key={particle.id}
            style={{
              position: 'absolute',
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              transform: `rotate(${flowAngle}deg)`,
            }}
          >
            <span
              style={{
                display: 'block',
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                borderRadius: 999,
                background: `rgba(245,255,250,${opacity})`,
                boxShadow: `0 0 14px rgba(108,255,47,${opacity})`,
                animationName: 'fitmeet-wind-drift',
                animationDuration: `${duration + particle.durationOffset}s`,
                animationDelay: `${particle.delay}s`,
                animationIterationCount: 'infinite',
                animationTimingFunction: 'linear',
                ['--wind-distance' as string]: `${distance}px`,
              }}
            />
          </span>
        ))}
      </div>

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
        <span
          style={{
            display: 'inline-block',
            transform: `rotate(${flowAngle}deg)`,
            color: '#6cff2f',
            lineHeight: 1,
          }}
        >
          ↑
        </span>
        <span>{weather.windSpeed} km/h</span>
      </div>

      <style>{`
        @keyframes fitmeet-wind-drift {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) scale(0.7);
          }
          12% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--wind-distance), 0, 0) scale(1);
          }
        }

        @keyframes fitmeet-wind-stream {
          0% {
            opacity: 0;
            transform: translate3d(calc(var(--wind-distance) * -0.35), 0, 0) scaleX(0.75);
          }
          18% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--wind-distance), 0, 0) scaleX(1.08);
          }
        }

        @keyframes fitmeet-wind-arrowline {
          0% {
            opacity: 0;
            transform: translateX(-18%);
          }
          12% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateX(var(--wind-line-distance));
          }
        }
      `}</style>
    </>
  )
}

export default function LocationPickerMap({
  lat, lng, onChange, track, coloredSegments, readOnly = false, height = 220, weather = null,
}: Props) {
  const hasPin      = lat != null && lng != null
  const allCoords   = coloredSegments?.flatMap(s => s.coords) ?? track ?? []
  const hasTrack    = allCoords.length > 1

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
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {!readOnly && onChange && <ClickHandler onChange={onChange} />}
        {hasPin && <Marker position={[lat!, lng!]} />}

        {coloredSegments && coloredSegments.length > 0 ? (
          <>
            {coloredSegments.map((seg, i) => (
              <Polyline
                key={i}
                positions={seg.coords}
                pathOptions={{ color: seg.color, weight: 4, opacity: 0.9 }}
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
      </MapContainer>
      {readOnly && <WindOverlay weather={weather} />}
    </div>
  )
}
