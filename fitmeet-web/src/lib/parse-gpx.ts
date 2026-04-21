export function parseGpx(xml: string): [number, number][] {
  const points: [number, number][] = []
  // Regex approach — works regardless of XML namespace or parser quirks
  const re = /(?:lat|lon)="([^"]+)"\s+(?:lat|lon)="([^"]+)"/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    // Determine which is lat and which is lon from context
    const before = xml.slice(Math.max(0, m.index - 5), m.index + m[0].length)
    const latMatch = /lat="([^"]+)"/.exec(before)
    const lonMatch = /lon="([^"]+)"/.exec(before)
    if (latMatch && lonMatch) {
      const lat = parseFloat(latMatch[1])
      const lon = parseFloat(lonMatch[1])
      if (!isNaN(lat) && !isNaN(lon)) points.push([lat, lon])
    }
  }
  if (points.length > 0) return points

  // Fallback: find all lat= and lon= attributes in order
  const lats = [...xml.matchAll(/\blat="([^"]+)"/g)].map(x => parseFloat(x[1]))
  const lons = [...xml.matchAll(/\blon="([^"]+)"/g)].map(x => parseFloat(x[1]))
  const len  = Math.min(lats.length, lons.length)
  for (let i = 0; i < len; i++) {
    if (!isNaN(lats[i]) && !isNaN(lons[i])) points.push([lats[i], lons[i]])
  }
  return points
}
