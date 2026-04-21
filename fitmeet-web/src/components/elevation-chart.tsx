'use client'

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

  const minEle = Math.min(...profile.map(p => p.ele))
  const maxEle = Math.max(...profile.map(p => p.ele))
  const eleRange = maxEle - minEle || 1
  const maxKm  = profile[profile.length - 1].km || totalKm || 1

  function toX(km: number)  { return padL + (km / maxKm)     * (W - padL - padR) }
  function toY(ele: number) { return padT + (1 - (ele - minEle) / eleRange) * (H - padT - padB) }

  const pts  = profile.map(p => `${toX(p.km).toFixed(1)},${toY(p.ele).toFixed(1)}`).join(' ')
  const fill = [
    `${toX(profile[0].km).toFixed(1)},${(H - padB).toFixed(1)}`,
    ...profile.map(p => `${toX(p.km).toFixed(1)},${toY(p.ele).toFixed(1)}`),
    `${toX(profile[profile.length - 1].km).toFixed(1)},${(H - padB).toFixed(1)}`,
  ].join(' ')

  // Y axis labels
  const yLabels = [minEle, minEle + eleRange / 2, maxEle].map(e => ({
    y:     toY(e),
    label: `${Math.round(e)}m`,
  }))

  // X axis labels (4 ticks)
  const xTicks = [0, 0.33, 0.66, 1].map(t => ({
    x:     toX(t * maxKm),
    label: `${(t * maxKm).toFixed(1)}km`,
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

        {/* Fill */}
        <polygon points={fill} fill="rgba(57,255,20,0.12)" />

        {/* Line */}
        <polyline points={pts} fill="none" stroke="#39ff14" strokeWidth="1.8" strokeLinejoin="round" />

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
