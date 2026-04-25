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
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: (i * 37) % 100,
        top: (i * 19) % 100,
        delay: (i * 0.17).toFixed(2),
        size: 2 + (i % 3),
      })),
    [],
  )

  if (!weather || weather.windSpeed <= 0) return null

  const flowAngle = weather.windDir + 180
  const duration = Math.max(1.8, 8 - weather.windSpeed * 0.18)
  const distance = Math.min(140, 48 + weather.windSpeed * 3)
  const opacity = Math.min(0.42, 0.12 + weather.windSpeed / 80)

  return (
    <>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: 500,
        }}
      >
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
              background: `rgba(255,255,255,${opacity})`,
              boxShadow: `0 0 10px rgba(108,255,47,${opacity})`,
              animationName: 'fitmeet-wind-drift',
              animationDuration: `${duration}s`,
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
