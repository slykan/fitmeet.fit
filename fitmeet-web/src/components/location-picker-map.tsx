'use client'

import { useEffect, useMemo, useState } from 'react'
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
      Array.from({ length: isHub ? (isMobile ? 184 : 156) : (isMobile ? 108 : 84) }, (_, i) => ({
        id: i,
        left: ((i * 19) % 126) - 12,
        top: (i * (isHub ? (isMobile ? 3.2 : 4) : (isMobile ? 4.8 : 6))) % 100,
        delay: (i * (isHub ? (isMobile ? 0.045 : 0.055) : (isMobile ? 0.07 : 0.09))).toFixed(2),
        size: (isHub ? (isMobile ? 2.8 : 2.3) : (isMobile ? 2.4 : 2)) + (i % 2),
        durationOffset: (i % 6) * 0.22,
      })),
    [isHub, isMobile],
  )

  const streams = useMemo(
    () =>
      Array.from({ length: isHub ? (isMobile ? 212 : 176) : (isMobile ? 112 : 88) }, (_, i) => ({
        id: i,
        left: ((i * 13) % 126) - 10,
        top: 2 + ((i * (isHub ? (isMobile ? 0.72 : 0.92) : (isMobile ? 1.2 : 1.6))) % 96),
        delay: (i * (isHub ? (isMobile ? 0.035 : 0.045) : (isMobile ? 0.055 : 0.07))).toFixed(2),
        width: (isHub ? (isMobile ? 26 : 22) : (isMobile ? 22 : 18)) + (i % 3) * (isHub ? (isMobile ? 16 : 14) : (isMobile ? 14 : 12)),
        durationOffset: (i % 5) * 0.22,
        thickness: (isHub ? 3 : 2) + (i % 2),
      })),
    [isHub, isMobile],
  )

  if (!weather || (!showWind && !showClouds)) return null

  const flowAngle = weather.windDir + 180
  const effectiveWind = Math.max(8, weather.windSpeed)
  const isCloudy = showClouds && weather.code > 0 && weather.code <= 48
  const isRainy = showClouds && ((weather.code >= 51 && weather.code <= 67) || (weather.code >= 80 && weather.code <= 82))
  const duration = Math.max(4.4, 10.6 - effectiveWind * 0.08)
  const distance = Math.min(158, 46 + effectiveWind * 2.4)
  const opacity = Math.min(
    isHub ? (isMobile ? 0.96 : 0.92) : (isMobile ? 0.9 : 0.82),
    (isHub ? (isMobile ? 0.62 : 0.54) : (isMobile ? 0.52 : 0.42)) + effectiveWind / (isHub ? (isMobile ? 72 : 80) : (isMobile ? 88 : 95)),
  )
  const streamOpacity = Math.min(
    isHub ? (isMobile ? 0.98 : 0.94) : (isMobile ? 0.9 : 0.82),
    (isHub ? (isMobile ? 0.68 : 0.58) : (isMobile ? 0.56 : 0.44)) + effectiveWind / (isHub ? (isMobile ? 68 : 76) : (isMobile ? 84 : 92)),
  )
  const glowOpacity = Math.min(
    isHub ? (isMobile ? 0.3 : 0.24) : (isMobile ? 0.22 : 0.16),
    (isHub ? (isMobile ? 0.1 : 0.07) : (isMobile ? 0.07 : 0.04)) + effectiveWind / (isHub ? (isMobile ? 120 : 150) : (isMobile ? 160 : 220)),
  )
  const cloudOpacity = isCloudy ? (isHub ? (isMobile ? 0.4 : 0.28) : (isMobile ? 0.14 : 0.1)) : 0
  const rainOpacity = isRainy ? (isHub ? (isMobile ? 0.38 : 0.28) : (isMobile ? 0.14 : 0.1)) : 0

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
            ? `linear-gradient(${flowAngle}deg, rgba(${isHub ? '8,42,94' : '10,52,108'},${glowOpacity}), rgba(255,255,255,0.01), rgba(${isHub ? '9,82,156' : '11,96,176'},${Math.min(glowOpacity + (isHub ? (isMobile ? 0.16 : 0.12) : (isMobile ? 0.1 : 0.06)), isHub ? (isMobile ? 0.42 : 0.32) : (isMobile ? 0.28 : 0.18))}))`
            : 'transparent',
        }}
      >
        {cloudOpacity > 0 && (
          <svg
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              opacity: isHub ? 0.92 : 0.78,
              mixBlendMode: 'multiply',
            }}
          >
            <defs>
              <filter id="fitmeet-cloud-blur">
                <feGaussianBlur stdDeviation="24" />
              </filter>
            </defs>
            <g filter="url(#fitmeet-cloud-blur)">
              <path
                d="M22 148 C92 92, 198 86, 304 122 C408 156, 476 144, 560 116 C686 74, 808 88, 930 156 L930 344 C836 316, 738 306, 630 328 C488 356, 360 348, 240 314 C148 288, 78 286, 22 300 Z"
                fill={`rgba(46,60,84,${cloudOpacity * 0.78})`}
              />
              <path
                d="M96 446 C194 396, 302 392, 404 428 C490 458, 576 466, 662 444 C772 416, 866 422, 968 470 L968 654 C862 626, 754 620, 632 644 C508 668, 392 666, 278 636 C188 612, 112 612, 34 632 L34 496 C56 482, 74 462, 96 446 Z"
                fill={`rgba(34,48,70,${cloudOpacity * 0.72})`}
              />
              <path
                d="M146 702 C246 668, 344 670, 450 698 C552 724, 646 726, 742 700 C826 678, 906 680, 980 710 L980 864 C900 850, 822 848, 730 860 C618 876, 504 878, 394 860 C294 844, 198 838, 98 850 L98 728 C114 720, 128 708, 146 702 Z"
                fill={`rgba(42,56,78,${cloudOpacity * 0.68})`}
              />
              <ellipse cx="232" cy="248" rx="120" ry="54" fill={`rgba(132,148,172,${cloudOpacity * 0.18})`} />
              <ellipse cx="712" cy="214" rx="146" ry="62" fill={`rgba(138,154,178,${cloudOpacity * 0.16})`} />
              <ellipse cx="554" cy="560" rx="162" ry="70" fill={`rgba(128,144,170,${cloudOpacity * 0.14})`} />
              <ellipse cx="302" cy="780" rx="152" ry="62" fill={`rgba(126,142,168,${cloudOpacity * 0.12})`} />
            </g>
          </svg>
        )}

        {rainOpacity > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `repeating-linear-gradient(${flowAngle + 18}deg, rgba(84,152,214,0) 0px, rgba(84,152,214,0) 9px, rgba(84,152,214,${rainOpacity}) 11px, rgba(84,152,214,0) 15px)`,
              opacity: isHub ? 0.72 : 0.38,
              animation: 'fitmeet-rain-shift 7s linear infinite',
            }}
          />
        )}

        {showWind && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `repeating-linear-gradient(${flowAngle}deg, rgba(33,113,181,0) 0px, rgba(33,113,181,0) 10px, rgba(18,88,162,${Math.min(streamOpacity * (isHub ? (isMobile ? 0.18 : 0.14) : (isMobile ? 0.12 : 0.08)), isHub ? (isMobile ? 0.16 : 0.12) : (isMobile ? 0.08 : 0.05))}) 13px, rgba(33,113,181,0) 20px)`,
              opacity: isHub ? (isMobile ? 0.24 : 0.18) : (isMobile ? 0.16 : 0.1),
            }}
          />
        )}

        {showWind && streams.map((stream) => (
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
                opacity: 0,
                background: `linear-gradient(90deg, rgba(255,255,255,0), rgba(170,220,255,${streamOpacity * 0.72}), rgba(28,122,214,${streamOpacity}), rgba(255,255,255,0))`,
                boxShadow: `0 0 16px rgba(28,122,214,${streamOpacity})`,
                transform: `translate3d(calc(${distance}px * -0.18), 0, 0) scaleX(0.85)`,
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

        {showWind && particles.map((particle) => (
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
                opacity: 0,
                background: `rgba(126,198,255,${opacity})`,
                boxShadow: `0 0 14px rgba(28,122,214,${opacity})`,
                transform: 'translate3d(0, 0, 0) scale(0.7)',
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
          <span
            style={{
              display: 'inline-block',
              transform: `rotate(${flowAngle}deg)`,
              color: '#58beff',
              lineHeight: 1,
              fontSize: 14,
            }}
          >
            {'\u2192'}
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
