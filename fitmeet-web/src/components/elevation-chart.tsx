'use client'

import { slopeColor } from '@/lib/parse-gpx'

interface Point { km: number; ele: number }

interface Props {
  profile:  Point[]
  totalKm?: number
  /** 0..1 reveal fraction while the route "play" animation runs. Omit for the normal, fully-drawn chart. */
  progress?: number
}

export default function ElevationChart({ profile, totalKm, progress }: Props) {
  if (profile.length < 2) return null

  const animating = progress != null && progress < 1
  const visibleProfile = animating
    ? profile.slice(0, Math.max(2, Math.ceil(progress * profile.length)))
    : profile
  const head = animating ? visibleProfile[visibleProfile.length - 1] : null

  const W = 600
  const H = 120
  const padL = 44, padR = 12, padT = 10, padB = 28

  // Axis scale stays fixed to the full profile so it doesn't jump around while animating
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
        {visibleProfile.slice(1).map((p, i) => {
          const prev  = visibleProfile[i]
          const distKm = p.km - prev.km
          const eleM   = p.ele - prev.ele
          const grade  = distKm > 0 ? (eleM / (distKm * 1000)) * 100 : 0
          const color  = animating ? '#39ff14' : slopeColor(grade)
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

        {/* Playhead dot while animating */}
        {head && (
          <circle cx={toX(head.km)} cy={toY(head.ele)} r={4} fill="#39ff14" stroke="#0A0A12" strokeWidth={1.5} />
        )}

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
