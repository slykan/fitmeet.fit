import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'

export interface ElevationPoint { km: number; ele: number }

function slopeColor(grade: number): string {
  if (grade < -2) return '#39ff14'
  if (grade <  3) return '#3399ff'
  if (grade <  7) return '#ffaa00'
  return '#ff2200'
}

function buildHtml(profile: ElevationPoint[]): string {
  if (profile.length < 2) return '<html><body style="background:#060c1a"></body></html>'

  const W = 600
  const H = 120
  const padL = 44, padR = 12, padT = 10, padB = 28

  const minEle   = Math.min(...profile.map(p => p.ele))
  const maxEle   = Math.max(...profile.map(p => p.ele))
  const eleRange = maxEle - minEle || 1
  const maxKm    = profile[profile.length - 1].km || 1

  function toX(km: number)  { return padL + (km / maxKm)            * (W - padL - padR) }
  function toY(ele: number) { return padT + (1 - (ele - minEle) / eleRange) * (H - padT - padB) }

  const baseline = H - padB

  const yLabels = [minEle, minEle + eleRange / 2, maxEle].map(e => ({
    y: toY(e), label: `${Math.round(e)}m`,
  }))

  const xTicks = [0, 0.33, 0.66, 1].map(t => ({
    x: toX(t * maxKm), label: `${(t * maxKm).toFixed(1)}km`,
  }))

  const segments = profile.slice(1).map((p, i) => {
    const prev   = profile[i]
    const distKm = p.km - prev.km
    const eleM   = p.ele - prev.ele
    const grade  = distKm > 0 ? (eleM / (distKm * 1000)) * 100 : 0
    const color  = slopeColor(grade)
    const x1 = toX(prev.km), y1 = toY(prev.ele)
    const x2 = toX(p.km),    y2 = toY(p.ele)
    return { x1, y1, x2, y2, color }
  })

  const gridLines = yLabels.map(l =>
    `<line x1="${padL}" x2="${W - padR}" y1="${l.y}" y2="${l.y}" stroke="#1e2a45" stroke-width="0.8" stroke-dasharray="4 4"/>`
  ).join('')

  const fills = segments.map(s =>
    `<polygon points="${s.x1},${baseline} ${s.x1},${s.y1} ${s.x2},${s.y2} ${s.x2},${baseline}" fill="${s.color}" opacity="0.12"/>`
  ).join('')

  const lines = segments.map(s =>
    `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${s.color}" stroke-width="2" stroke-linecap="round"/>`
  ).join('')

  const yText = yLabels.map(l =>
    `<text x="${padL - 4}" y="${l.y + 4}" text-anchor="end" font-size="9" fill="#6b7fa3">${l.label}</text>`
  ).join('')

  const xText = xTicks.map(t =>
    `<text x="${t.x}" y="${H - padB + 14}" text-anchor="middle" font-size="9" fill="#6b7fa3">${t.label}</text>`
  ).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:100%;height:100%;background:#060c1a;overflow:hidden;}
  svg{display:block;width:100%;height:100%;}
</style>
</head>
<body>
<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
  ${gridLines}
  ${fills}
  ${lines}
  ${yText}
  ${xText}
</svg>
</body>
</html>`
}

interface Props {
  profile: ElevationPoint[]
}

export function ElevationChart({ profile }: Props) {
  const html = useMemo(() => buildHtml(profile), [profile])

  if (profile.length < 2) return null

  return (
    <View style={styles.wrap}>
      <WebView
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled={false}
        scrollEnabled={false}
        style={styles.webview}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    height: 120,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e2a45',
    backgroundColor: '#060c1a',
  },
  webview: { flex: 1, backgroundColor: 'transparent' },
})
