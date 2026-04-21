export interface TrackSegment {
  coords: [number, number][]
  color:  string
}

export interface GpxResult {
  track:            [number, number][]
  distanceKm:       number
  elevationGain:    number
  maxGrade:         number   // steepest uphill %
  maxDowngrade:     number   // steepest downhill % (negative)
  elevationProfile: { km: number; ele: number }[]
  coloredSegments:  TrackSegment[]
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

export function slopeColor(grade: number): string {
  if (grade < -2) return '#00ffaa'  // bright cyan-green — downhill
  if (grade <  3) return '#39ff14'  // neon green        — flat
  if (grade <  7) return '#ffaa00'  // orange            — moderate uphill
  return '#ff2200'                  // red               — steep uphill
}

export function parseGpx(xml: string): GpxResult {
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

  if (track.length === 0) {
    const lats = [...xml.matchAll(/\blat="([^"]+)"/g)].map(x => parseFloat(x[1]))
    const lons = [...xml.matchAll(/\blon="([^"]+)"/g)].map(x => parseFloat(x[1]))
    const len  = Math.min(lats.length, lons.length)
    for (let i = 0; i < len; i++) {
      if (!isNaN(lats[i]) && !isNaN(lons[i])) track.push([lats[i], lons[i]])
    }
  }

  let totalKm = 0
  const cumKm: number[] = [0]
  for (let i = 1; i < track.length; i++) {
    totalKm += haversineKm(track[i - 1][0], track[i - 1][1], track[i][0], track[i][1])
    cumKm.push(totalKm)
  }

  let elevationGain = 0
  for (let i = 1; i < eleData.length; i++) {
    if (eleData[i] !== -Infinity && eleData[i - 1] !== -Infinity) {
      const diff = eleData[i] - eleData[i - 1]
      if (diff > 0) elevationGain += diff
    }
  }

  const hasEle    = eleData.some(e => e !== -Infinity)
  const maxPoints = 300
  const step      = Math.max(1, Math.floor(track.length / maxPoints))

  const elevationProfile: { km: number; ele: number }[] = []
  const profileCoords:    [number, number][]             = []

  if (hasEle) {
    for (let i = 0; i < track.length; i += step) {
      if (eleData[i] !== -Infinity) {
        elevationProfile.push({ km: cumKm[i], ele: eleData[i] })
        profileCoords.push(track[i])
      }
    }
    const last = track.length - 1
    if (last % step !== 0 && eleData[last] !== -Infinity) {
      elevationProfile.push({ km: cumKm[last], ele: eleData[last] })
      profileCoords.push(track[last])
    }
  }

  // Max uphill and downhill grade
  let maxGrade     = 0
  let maxDowngrade = 0
  for (let i = 1; i < elevationProfile.length; i++) {
    const distKm = elevationProfile[i].km - elevationProfile[i - 1].km
    const eleM   = elevationProfile[i].ele - elevationProfile[i - 1].ele
    if (distKm > 0) {
      const grade = (eleM / (distKm * 1000)) * 100
      if (grade > maxGrade)     maxGrade     = grade
      if (grade < maxDowngrade) maxDowngrade = grade
    }
  }

  // Build colored segments from elevation profile
  const coloredSegments: TrackSegment[] = []

  if (profileCoords.length >= 2) {
    let seg: TrackSegment = { coords: [profileCoords[0]], color: '#39ff14' }

    for (let i = 1; i < profileCoords.length; i++) {
      const distKm = elevationProfile[i].km - elevationProfile[i - 1].km
      const eleM   = elevationProfile[i].ele - elevationProfile[i - 1].ele
      const grade  = distKm > 0 ? (eleM / (distKm * 1000)) * 100 : 0
      const color  = slopeColor(grade)

      if (color === seg.color) {
        seg.coords.push(profileCoords[i])
      } else {
        seg.coords.push(profileCoords[i]) // overlap for seamless join
        coloredSegments.push(seg)
        seg = { coords: [profileCoords[i]], color }
      }
    }
    coloredSegments.push(seg)
  } else if (track.length >= 2) {
    // No elevation — single green segment
    coloredSegments.push({ coords: track, color: '#39ff14' })
  }

  return {
    track,
    distanceKm:    Math.round(totalKm * 10) / 10,
    elevationGain: Math.round(elevationGain),
    maxGrade:      Math.round(maxGrade * 10) / 10,
    maxDowngrade:  Math.round(maxDowngrade * 10) / 10,
    elevationProfile,
    coloredSegments,
  }
}
