'use client'

import { useEffect, useState } from 'react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

const PINS = [
  { coordinates: [-74, 40.7],    emoji: '🏃', delay: 0 },
  { coordinates: [-43, -22.9],   emoji: '🚴', delay: 0.5 },
  { coordinates: [2.3, 48.9],    emoji: '⚽', delay: 1 },
  { coordinates: [36.8, -1.3],   emoji: '🎉', delay: 0.3 },
  { coordinates: [139.7, 35.7],  emoji: '🏊', delay: 0.8 },
  { coordinates: [151.2, -33.9], emoji: '🥾', delay: 1.3 },
  { coordinates: [37.6, 55.8],   emoji: '🧘', delay: 0.6 },
  { coordinates: [18.4, -33.9],  emoji: '🏕️', delay: 1.1 },
  { coordinates: [72.9, 19.1],   emoji: '🏀', delay: 0.2 },
  { coordinates: [-99.1, 19.4],  emoji: '🎸', delay: 0.9 },
  { coordinates: [103.8, 1.3],   emoji: '🏄', delay: 0.4 },
  { coordinates: [-58.4, -34.6], emoji: '🎾', delay: 1.5 },
]

export function HeroMap() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return <div className="w-full max-w-3xl mx-auto h-[420px]" />

  return (
    <>
      <style>{`
        @keyframes ping-ring {
          0%   { r: 14; opacity: 0.8; }
          100% { r: 32; opacity: 0; }
        }
        .pulse-ring {
          animation: ping-ring 2.5s ease-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
      `}</style>

      <div className="relative w-full max-w-3xl mx-auto select-none pointer-events-none">
        <ComposableMap
          projection="geoNaturalEarth1"
          projectionConfig={{ scale: 145 }}
          width={800}
          height={420}
        >
          <defs>
            <filter id="map-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="pin-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: any[] }) =>
              geographies.map((geo: any) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="rgba(0,168,255,0.08)"
                  stroke="rgba(0,168,255,0.5)"
                  strokeWidth={0.6}
                  style={{ outline: 'none', filter: 'url(#map-glow)' }}
                />
              ))
            }
          </Geographies>

          {PINS.map(({ coordinates, emoji, delay }, i) => (
            <Marker key={i} coordinates={coordinates as [number, number]}>
              {/* Pulsing ring — CSS animated */}
              <circle
                className="pulse-ring"
                r={14}
                fill="none"
                stroke="#39ff14"
                strokeWidth={1.5}
                filter="url(#pin-glow)"
                style={{ animationDelay: `${delay}s` }}
              />
              {/* Static outer ring */}
              <circle
                r={15}
                fill="rgba(57,255,20,0.06)"
                stroke="rgba(57,255,20,0.25)"
                strokeWidth={1}
              />
              {/* Pin */}
              <circle r={13} fill="#0d1117" stroke="rgba(57,255,20,0.7)" strokeWidth={1.5} filter="url(#pin-glow)" />
              <text textAnchor="middle" dominantBaseline="central" fontSize={13} style={{ userSelect: 'none' }}>
                {emoji}
              </text>
            </Marker>
          ))}
        </ComposableMap>

        <div
          className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
          style={{ background: 'linear-gradient(to top, var(--background), transparent)' }}
        />
      </div>
    </>
  )
}
