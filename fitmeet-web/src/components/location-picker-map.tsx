'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap, ZoomControl } from 'react-leaflet'
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
  readOnly?:        boolean
  height?:          number
  weather?:         EventWeather | null
  weatherVariant?:  'default' | 'hub'
  showWindOverlay?: boolean
  showCloudOverlay?: boolean
  showMapLayerControl?: boolean
}

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
      Array.from({ length: isHub ? (isMobile ? 30 : 24) : (isMobile ? 16 : 12) }, (_, i) => ({
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

  const streams = useMemo(
    () =>
      Array.from({ length: isHub ? (isMobile ? 22 : 18) : (isMobile ? 12 : 10) }, (_, i) => ({
        id: i,
        left: ((i * 13) % 126) - 10,
        top: 2 + ((i * (isHub ? (isMobile ? 8 : 10) : (isMobile ? 12 : 16))) % 96),
        delay: (i * (isHub ? (isMobile ? 0.4 : 0.5) : (isMobile ? 0.6 : 0.75))).toFixed(2),
        width: (isHub ? (isMobile ? 22 : 20) : (isMobile ? 20 : 18)) + (i % 3) * (isHub ? (isMobile ? 10 : 9) : (isMobile ? 9 : 8)),
        durationOffset: (i % 5) * 0.35,
        thickness: (isHub ? 2.6 : 2.2) + (i % 2) * 0.6,
        drawDuration: 2.2 + (i % 4) * 0.5,
        drawDelay: (i * 0.37) % 3,
        wavePhase: i % 2 === 0 ? 1 : -1,
        waveAmp: 3 + (i % 3) * 2,
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
  const duration = Math.max(7.5, 16 - effectiveWind * 0.08)
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
  const hubStreamBoost = isHub ? (isMobile ? 1.22 : 1.18) : 1
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

        {showWind && streams.map((stream) => (
          <span
            key={`stream-${stream.id}`}
            style={{
              position: 'absolute',
              left: `${stream.left}%`,
              top: `${stream.top}%`,
              transform: `rotate(${windTransformAngle}deg)`,
              transformOrigin: 'left center',
            }}
          >
            <svg
              width={stream.width}
              height={Math.max(stream.thickness * 6, 10)}
              viewBox="0 0 100 24"
              style={{
                display: 'block',
                overflow: 'visible',
                opacity: 0,
                transform: `translate3d(calc(${distance}px * -0.18), 0, 0) scaleX(0.85)`,
                animationName: 'fitmeet-wind-stream',
                animationDuration: `${duration + stream.durationOffset}s`,
                animationDelay: `${stream.delay}s`,
                animationIterationCount: 'infinite',
                animationTimingFunction: 'linear',
                ['--wind-distance' as string]: `${distance}px`,
                ['--wind-wave-dir' as string]: stream.wavePhase,
                ['--wind-wave' as string]: `${stream.waveAmp}px`,
              }}
            >
              <path
                d="M4,14 Q50,2 96,13"
                fill="none"
                stroke={`rgba(4,8,8,${Math.min(streamOpacity * hubStreamBoost * 0.8 + 0.35, 0.85)})`}
                strokeWidth={stream.thickness + 2}
                strokeLinecap="round"
                pathLength={100}
                style={{
                  strokeDasharray: 100,
                  animationName: 'fitmeet-wind-draw',
                  animationDuration: `${stream.drawDuration}s`,
                  animationDelay: `${stream.drawDelay}s`,
                  animationIterationCount: 'infinite',
                  animationTimingFunction: 'ease-in-out',
                }}
              />
              <path
                d="M4,14 Q50,2 96,13"
                fill="none"
                stroke={`rgba(235,245,255,${Math.max(Math.min(streamOpacity * (isHub ? 1.3 : 1.15), 1), 0.85)})`}
                strokeWidth={stream.thickness}
                strokeLinecap="round"
                pathLength={100}
                style={{
                  strokeDasharray: 100,
                  animationName: 'fitmeet-wind-draw',
                  animationDuration: `${stream.drawDuration}s`,
                  animationDelay: `${stream.drawDelay}s`,
                  animationIterationCount: 'infinite',
                  animationTimingFunction: 'ease-in-out',
                }}
              />
            </svg>
          </span>
        ))}

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
                display: 'block',
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                borderRadius: 999,
                opacity: 0,
                background: `rgba(255,255,255,${Math.min(opacity * (isHub ? 1.3 : 1.14), 1)})`,
                boxShadow: `0 0 3px 1px rgba(6,10,10,${Math.min(opacity * hubParticleBoost * 0.72, 0.72)}), 0 0 16px rgba(210,232,255,${Math.min(opacity * hubParticleBoost, 1)})`,
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

        @keyframes fitmeet-wind-stream {
          0% {
            opacity: 0;
            transform: translate3d(calc(var(--wind-distance) * -0.18), 0, 0) scaleX(0.85);
          }
          22% {
            opacity: 1;
          }
          40% {
            transform: translate3d(calc(var(--wind-distance) * 0.14), calc(var(--wind-wave-dir, 1) * var(--wind-wave, 4px)), 0) scaleX(0.9);
          }
          65% {
            transform: translate3d(calc(var(--wind-distance) * 0.5), calc(var(--wind-wave-dir, 1) * var(--wind-wave, 4px) * -1), 0) scaleX(0.95);
          }
          85% {
            transform: translate3d(calc(var(--wind-distance) * 0.78), calc(var(--wind-wave-dir, 1) * var(--wind-wave, 4px) * 0.5), 0) scaleX(1);
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--wind-distance), 0, 0) scaleX(1);
          }
        }

        @keyframes fitmeet-wind-draw {
          0% {
            stroke-dashoffset: 100;
          }
          45% {
            stroke-dashoffset: 0;
          }
          55% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: -100;
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
  readOnly = false,
  height = 220,
  weather = null,
  weatherVariant = 'default',
  showWindOverlay = true,
  showCloudOverlay = true,
  showMapLayerControl = false,
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
        {!readOnly && onChange && <ClickHandler onChange={onChange} />}
        {readOnly && <ReadOnlyViewSync onViewChange={onViewChange} onInteractionChange={onInteractionChange} />}
        {hasPin && <Marker position={[lat!, lng!]} />}

        {hasLayeredSegments ? (
          <>
            {surfaceSegments?.map((seg, i) => (
              <Polyline
                key={`surface-${i}`}
                positions={seg.coords}
                pathOptions={{ color: seg.color, weight: 9, opacity: 0.72, dashArray: seg.dashArray, lineCap: 'round', lineJoin: 'round' }}
              />
            ))}
            {elevationSegments?.map((seg, i) => (
              <Polyline
                key={`elevation-${i}`}
                positions={seg.coords}
                pathOptions={{ color: seg.color, weight: 4, opacity: 0.98, lineCap: 'round', lineJoin: 'round' }}
              />
            ))}
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
      </MapContainer>
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
          showClouds={showCloudOverlay}
        />
      )}
    </div>
  )
}
