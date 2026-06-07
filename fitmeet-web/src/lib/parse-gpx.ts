export interface TrackSegment {
  coords: [number, number][]
  color:  string
  dashArray?: string
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

export interface ElevationProfileResult {
  elevationProfile: { km: number; ele: number }[]
  coloredSegments: TrackSegment[]
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

function cumulativeDistancesKm(track: [number, number][]): number[] {
  const distances: number[] = [0]
  let totalKm = 0

  for (let i = 1; i < track.length; i++) {
    totalKm += haversineKm(track[i - 1][0], track[i - 1][1], track[i][0], track[i][1])
    distances.push(totalKm)
  }

  return distances
}

export function slopeColor(grade: number): string {
  if (grade < -2) return '#39ff14'  // green  — downhill
  if (grade <  3) return '#3399ff'  // blue   — flat
  if (grade <  7) return '#ffaa00'  // orange — moderate uphill
  return '#ff2200'                  // red    — steep uphill
}

function buildElevationProfile(track: [number, number][], elevs: number[]): ElevationProfileResult {
  const cumKm = cumulativeDistancesKm(track)
  const elevationProfile: { km: number; ele: number }[] = []
  const profileCoords: [number, number][] = []

  for (let i = 0; i < track.length; i++) {
    if (!isNaN(elevs[i])) {
      elevationProfile.push({ km: cumKm[i], ele: elevs[i] })
      profileCoords.push(track[i])
    }
  }

  const coloredSegments: TrackSegment[] = []
  if (profileCoords.length >= 2) {
    let seg: TrackSegment = { coords: [profileCoords[0]], color: '#39ff14' }
    for (let i = 1; i < profileCoords.length; i++) {
      const distKm = elevationProfile[i].km - elevationProfile[i - 1].km
      const eleM = elevationProfile[i].ele - elevationProfile[i - 1].ele
      const grade = distKm > 0 ? (eleM / (distKm * 1000)) * 100 : 0
      const color = slopeColor(grade)

      if (color === seg.color) {
        seg.coords.push(profileCoords[i])
      } else {
        seg.coords.push(profileCoords[i])
        coloredSegments.push(seg)
        seg = { coords: [profileCoords[i]], color }
      }
    }
    coloredSegments.push(seg)
  }

  return { elevationProfile, coloredSegments }
}

function sampleTrack(track: [number, number][], maxPoints = 100): [number, number][] {
  if (track.length <= maxPoints) return track
  const sampled: [number, number][] = []
  const last = track.length - 1

  for (let i = 0; i < maxPoints; i++) {
    sampled.push(track[Math.round((i / (maxPoints - 1)) * last)])
  }

  return sampled
}

export async function fetchElevationProfile(track: [number, number][]): Promise<ElevationProfileResult> {
  const sampled = sampleTrack(track)
  if (sampled.length < 2) return { elevationProfile: [], coloredSegments: [] }

  const latitudes = sampled.map(([lat]) => lat.toFixed(5)).join(',')
  const longitudes = sampled.map(([, lon]) => lon.toFixed(5)).join(',')
  const response = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`)
  if (!response.ok) throw new Error(`Elevation request failed: ${response.status}`)
  const data = await response.json() as { elevation?: number[] }

  return buildElevationProfile(sampled, data.elevation ?? [])
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

export function parseGpx(xml: string): GpxResult {

  const track:   [number, number][]        = []
  const eleData: number[]                  = []

  let points = readPoints(xml, 'trkpt|rtept')
  if (points.length === 0) points = readPoints(xml, 'wpt')

  for (const point of points) {
    track.push(point.coords)
    eleData.push(point.ele ?? -Infinity)
  }

  const cumKm = cumulativeDistancesKm(track)
  const totalKm = cumKm[cumKm.length - 1] ?? 0

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
    const sampledTrack: [number, number][] = []
    const sampledElevs: number[] = []
    for (let i = 0; i < track.length; i += step) {
      sampledTrack.push(track[i])
      sampledElevs.push(eleData[i] === -Infinity ? NaN : eleData[i])
    }
    const last = track.length - 1
    if (last % step !== 0) {
      sampledTrack.push(track[last])
      sampledElevs.push(eleData[last] === -Infinity ? NaN : eleData[last])
    }
    const profile = buildElevationProfile(sampledTrack, sampledElevs)
    elevationProfile.push(...profile.elevationProfile)
    profileCoords.push(...sampledTrack.filter((_, index) => !isNaN(sampledElevs[index])))
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
