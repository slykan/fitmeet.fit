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
}

const ROW_H = 150

// Stacked line charts drawn as inline SVG in one WebView (same approach as
// ElevationChart — no native chart dependency). x is distance (km) or time (min).
function buildHtml(x: number[], xUnit: string, series: ChartSeries[], formatJs: string[]): string {
  const W = 600
  const H = 130
  const padL = 46, padR = 10, padT = 22, padB = 22
  const maxX = x[x.length - 1] || 1
  const toX = (v: number) => padL + (v / maxX) * (W - padL - padR)

  const charts = series.map((s, si) => {
    const pts = s.values.map((v, i) => (v == null || !isFinite(v) ? null : [x[i], v] as [number, number])).filter(Boolean) as [number, number][]
    if (pts.length < 2) return ''
    const ys = pts.map(p => p[1]).sort((a, b) => a - b)
    // Trim the extremes (GPS/pace spikes) so one outlier doesn't flatten the chart.
    const lo = ys[Math.floor(ys.length * 0.02)]
    const hi = ys[Math.ceil(ys.length * 0.98) - 1]
    const range = hi - lo || 1
    const toY = (v: number) => {
      const t = Math.min(1, Math.max(0, (v - lo) / range))
      return padT + (s.invert ? t : 1 - t) * (H - padT - padB)
    }
    const avg = pts.reduce((a, p) => a + p[1], 0) / pts.length
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${toX(p[0]).toFixed(1)},${toY(p[1]).toFixed(1)}`).join('')
    const area = `${d}L${toX(pts[pts.length - 1][0]).toFixed(1)},${H - padB}L${toX(pts[0][0]).toFixed(1)},${H - padB}Z`
    const fmt = `(${formatJs[si]})`
    return `
      <div class="row">
        <div class="head"><span class="dot" style="background:${s.color}"></span>${s.label}
          <span class="avg" data-v="${avg}" data-f="${si}"></span></div>
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          <defs><linearGradient id="g${si}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${s.color}" stop-opacity="0.35"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs>
          <line x1="${padL}" y1="${toY(hi)}" x2="${W - padR}" y2="${toY(hi)}" class="grid"/>
          <line x1="${padL}" y1="${toY(lo)}" x2="${W - padR}" y2="${toY(lo)}" class="grid"/>
          <text x="${padL - 6}" y="${toY(hi) + 4}" class="lab" text-anchor="end" data-v="${hi}" data-f="${si}"></text>
          <text x="${padL - 6}" y="${toY(lo) + 4}" class="lab" text-anchor="end" data-v="${lo}" data-f="${si}"></text>
          <path d="${area}" fill="url(#g${si})"/>
          <path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round"/>
          <line x1="${padL}" y1="${toY(avg)}" x2="${W - padR}" y2="${toY(avg)}" stroke="${s.color}" stroke-dasharray="5 5" stroke-opacity="0.7"/>
          <text x="${padL}" y="${H - 6}" class="lab">0</text>
          <text x="${W - padR}" y="${H - 6}" class="lab" text-anchor="end">${maxX.toFixed(maxX < 10 ? 1 : 0)} ${xUnit}</text>
        </svg>
      </div>`
  }).join('')

  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  html,body{margin:0;background:transparent;font-family:-apple-system,Roboto,sans-serif;color:#eafff0}
  .row{height:${ROW_H}px;box-sizing:border-box;padding:4px 0}
  .head{font-size:12px;font-weight:800;display:flex;align-items:center;gap:6px;height:18px}
  .dot{width:8px;height:8px;border-radius:4px;display:inline-block}
  .avg{margin-left:auto;color:#9fb3a8;font-weight:700}
  svg{width:100%;height:${ROW_H - 22}px;display:block}
  .grid{stroke:rgba(255,255,255,0.08);stroke-width:1}
  .lab{fill:#7d8f86;font-size:15px}
</style></head><body>${charts}
<script>
  var F = [${formatJs.join(',')}];
  document.querySelectorAll('[data-f]').forEach(function(el){
    var v = parseFloat(el.getAttribute('data-v')), f = F[+el.getAttribute('data-f')];
    el.textContent = (el.classList.contains('avg') ? 'Ø ' : '') + f(v);
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
