'use client'

// Stacked line charts for a training's streams (HR, pace/speed, elevation, power,
// cadence) — plain SVG, same approach and rules as the app's TrainingCharts:
// light rolling-mean smoothing for display, avg/max from raw values, best pace/speed
// from the smoothed line (GPS spikes), labels in HTML so they never stretch.

export type ChartSeries = {
  key: string
  label: string
  color: string
  values: (number | null)[]
  invert?: boolean
  smooth?: boolean
  format: (v: number) => string
}

const W = 600
const H = 110

function smoothed(values: (number | null)[], r: number): (number | null)[] {
  return values.map((v, i) => {
    if (v == null) return null
    let sum = 0, n = 0
    for (let k = Math.max(0, i - r); k <= Math.min(values.length - 1, i + r); k++) {
      const w = values[k]
      if (w != null && isFinite(w)) { sum += w; n++ }
    }
    return n ? sum / n : v
  })
}

function Chart({ x, s, xUnit, id }: { x: number[]; s: ChartSeries; xUnit: string; id: string }) {
  const maxX = x[x.length - 1] || 1
  const raw = s.values.map((v, i) => (v == null || !isFinite(v) ? null : [x[i], v] as [number, number])).filter(Boolean) as [number, number][]
  if (raw.length < 2) return null
  const shown = s.smooth === false ? s.values : smoothed(s.values, Math.max(1, Math.round(s.values.length / 150)))
  const pts = shown.map((v, i) => (v == null || !isFinite(v) ? null : [x[i], v] as [number, number])).filter(Boolean) as [number, number][]
  const ys = pts.map(p => p[1]).sort((a, b) => a - b)
  const rawYs = raw.map(p => p[1]).sort((a, b) => a - b)
  const lo = ys[Math.floor(ys.length * 0.02)]
  const hi = ys[Math.ceil(ys.length * 0.98) - 1]
  const range = hi - lo || 1
  const toX = (v: number) => (v / maxX) * W
  const toY = (v: number) => {
    const t = Math.min(1, Math.max(0, (v - lo) / range))
    return 6 + (s.invert ? t : 1 - t) * (H - 10)
  }
  const avg = raw.reduce((a, p) => a + p[1], 0) / raw.length
  const peakFrom = s.key === 'pace' || s.key === 'speed' ? ys : rawYs
  const peak = s.invert ? peakFrom[0] : peakFrom[peakFrom.length - 1]
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${toX(p[0]).toFixed(1)},${toY(p[1]).toFixed(1)}`).join('')
  const area = `${d}L${toX(pts[pts.length - 1][0]).toFixed(1)},${H}L${toX(pts[0][0]).toFixed(1)},${H}Z`

  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
        <span className="text-sm font-bold">{s.label}</span>
        <span className="ml-auto flex gap-1.5">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border" style={{ color: s.color, borderColor: `${s.color}66` }}>Ø {s.format(avg)}</span>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>{s.invert ? 'best' : 'max'} {s.format(peak)}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-28 block">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={s.color} stopOpacity="0.35" />
            <stop offset="1" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f} x1={f * W} y1={0} x2={f * W} y2={H} stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} fill={`url(#${id})`} />
        <path d={d} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <line x1={0} y1={toY(avg)} x2={W} y2={toY(avg)} stroke={s.color} strokeDasharray="5 5" strokeOpacity={0.7} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
        <span>0</span><span>{(maxX / 2).toFixed(maxX < 10 ? 1 : 0)}</span><span>{maxX.toFixed(maxX < 10 ? 1 : 0)} {xUnit}</span>
      </div>
    </div>
  )
}

export function TrainingCharts({ x, xUnit, series }: { x: number[]; xUnit: string; series: ChartSeries[] }) {
  return (
    <div className="space-y-5">
      {series.map(s => <Chart key={s.key} x={x} s={s} xUnit={xUnit} id={`grad-${s.key}`} />)}
    </div>
  )
}
