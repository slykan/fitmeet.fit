'use client'

import { slopeColor } from '@/lib/parse-gpx'

interface Point { km: number; ele: number }

interface Props {
  profile:  Point[]
  totalKm?: number
}

export default function ElevationChart({ profile, totalKm }: Props) {
  if (profile.length < 2) return null

  const W = 600
  const H = 120
  const padL = 44, padR = 12, padT = 10, padB = 28

  const minEle  = Math.min(...profile.map(p => p.ele))
  const maxEle  = Math.max(...profile.map(p => p.ele))
  const eleRange = maxEle - minEle || 1
  const maxKm   = profile[profile.length - 1].km || totalKm || 1

  function toX(km: number)  { return padL + (km / maxKm)     * (W - padL - padR) }
  function toY(ele: number) { return padT + (1 - (ele - minEle) / eleRange) * (H - padT - padB) }

  const baseline = H - padB

  // Y axis labels
  const yLabels = [minEle, minEle + eleRange / 2, maxEle].map(e => ({
    y: toY(e), label: `${Math.round(e)}m`,
  }))

  // X axis labels (4 ticks)
  const xTicks = [0, 0.33, 0.66, 1].map(t => ({
    x: toX(t * maxKm), label: `${(t * maxKm).toFixed(1)}km`,
  }))

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block' }}
        preserveAspectRatio="none"
      >
        {/* Grid lines */}
        {yLabels.map((l, i) => (
          <line key={i} x1={padL} x2={W - padR} y1={l.y} y2={l.y}
            stroke="var(--border)" strokeWidth="0.8" strokeDasharray="4 4" />
        ))}

        {/* Colored fill + line — one segment per pair of points */}
        {profile.slice(1).map((p, i) => {
          const prev  = profile[i]
          const distKm = p.km - prev.km
          const eleM   = p.ele - prev.ele
          const grade  = distKm > 0 ? (eleM / (distKm * 1000)) * 100 : 0
          const color  = slopeColor(grade)
          const x1 = toX(prev.km), y1 = toY(prev.ele)
          const x2 = toX(p.km),   y2 = toY(p.ele)

          return (
            <g key={i}>
              {/* Fill trapezoid under segment */}
              <polygon
                points={`${x1},${baseline} ${x1},${y1} ${x2},${y2} ${x2},${baseline}`}
                fill={color}
                opacity={0.12}
              />
              {/* Line segment */}
              <line x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={color} strokeWidth="2" strokeLinecap="round" />
            </g>
          )
        })}

        {/* Y labels */}
        {yLabels.map((l, i) => (
          <text key={i} x={padL - 4} y={l.y + 4} textAnchor="end"
            fontSize="9" fill="var(--text-muted)">{l.label}</text>
        ))}

        {/* X labels */}
        {xTicks.map((t, i) => (
          <text key={i} x={t.x} y={H - padB + 14} textAnchor="middle"
            fontSize="9" fill="var(--text-muted)">{t.label}</text>
        ))}
      </svg>
    </div>
  )
}
