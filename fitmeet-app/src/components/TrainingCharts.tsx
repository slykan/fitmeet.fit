import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'

export type ChartSeries = {
  key: string
  label: string
  unit: string
  color: string
  values: (number | null)[]
  /** Pace: lower is better, so the axis runs the other way. */
  invert?: boolean
  format?: (v: number) => string
  /** Elevation is already smooth; noisy signals get a light rolling mean for display. */
  smooth?: boolean
}

const ROW_H = 150

// Rolling mean over ±r points (gaps stay gaps) — display only; avg/max use raw values.
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

// Stacked line charts drawn as inline SVG in one WebView (same approach as
// ElevationChart — no native chart dependency). x is distance (km) or time (min).
function buildHtml(x: number[], xUnit: string, series: ChartSeries[], formatJs: string[]): string {
  const W = 600
  const H = 130
  const padL = 2, padR = 2, padT = 8, padB = 4
  const maxX = x[x.length - 1] || 1
  const toX = (v: number) => padL + (v / maxX) * (W - padL - padR)

  const charts = series.map((s, si) => {
    const raw = s.values.map((v, i) => (v == null || !isFinite(v) ? null : [x[i], v] as [number, number])).filter(Boolean) as [number, number][]
    if (raw.length < 2) return ''
    const shown = s.smooth === false ? s.values : smoothed(s.values, Math.max(1, Math.round(s.values.length / 150)))
    const pts = shown.map((v, i) => (v == null || !isFinite(v) ? null : [x[i], v] as [number, number])).filter(Boolean) as [number, number][]
    const rawYs = raw.map(p => p[1]).sort((a, b) => a - b)
    const ys = pts.map(p => p[1]).sort((a, b) => a - b)
    // Trim the extremes (GPS/pace spikes) so one outlier doesn't flatten the chart.
    const lo = ys[Math.floor(ys.length * 0.02)]
    const hi = ys[Math.ceil(ys.length * 0.98) - 1]
    const range = hi - lo || 1
    const toY = (v: number) => {
      const t = Math.min(1, Math.max(0, (v - lo) / range))
      return padT + (s.invert ? t : 1 - t) * (H - padT - padB)
    }
    const avg = raw.reduce((a, p) => a + p[1], 0) / raw.length
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${toX(p[0]).toFixed(1)},${toY(p[1]).toFixed(1)}`).join('')
    const area = `${d}L${toX(pts[pts.length - 1][0]).toFixed(1)},${H - padB}L${toX(pts[0][0]).toFixed(1)},${H - padB}Z`
    const peak = s.invert ? rawYs[0] : rawYs[rawYs.length - 1]
    // Labels live in HTML: the SVG stretches to the screen width (preserveAspectRatio
    // none), which would distort any text drawn inside it.
    return `
      <div class="row">
        <div class="head"><span class="dot" style="background:${s.color}"></span>${s.label}
          <span class="val"><span data-v="${avg}" data-f="${si}" data-p="Ø "></span> · <span data-v="${peak}" data-f="${si}" data-p="${s.invert ? 'best ' : 'max '}"></span></span></div>
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          <defs><linearGradient id="g${si}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${s.color}" stop-opacity="0.35"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs>
          <line x1="${padL}" y1="${toY(hi)}" x2="${W - padR}" y2="${toY(hi)}" class="grid"/>
          <line x1="${padL}" y1="${toY(lo)}" x2="${W - padR}" y2="${toY(lo)}" class="grid"/>
          <path d="${area}" fill="url(#g${si})"/>
          <path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
          <line x1="${padL}" y1="${toY(avg)}" x2="${W - padR}" y2="${toY(avg)}" stroke="${s.color}" stroke-dasharray="5 5" stroke-opacity="0.7" vector-effect="non-scaling-stroke"/>
        </svg>
        <div class="axis"><span>0</span><span>${maxX.toFixed(maxX < 10 ? 1 : 0)} ${xUnit}</span></div>
      </div>`
  }).join('')

  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  html,body{margin:0;background:transparent;font-family:-apple-system,Roboto,sans-serif;color:#eafff0}
  .row{height:${ROW_H}px;box-sizing:border-box;padding:4px 0}
  .head{font-size:12px;font-weight:800;display:flex;align-items:center;gap:6px;height:18px}
  .dot{width:8px;height:8px;border-radius:4px;display:inline-block}
  .val{margin-left:auto;color:#9fb3a8;font-weight:700}
  svg{width:100%;height:${ROW_H - 40}px;display:block}
  .grid{stroke:rgba(255,255,255,0.08);stroke-width:1;vector-effect:non-scaling-stroke}
  .axis{display:flex;justify-content:space-between;font-size:10px;color:#7d8f86;height:14px}
</style></head><body>${charts}
<script>
  var F = [${formatJs.join(',')}];
  document.querySelectorAll('[data-f]').forEach(function(el){
    var v = parseFloat(el.getAttribute('data-v')), f = F[+el.getAttribute('data-f')];
    el.textContent = (el.getAttribute('data-p') || '') + f(v);
  });
</script></body></html>`
}

export function TrainingCharts({ x, xUnit, series, formatters }: {
  x: number[]
  xUnit: string
  series: ChartSeries[]
  /** One JS function source per series, e.g. "function(v){return Math.round(v)+' bpm'}" */
  formatters: string[]
}) {
  const html = useMemo(() => buildHtml(x, xUnit, series, formatters), [x, xUnit, series, formatters])
  const source = useMemo(() => ({ html }), [html])
  if (series.length === 0) return null

  return (
    <View style={[styles.wrap, { height: series.length * ROW_H }]}>
      <WebView
        source={source}
        originWhitelist={['*']}
        scrollEnabled={false}
        style={styles.webview}
        pointerEvents="none"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  webview: { flex: 1, backgroundColor: 'transparent' },
})
