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
  const particles = useMemo(
    () =>
      Array.from({ length: 84 }, (_, i) => ({
        id: i,
        left: ((i * 19) % 126) - 12,
        top: (i * 6) % 100,
        delay: (i * 0.09).toFixed(2),
        size: 2 + (i % 2),
        durationOffset: (i % 6) * 0.22,
      })),
    [],
  )

  const streams = useMemo(
    () =>
      Array.from({ length: 88 }, (_, i) => ({
        id: i,
        left: ((i * 13) % 126) - 10,
        top: 2 + ((i * 1.6) % 96),
        delay: (i * 0.07).toFixed(2),
        width: 18 + (i % 3) * 12,
        durationOffset: (i % 5) * 0.22,
        thickness: 2 + (i % 2),
      })),
    [],
  )

  if (!weather) return null

  const flowAngle = weather.windDir + 180
  const effectiveWind = Math.max(8, weather.windSpeed)
  const duration = Math.max(4.4, 10.6 - effectiveWind * 0.08)
  const distance = Math.min(158, 46 + effectiveWind * 2.4)
  const opacity = Math.min(0.72, 0.34 + effectiveWind / 110)
  const streamOpacity = Math.min(0.7, 0.34 + effectiveWind / 105)
  const glowOpacity = Math.min(0.24, 0.08 + effectiveWind / 180)

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 500,
          background: `linear-gradient(${flowAngle}deg, rgba(14,74,138,${glowOpacity}), rgba(255,255,255,0.01), rgba(11,96,176,${Math.min(glowOpacity + 0.12, 0.36)}))`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `repeating-linear-gradient(${flowAngle}deg, rgba(33,113,181,0) 0px, rgba(33,113,181,0) 9px, rgba(18,88,162,${Math.min(streamOpacity * 0.42, 0.3)}) 13px, rgba(33,113,181,0) 20px)`,
            opacity: 0.78,
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
                background: `linear-gradient(90deg, rgba(255,255,255,0), rgba(92,158,216,${streamOpacity * 0.52}), rgba(12,88,165,${streamOpacity}), rgba(255,255,255,0))`,
                boxShadow: `0 0 14px rgba(12,88,165,${streamOpacity})`,
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
                background: `rgba(38,110,183,${opacity})`,
                boxShadow: `0 0 10px rgba(12,88,165,${opacity * 0.92})`,
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
            fontSize: 14,
          }}
        >
          →
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
            transform: translate3d(calc(var(--wind-distance) * -0.18), 0, 0) scaleX(0.85);
          }
          22% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--wind-distance), 0, 0) scaleX(1);
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
