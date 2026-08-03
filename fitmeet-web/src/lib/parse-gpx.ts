import { yieldToMain } from '@/lib/async-chunk'

export interface TrackSegment {
  coords: [number, number][]
  color:  string
  dashArray?: string
  /** This segment's own length and average grade — shown in the popup when tapped on the Elevation-colored route. */
  distanceKm?: number
  avgGrade?: number
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

function buildElevationProfile(
  track: [number, number][],
  elevs: number[],
  sourceTrack: [number, number][] = track,
  sourceIndexes?: number[],
): ElevationProfileResult {
  const cumKm = cumulativeDistancesKm(track)
  const elevationProfile: { km: number; ele: number }[] = []
  const profileCoords: [number, number][] = []
  const profileIndexes: number[] = []

  for (let i = 0; i < track.length; i++) {
    if (!isNaN(elevs[i])) {
      elevationProfile.push({ km: cumKm[i], ele: elevs[i] })
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

async function requestElevations(latitudes: string, longitudes: string): Promise<number[]> {
  const response = await fetch(
    `https://api.open-meteo.com/v1/elevation?latitude=${latitudes}&longitude=${longitudes}`,
    { signal: AbortSignal.timeout(8000) },
  )
  if (!response.ok) throw new Error(`Elevation request failed: ${response.status}`)
  const data = await response.json() as { elevation?: number[] }
  return data.elevation ?? []
}

// The open-meteo elevation API is a free, rate-limited service and every
// viewer of a route/event was hitting it fresh on every page load. Caching
// the result per-track in localStorage means a given route only needs one
// successful fetch ever (per browser), instead of one per view.
const ELEVATION_CACHE_PREFIX = 'fitmeet:elevation:'

function elevationCacheKey(track: [number, number][]): string | null {
  if (track.length < 2) return null
  const [firstLat, firstLng] = track[0]
  const [lastLat, lastLng] = track[track.length - 1]
  return `${track.length}:${firstLat.toFixed(5)},${firstLng.toFixed(5)}:${lastLat.toFixed(5)},${lastLng.toFixed(5)}`
}

function readElevationCache(key: string): ElevationProfileResult | null {
  try {
    const raw = window.localStorage.getItem(ELEVATION_CACHE_PREFIX + key)
    return raw ? JSON.parse(raw) as ElevationProfileResult : null
  } catch {
    return null
  }
}

function writeElevationCache(key: string, result: ElevationProfileResult) {
  try {
    window.localStorage.setItem(ELEVATION_CACHE_PREFIX + key, JSON.stringify(result))
  } catch {
    // Storage full or unavailable (private browsing) — caching is a nice-to-have, skip silently.
  }
}

export async function fetchElevationProfile(track: [number, number][]): Promise<ElevationProfileResult> {
  const cacheKey = typeof window !== 'undefined' ? elevationCacheKey(track) : null
  if (cacheKey) {
    const cached = readElevationCache(cacheKey)
    if (cached) return cached
  }

  const sampledInfo = sampleTrackWithIndexes(track)
  const sampled = sampledInfo.points
  if (sampled.length < 2) return { elevationProfile: [], coloredSegments: [] }

  const latitudes = sampled.map(([lat]) => lat.toFixed(5)).join(',')
  const longitudes = sampled.map(([, lon]) => lon.toFixed(5)).join(',')

  let elevations: number[]
  try {
    elevations = await requestElevations(latitudes, longitudes)
  } catch {
    // Transient network hiccup / timeout — retry once before giving up.
    elevations = await requestElevations(latitudes, longitudes)
  }

  const result = buildElevationProfile(sampled, elevations, track, sampledInfo.indexes)
  if (cacheKey) writeElevationCache(cacheKey, result)
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

async function cumulativeDistancesKmAsync(track: [number, number][]): Promise<number[]> {
  const distances: number[] = [0]
  let totalKm = 0

  for (let i = 1; i < track.length; i++) {
    totalKm += haversineKm(track[i - 1][0], track[i - 1][1], track[i][0], track[i][1])
    distances.push(totalKm)
    if (i % 500 === 0) await yieldToMain()
  }

  return distances
}

// Chunked-async twin of parseGpx — used only on event/route view screens
// where large imported GPX files were freezing the main thread for a few
// seconds. Same logic, but yields back to the event loop periodically so the
// UI (and a loading spinner) stays responsive. parseGpx itself stays
// synchronous for create/edit/draw flows, which weren't reported as frozen.
export async function parseGpxAsync(xml: string): Promise<GpxResult> {
  const track:   [number, number][] = []
  const eleData: number[]           = []

  let points = readPoints(xml, 'trkpt|rtept')
  if (points.length === 0) points = readPoints(xml, 'wpt')

  for (const point of points) {
    track.push(point.coords)
    eleData.push(point.ele ?? -Infinity)
  }

  const cumKm = await cumulativeDistancesKmAsync(track)
  const totalKm = cumKm[cumKm.length - 1] ?? 0

  let elevationGain = 0
  for (let i = 1; i < eleData.length; i++) {
    if (eleData[i] !== -Infinity && eleData[i - 1] !== -Infinity) {
      const diff = eleData[i] - eleData[i - 1]
      if (diff > 0) elevationGain += diff
    }
    if (i % 500 === 0) await yieldToMain()
  }

  const hasEle    = eleData.some(e => e !== -Infinity)
  const maxPoints = 300
  const step      = Math.max(1, Math.floor(track.length / maxPoints))

  const elevationProfile: { km: number; ele: number }[] = []
  const coloredSegments: TrackSegment[] = []

  if (hasEle) {
    const sampledTrack: [number, number][] = []
    const sampledElevs: number[] = []
    const sampledIndexes: number[] = []
    for (let i = 0; i < track.length; i += step) {
      sampledTrack.push(track[i])
      sampledElevs.push(eleData[i] === -Infinity ? NaN : eleData[i])
      sampledIndexes.push(i)
      if (i % 500 === 0) await yieldToMain()
    }
    const last = track.length - 1
    if (last % step !== 0) {
      sampledTrack.push(track[last])
      sampledElevs.push(eleData[last] === -Infinity ? NaN : eleData[last])
      sampledIndexes.push(last)
    }
    const profile = buildElevationProfile(sampledTrack, sampledElevs, track, sampledIndexes)
    elevationProfile.push(...profile.elevationProfile)
    coloredSegments.push(...profile.coloredSegments)
  }

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

  if (coloredSegments.length === 0 && track.length >= 2) {
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
  const coloredSegments: TrackSegment[] = []

  if (hasEle) {
    const sampledTrack: [number, number][] = []
    const sampledElevs: number[] = []
    const sampledIndexes: number[] = []
    for (let i = 0; i < track.length; i += step) {
      sampledTrack.push(track[i])
      sampledElevs.push(eleData[i] === -Infinity ? NaN : eleData[i])
      sampledIndexes.push(i)
    }
    const last = track.length - 1
    if (last % step !== 0) {
      sampledTrack.push(track[last])
      sampledElevs.push(eleData[last] === -Infinity ? NaN : eleData[last])
      sampledIndexes.push(last)
    }
    const profile = buildElevationProfile(sampledTrack, sampledElevs, track, sampledIndexes)
    elevationProfile.push(...profile.elevationProfile)
    coloredSegments.push(...profile.coloredSegments)
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

  if (coloredSegments.length === 0 && track.length >= 2) {
    // No elevation - single green segment
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
