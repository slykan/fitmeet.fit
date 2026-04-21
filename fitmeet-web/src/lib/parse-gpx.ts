export interface GpxResult {
  track:            [number, number][]
  distanceKm:       number
  elevationGain:    number
  elevationProfile: { km: number; ele: number }[]
}

function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R   = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a   =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function parseGpx(xml: string): GpxResult {
  // Extract track points with optional elevation via regex
  // Matches: lat="..." lon="..." blocks, then looks for <ele>...</ele> nearby
  const trkptRe = /<(?:[^:>]+:)?(?:trkpt|rtept|wpt)([^>]+)>([\s\S]*?)<\/(?:[^:>]+:)?(?:trkpt|rtept|wpt)>/gi
  const latRe   = /lat="([^"]+)"/
  const lonRe   = /lon="([^"]+)"/
  const eleRe   = /<(?:[^:>]+:)?ele[^>]*>([\d.+-]+)<\/(?:[^:>]+:)?ele>/

  const track:   [number, number][]        = []
  const eleData: number[]                  = []
  let   m: RegExpExecArray | null

  while ((m = trkptRe.exec(xml)) !== null) {
    const attrs   = m[1]
    const content = m[2]
    const lat = parseFloat(latRe.exec(attrs)?.[1] ?? '')
    const lon = parseFloat(lonRe.exec(attrs)?.[1] ?? '')
    if (isNaN(lat) || isNaN(lon)) continue
    track.push([lat, lon])
    const ele = parseFloat(eleRe.exec(content)?.[1] ?? '')
    eleData.push(isNaN(ele) ? -Infinity : ele)
  }

  // Fallback: parse lat/lon pairs if regex above found nothing
  if (track.length === 0) {
    const lats = [...xml.matchAll(/\blat="([^"]+)"/g)].map(x => parseFloat(x[1]))
    const lons = [...xml.matchAll(/\blon="([^"]+)"/g)].map(x => parseFloat(x[1]))
    const len  = Math.min(lats.length, lons.length)
    for (let i = 0; i < len; i++) {
      if (!isNaN(lats[i]) && !isNaN(lons[i])) track.push([lats[i], lons[i]])
    }
  }

  // Calculate cumulative distance
  let totalKm = 0
  const cumKm: number[] = [0]
  for (let i = 1; i < track.length; i++) {
    totalKm += haversineKm(track[i - 1][0], track[i - 1][1], track[i][0], track[i][1])
    cumKm.push(totalKm)
  }

  // Calculate elevation gain
  let elevationGain = 0
  for (let i = 1; i < eleData.length; i++) {
    if (eleData[i] !== -Infinity && eleData[i - 1] !== -Infinity) {
      const diff = eleData[i] - eleData[i - 1]
      if (diff > 0) elevationGain += diff
    }
  }

  // Build elevation profile (sampled to max 300 points for chart)
  const hasEle    = eleData.some(e => e !== -Infinity)
  const maxPoints = 300
  const step      = Math.max(1, Math.floor(track.length / maxPoints))
  const elevationProfile: { km: number; ele: number }[] = []

  if (hasEle) {
    for (let i = 0; i < track.length; i += step) {
      if (eleData[i] !== -Infinity) {
        elevationProfile.push({ km: cumKm[i], ele: eleData[i] })
      }
    }
    // Always include last point
    const last = track.length - 1
    if (last % step !== 0 && eleData[last] !== -Infinity) {
      elevationProfile.push({ km: cumKm[last], ele: eleData[last] })
    }
  }

  return {
    track,
    distanceKm:    Math.round(totalKm * 10) / 10,
    elevationGain: Math.round(elevationGain),
    elevationProfile,
  }
}
