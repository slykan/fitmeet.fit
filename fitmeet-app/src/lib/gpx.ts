import AsyncStorage from '@react-native-async-storage/async-storage'
import { yieldToMain } from '@/src/lib/async-chunk'

export interface TrackSegment {
  coords: [number, number][]
  color: string
  dashArray?: string
  /** This segment's own length and average grade — shown in the popup when tapped on the Elevation-colored route. */
  distanceKm?: number
  avgGrade?: number
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

export interface ElevationProfileResult {
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

function cumulativeDistancesM(track: [number, number][]): number[] {
  const distances: number[] = [0]
  let total = 0

  for (let i = 1; i < track.length; i++) {
    total += haversineM(track[i - 1], track[i])
    distances.push(total)
  }

  return distances
}

export function slopeColor(grade: number): string {
  if (grade < -2) return '#39ff14'  // green  — downhill
  if (grade <  3) return '#3399ff'  // blue   — flat
  if (grade <  7) return '#ffaa00'  // orange — moderate uphill
  return '#ff2200'                  // red    — steep
}

function buildElevationProfile(
  track: [number, number][],
  elevs: number[],
  sourceTrack: [number, number][] = track,
  sourceIndexes?: number[],
): ElevationProfileResult {
  const cumM = cumulativeDistancesM(track)
  const elevationProfile: { km: number; ele: number }[] = []
  const profileCoords: [number, number][] = []
  const profileIndexes: number[] = []

  for (let i = 0; i < track.length; i++) {
    if (!isNaN(elevs[i])) {
      elevationProfile.push({ km: cumM[i] / 1000, ele: elevs[i] })
      profileCoords.push(track[i])
      profileIndexes.push(sourceIndexes?.[i] ?? i)
    }
  }

  const coloredSegments: TrackSegment[] = []
  if (profileCoords.length >= 2) {
    let seg: TrackSegment | null = null
    let segDistKm = 0
    let segEleM = 0
    const finishSeg = () => {
      if (!seg) return
      seg.distanceKm = Math.round(segDistKm * 100) / 100
      seg.avgGrade = segDistKm > 0 ? Math.round((segEleM / (segDistKm * 1000)) * 1000) / 10 : 0
      coloredSegments.push(seg)
    }
    for (let i = 1; i < profileCoords.length; i++) {
      const distKm = elevationProfile[i].km - elevationProfile[i - 1].km
      const eleM = elevationProfile[i].ele - elevationProfile[i - 1].ele
      const grade = distKm > 0 ? (eleM / (distKm * 1000)) * 100 : 0
      const color = slopeColor(grade)
      const fromIndex = profileIndexes[i - 1]
      const toIndex = profileIndexes[i]
      const fullCoords = sourceTrack.slice(fromIndex, toIndex + 1)
      const segmentCoords = fullCoords.length > 1 ? fullCoords : [profileCoords[i - 1], profileCoords[i]]
      if (!seg) {
        seg = { coords: segmentCoords, color }
        segDistKm = distKm
        segEleM = eleM
      } else if (color === seg.color) {
        seg.coords.push(...segmentCoords.slice(1))
        segDistKm += distKm
        segEleM += eleM
      } else {
        finishSeg()
        seg = { coords: segmentCoords, color }
        segDistKm = distKm
        segEleM = eleM
      }
    }
    finishSeg()
  }

  return { elevationProfile, coloredSegments }
}

function sampleTrackWithIndexes(track: [number, number][], maxPoints = 100): { points: [number, number][]; indexes: number[] } {
  if (track.length <= maxPoints) {
    return { points: track, indexes: track.map((_, index) => index) }
  }

  const points: [number, number][] = []
  const indexes: number[] = []
  const last = track.length - 1

  for (let i = 0; i < maxPoints; i++) {
    const index = Math.round((i / (maxPoints - 1)) * last)
    points.push(track[index])
    indexes.push(index)
  }

  return { points, indexes }
}

// The open-meteo elevation API is a free, rate-limited service and every
// viewer of a route/event was hitting it fresh on every screen open. Caching
// the result per-track means a given route only needs one successful fetch
// ever (per device), instead of one per view.
// v2: cache shape gained per-segment distanceKm/avgGrade - bump so older
// cached entries (missing those fields) don't get reused as-is.
const ELEVATION_CACHE_PREFIX = 'fitmeet:elevation:v2:'

function elevationCacheKey(track: [number, number][]): string | null {
  if (track.length < 2) return null
  const [firstLat, firstLng] = track[0]
  const [lastLat, lastLng] = track[track.length - 1]
  return `${track.length}:${firstLat.toFixed(5)},${firstLng.toFixed(5)}:${lastLat.toFixed(5)},${lastLng.toFixed(5)}`
}

async function requestElevations(latitudes: string, longitudes: string): Promise<number[]> {
  const response = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`)
  if (!response.ok) throw new Error(`Elevation request failed: ${response.status}`)
  const data = await response.json() as { elevation?: number[] }
  return data.elevation ?? []
}

export async function fetchElevationProfile(track: [number, number][]): Promise<ElevationProfileResult> {
  const cacheKey = elevationCacheKey(track)
  if (cacheKey) {
    try {
      const cached = await AsyncStorage.getItem(ELEVATION_CACHE_PREFIX + cacheKey)
      if (cached) return JSON.parse(cached) as ElevationProfileResult
    } catch {}
  }

  const sampledInfo = sampleTrackWithIndexes(track)
  const sampled = sampledInfo.points
  if (sampled.length < 2) return { elevationProfile: [], coloredSegments: [] }

  const latitudes = sampled.map(([lat]) => lat.toFixed(5)).join(',')
  const longitudes = sampled.map(([, lon]) => lon.toFixed(5)).join(',')

  let elevs: number[]
  try {
    elevs = await requestElevations(latitudes, longitudes)
  } catch {
    // Transient network hiccup / timeout — retry once before giving up.
    elevs = await requestElevations(latitudes, longitudes)
  }

  const result = buildElevationProfile(sampled, elevs, track, sampledInfo.indexes)
  if (cacheKey) {
    try {
      await AsyncStorage.setItem(ELEVATION_CACHE_PREFIX + cacheKey, JSON.stringify(result))
    } catch {}
  }
  return result
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

// Chunked-async twin of parseGpxText — used only on event/route view screens
// where large imported GPX files were freezing the JS thread for a few
// seconds. Same logic, but yields back to the event loop periodically so the
// UI (and a loading spinner) stays responsive. parseGpxText itself stays
// synchronous for create/edit/draw flows, which weren't reported as frozen.
export async function parseGpxTextAsync(xml: string): Promise<GpxParsed> {
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

  for (let i = 1; i < track.length; i++) {
    const d = haversineM(track[i - 1], track[i])
    distM += d
    segDistM += d

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

    if (i % 500 === 0) await yieldToMain()
  }

  // Build elevation profile (max 300 points)
  const hasEle = elevs.filter(ele => !isNaN(ele)).length >= 2
  const elevationProfile: { km: number; ele: number }[] = []
  const coloredSegments: TrackSegment[] = []

  if (hasEle && track.length >= 2) {
    const step = Math.max(1, Math.floor(track.length / 300))
    const sampledTrack: [number, number][] = []
    const sampledElevs: number[] = []
    const sampledIndexes: number[] = []
    for (let i = 0; i < track.length; i += step) {
      sampledTrack.push(track[i])
      sampledElevs.push(elevs[i])
      sampledIndexes.push(i)
      if (i % 500 === 0) await yieldToMain()
    }
    const last = track.length - 1
    if (last % step !== 0) {
      sampledTrack.push(track[last])
      sampledElevs.push(elevs[last])
      sampledIndexes.push(last)
    }
    const profile = buildElevationProfile(sampledTrack, sampledElevs, track, sampledIndexes)
    elevationProfile.push(...profile.elevationProfile)
    coloredSegments.push(...profile.coloredSegments)
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
  const cumM = cumulativeDistancesM(track)

  for (let i = 1; i < track.length; i++) {
    const d = haversineM(track[i - 1], track[i])
    distM += d
    segDistM += d

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
    const sampledTrack: [number, number][] = []
    const sampledElevs: number[] = []
    const sampledIndexes: number[] = []
    for (let i = 0; i < track.length; i += step) {
      sampledTrack.push(track[i])
      sampledElevs.push(elevs[i])
      sampledIndexes.push(i)
    }
    const last = track.length - 1
    if (last % step !== 0) {
      sampledTrack.push(track[last])
      sampledElevs.push(elevs[last])
      sampledIndexes.push(last)
    }
    const profile = buildElevationProfile(sampledTrack, sampledElevs, track, sampledIndexes)
    elevationProfile.push(...profile.elevationProfile)
    coloredSegments.push(...profile.coloredSegments)
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

export async function enrichGpxWithElevation(xml: string): Promise<string> {
  if (/<ele[^>]*>[\d.+-]+<\/ele>/i.test(xml)) return xml

  const trkptRx = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*\/?>(?:[\s\S]*?<\/trkpt>)?/gi
  const points: { lat: number; lon: number; match: string }[] = []
  let m: RegExpExecArray | null
  while ((m = trkptRx.exec(xml)) !== null) {
    points.push({ lat: parseFloat(m[1]), lon: parseFloat(m[2]), match: m[0] })
  }
  if (points.length < 2) return xml

  const MAX = 100
  const step = Math.max(1, Math.floor(points.length / MAX))
  const si: number[] = []
  for (let i = 0; i < points.length; i += step) si.push(i)
  if (si[si.length - 1] !== points.length - 1) si.push(points.length - 1)

  const lats = si.map(i => points[i].lat.toFixed(5)).join(',')
  const lngs = si.map(i => points[i].lon.toFixed(5)).join(',')

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`)
    if (!res.ok) return xml
    const data = await res.json() as { elevation?: number[] }
    const se = data.elevation ?? []
    if (se.length === 0) return xml

    const elevs = new Array<number>(points.length)
    let j = 0
    for (let i = 0; i < points.length; i++) {
      if (j + 1 < si.length && i >= si[j + 1]) j++
      if (i === si[j]) elevs[i] = se[j]
      else if (j + 1 < si.length) {
        const t = (i - si[j]) / (si[j + 1] - si[j])
        elevs[i] = se[j] + t * (se[j + 1] - se[j])
      } else elevs[i] = se[j]
    }

    let result = xml
    for (let i = points.length - 1; i >= 0; i--) {
      const pt = points[i]
      const eleTrkpt = `<trkpt lat="${pt.lat}" lon="${pt.lon}">\n      <ele>${elevs[i].toFixed(1)}</ele>\n    </trkpt>`
      result = result.replace(pt.match, eleTrkpt)
    }
    return result
  } catch { return xml }
}
