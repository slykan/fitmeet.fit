export interface TrackSegment {
  coords: [number, number][]
  color: string
}

export interface GpxParsed {
  track: [number, number][]
  distanceKm: number
  elevGain: number
  maxGrade: number      // steepest uphill %, positive
  maxDowngrade: number  // steepest downhill %, negative
  elevationProfile: { km: number; ele: number }[]
  coloredSegments: TrackSegment[]
}

function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const dLat = (b[0] - a[0]) * Math.PI / 180
  const dLon = (b[1] - a[1]) * Math.PI / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export function slopeColor(grade: number): string {
  if (grade < -2) return '#39ff14'  // green  — downhill
  if (grade <  3) return '#3399ff'  // blue   — flat
  if (grade <  7) return '#ffaa00'  // orange — moderate uphill
  return '#ff2200'                  // red    — steep
}

function readPoints(xml: string, tagNames: string): { coords: [number, number]; ele: number | null }[] {
  const tagRe = new RegExp(
    `<(?:(?:[^:>\\s]+):)?(?:${tagNames})\\b([^>]*)>([\\s\\S]*?)<\\/(?:(?:[^:>\\s]+):)?(?:${tagNames})>|<(?:(?:[^:>\\s]+):)?(?:${tagNames})\\b([^>]*)\\/>`,
    'gi',
  )
  const latRe = /\blat=["']([^"']+)["']/i
  const lonRe = /\blon=["']([^"']+)["']/i
  const eleRe = /<(?:[^:>\s]+:)?ele[^>]*>([\d.+-]+)<\/(?:[^:>\s]+:)?ele>/i
  const points: { coords: [number, number]; ele: number | null }[] = []
  let match: RegExpExecArray | null

  while ((match = tagRe.exec(xml)) !== null) {
    const attrs = match[1] ?? match[3] ?? ''
    const lat = parseFloat(latRe.exec(attrs)?.[1] ?? '')
    const lon = parseFloat(lonRe.exec(attrs)?.[1] ?? '')
    if (isNaN(lat) || isNaN(lon)) continue
    const ele = parseFloat(eleRe.exec(match[2] ?? '')?.[1] ?? '')
    points.push({ coords: [lat, lon], ele: isNaN(ele) ? null : ele })
  }

  return points
}

export function parseGpxText(xml: string): GpxParsed {
  let points = readPoints(xml, 'trkpt|rtept')
  if (points.length === 0) points = readPoints(xml, 'wpt')

  const track: [number, number][] = points.map(point => point.coords)
  const pointElevs = points.map(point => point.ele)
  const allElevs = [...xml.matchAll(/<(?:[^:>\s]+:)?ele[^>]*>([\d.+-]+)<\/(?:[^:>\s]+:)?ele>/gi)].map(m => parseFloat(m[1]))
  const elevs = pointElevs.some(ele => ele != null)
    ? pointElevs.map(ele => ele ?? NaN)
    : allElevs

  let distM = 0
  let elevGain = 0
  let segDistM = 0
  let segStartElev = elevs[0] ?? 0
  let maxGrade = 0
  let maxDowngrade = 0
  const cumM: number[] = [0]

  for (let i = 1; i < track.length; i++) {
    const d = haversineM(track[i - 1], track[i])
    distM += d
    segDistM += d
    cumM.push(distM)

    if (i < elevs.length && !isNaN(elevs[i]) && !isNaN(elevs[i - 1]) && elevs[i] > elevs[i - 1]) {
      elevGain += elevs[i] - elevs[i - 1]
    }

    if (segDistM >= 50 && i < elevs.length && !isNaN(elevs[i]) && !isNaN(segStartElev)) {
      const elevChange = elevs[i] - segStartElev
      const grade = (elevChange / segDistM) * 100
      if (grade > maxGrade) maxGrade = grade
      if (grade < maxDowngrade) maxDowngrade = grade
      segDistM = 0
      segStartElev = elevs[i]
    }
  }

  // Build elevation profile (max 300 points)
  const hasEle = elevs.filter(ele => !isNaN(ele)).length >= 2
  const elevationProfile: { km: number; ele: number }[] = []
  const coloredSegments: TrackSegment[] = []

  if (hasEle && track.length >= 2) {
    const step = Math.max(1, Math.floor(track.length / 300))
    const profileCoords: [number, number][] = []

    for (let i = 0; i < track.length; i += step) {
      if (i < elevs.length && !isNaN(elevs[i])) {
        elevationProfile.push({ km: cumM[i] / 1000, ele: elevs[i] })
        profileCoords.push(track[i])
      }
    }
    const last = track.length - 1
    if (last % step !== 0 && last < elevs.length && !isNaN(elevs[last])) {
      elevationProfile.push({ km: cumM[last] / 1000, ele: elevs[last] })
      profileCoords.push(track[last])
    }

    // Build colored segments from profile
    if (profileCoords.length >= 2) {
      let seg: TrackSegment = { coords: [profileCoords[0]], color: '#3399ff' }
      for (let i = 1; i < profileCoords.length; i++) {
        const distKm = elevationProfile[i].km - elevationProfile[i - 1].km
        const eleM   = elevationProfile[i].ele - elevationProfile[i - 1].ele
        const grade  = distKm > 0 ? (eleM / (distKm * 1000)) * 100 : 0
        const color  = slopeColor(grade)
        seg.coords.push(profileCoords[i])
        if (color !== seg.color) {
          coloredSegments.push(seg)
          seg = { coords: [profileCoords[i]], color }
        }
      }
      coloredSegments.push(seg)
    }
  } else if (track.length >= 2) {
    coloredSegments.push({ coords: track, color: '#39ff14' })
  }

  return {
    track,
    distanceKm: Math.round(distM / 100) / 10,
    elevGain: Math.round(elevGain),
    maxGrade: Math.round(maxGrade * 10) / 10,
    maxDowngrade: Math.round(maxDowngrade * 10) / 10,
    elevationProfile,
    coloredSegments,
  }
}
