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
      Array.from({ length: 22 }, (_, i) => ({
        id: i,
        y: 3 + i * 4.3,
        width: 42 + (i % 4) * 12,
        delay: (i * 0.18).toFixed(2),
        durationOffset: (i % 5) * 0.3,
      })),
    [],
  )

  const particles = useMemo(
    () =>
      Array.from({ length: 72 }, (_, i) => ({
        id: i,
        left: ((i * 19) % 126) - 12,
        top: (i * 7) % 100,
        delay: (i * 0.1).toFixed(2),
        size: 1 + (i % 2),
        durationOffset: (i % 6) * 0.26,
      })),
    [],
  )

  const streams = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left: ((i * 13) % 126) - 10,
        top: 4 + ((i * 4.2) % 92),
        delay: (i * 0.16).toFixed(2),
        width: 26 + (i % 4) * 10,
        durationOffset: (i % 4) * 0.34,
        thickness: 1,
      })),
    [],
  )

  if (!weather) return null

  const flowAngle = weather.windDir + 180
  const effectiveWind = Math.max(8, weather.windSpeed)
  const duration = Math.max(4.2, 10.8 - effectiveWind * 0.09)
  const distance = Math.min(180, 52 + effectiveWind * 2.8)
  const opacity = Math.min(0.5, 0.16 + effectiveWind / 120)
  const streamOpacity = Math.min(0.42, 0.14 + effectiveWind / 140)
  const glowOpacity = Math.min(0.14, 0.03 + effectiveWind / 260)

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 500,
          background: `linear-gradient(${flowAngle}deg, rgba(88,190,255,${glowOpacity}), rgba(255,255,255,0.01), rgba(88,190,255,${Math.min(glowOpacity + 0.04, 0.2)}))`,
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
              <stop offset="45%" stopColor={`rgba(216,241,255,${Math.min(streamOpacity * 0.7, 0.32)})`} />
              <stop offset="100%" stopColor={`rgba(88,190,255,${Math.min(streamOpacity + 0.08, 0.56)})`} />
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
                  strokeWidth="0.8"
                  strokeLinecap="round"
                  style={{
                    filter: `drop-shadow(0 0 4px rgba(88,190,255,${Math.min(streamOpacity, 0.3)}))`,
                    animationName: 'fitmeet-wind-arrowline',
                    animationDuration: `${duration + stream.durationOffset}s`,
                    animationDelay: `${stream.delay}s`,
                    animationIterationCount: 'infinite',
                    animationTimingFunction: 'linear',
                    ['--wind-line-distance' as string]: `${stream.width}%`,
                  }}
                />
                <path
                  d={`M 18 ${stream.y} l -1.8 -1.4 l 0 0.8 l -2.8 0 l 0 1.2 l 2.8 0 l 0 0.8 z`}
                  fill={`rgba(88,190,255,${Math.min(streamOpacity + 0.12, 0.64)})`}
                  style={{
                    filter: `drop-shadow(0 0 5px rgba(88,190,255,${Math.min(streamOpacity + 0.06, 0.34)}))`,
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
            background: `repeating-linear-gradient(${flowAngle}deg, rgba(170,225,255,0) 0px, rgba(170,225,255,0) 12px, rgba(170,225,255,${Math.min(streamOpacity * 0.26, 0.12)}) 17px, rgba(170,225,255,0) 24px)`,
            opacity: 0.42,
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
                background: `linear-gradient(90deg, rgba(255,255,255,0), rgba(216,241,255,${streamOpacity * 0.55}), rgba(88,190,255,${streamOpacity}), rgba(255,255,255,0))`,
                boxShadow: `0 0 8px rgba(88,190,255,${streamOpacity * 0.6})`,
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
                background: `rgba(225,244,255,${opacity})`,
                boxShadow: `0 0 10px rgba(88,190,255,${opacity * 0.8})`,
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
            color: '#58beff',
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
