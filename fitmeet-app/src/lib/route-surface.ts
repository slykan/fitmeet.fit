import type { TrackSegment } from '@/src/lib/gpx'
import { yieldToMain } from '@/src/lib/async-chunk'

export type SurfaceKind = 'paved' | 'unpaved' | 'trail' | 'unknown'

export interface SurfaceSegment extends TrackSegment {
  surfaceKind: SurfaceKind
  label: string
  dashArray?: string
}

export interface SurfaceSummaryItem {
  kind: SurfaceKind
  label: string
  distanceKm: number
  percent: number
  color: string
}

export interface SurfaceAnalysis {
  segments: SurfaceSegment[]
  summary: SurfaceSummaryItem[]
}

type Point = [number, number]

interface OverpassWay {
  tags?: Record<string, string>
  geometry?: Array<{ lat: number; lon: number }>
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
]

const SURFACE_META: Record<SurfaceKind, { label: string; color: string; dashArray?: string }> = {
  paved: { label: 'Paved road', color: '#6cff2f' },
  unpaved: { label: 'Gravel / unpaved', color: '#f6c65b', dashArray: '8 8' },
  trail: { label: 'Trail / path', color: '#58beff', dashArray: '3 7' },
  unknown: { label: 'Unknown surface', color: '#b3bdd7', dashArray: '2 8' },
}

const PAVED_SURFACES = new Set(['paved', 'asphalt', 'concrete', 'concrete:lanes', 'concrete:plates', 'paving_stones', 'sett'])
const UNPAVED_SURFACES = new Set(['unpaved', 'gravel', 'fine_gravel', 'compacted', 'dirt', 'earth', 'ground', 'grass', 'grass_paver', 'mud', 'sand', 'woodchips', 'pebblestone'])
const TRAIL_HIGHWAYS = new Set(['path', 'footway', 'bridleway', 'steps', 'track'])
const PAVED_HIGHWAYS = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'service', 'living_street', 'road', 'cycleway'])

function haversineKm(a: Point, b: Point) {
  const radiusKm = 6371
  const dLat = (b[0] - a[0]) * Math.PI / 180
  const dLon = (b[1] - a[1]) * Math.PI / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return radiusKm * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function sampleTrackWithIndexes(track: Point[], maxPoints = 180): { points: Point[]; indexes: number[] } {
  if (track.length <= maxPoints) {
    return { points: track, indexes: track.map((_, index) => index) }
  }

  const last = track.length - 1
  const points: Point[] = []
  const indexes: number[] = []

  for (let index = 0; index < maxPoints; index++) {
    const trackIndex = Math.round((index / (maxPoints - 1)) * last)
    points.push(track[trackIndex])
    indexes.push(trackIndex)
  }

  return { points, indexes }
}

function classifyWay(tags: Record<string, string> | undefined): SurfaceKind {
  const surface = tags?.surface?.toLowerCase()
  const highway = tags?.highway?.toLowerCase()
  const tracktype = tags?.tracktype?.toLowerCase()

  if (surface && PAVED_SURFACES.has(surface)) return 'paved'
  if (surface && UNPAVED_SURFACES.has(surface)) return 'unpaved'
  if (tracktype && ['grade2', 'grade3', 'grade4', 'grade5'].includes(tracktype)) return 'unpaved'
  if (highway && TRAIL_HIGHWAYS.has(highway)) return highway === 'track' ? 'unpaved' : 'trail'
  if (highway && PAVED_HIGHWAYS.has(highway)) return 'paved'
  return 'unknown'
}

function equirectangularMeters(point: Point, originLat: number): [number, number] {
  const metersPerDegLat = 111_320
  const metersPerDegLon = Math.cos(originLat * Math.PI / 180) * 111_320
  return [point[1] * metersPerDegLon, point[0] * metersPerDegLat]
}

function distancePointToSegmentM(point: Point, a: Point, b: Point) {
  const originLat = point[0]
  const p = equirectangularMeters(point, originLat)
  const p1 = equirectangularMeters(a, originLat)
  const p2 = equirectangularMeters(b, originLat)
  const dx = p2[0] - p1[0]
  const dy = p2[1] - p1[1]
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(p[0] - p1[0], p[1] - p1[1])
  const t = Math.max(0, Math.min(1, ((p[0] - p1[0]) * dx + (p[1] - p1[1]) * dy) / lenSq))
  return Math.hypot(p[0] - (p1[0] + t * dx), p[1] - (p1[1] + t * dy))
}

// Spatial grid so nearestSurfaceKind only checks segments near each point
// instead of every segment of every OSM way in the bbox (was O(points × ways
// × segments) — dense urban bboxes can return thousands of ways and freeze
// the JS thread for seconds).
const GRID_CELL_DEG = 0.002 // ~220m, comfortably larger than the 35m match radius

interface SurfaceGridCandidate {
  a: Point
  b: Point
  kind: SurfaceKind
}

type SurfaceGrid = Map<string, SurfaceGridCandidate[]>

function cellKey(cellLat: number, cellLon: number): string {
  return `${cellLat}_${cellLon}`
}

function cellsForSegment(a: Point, b: Point): string[] {
  const latMin = Math.floor(Math.min(a[0], b[0]) / GRID_CELL_DEG)
  const latMax = Math.floor(Math.max(a[0], b[0]) / GRID_CELL_DEG)
  const lonMin = Math.floor(Math.min(a[1], b[1]) / GRID_CELL_DEG)
  const lonMax = Math.floor(Math.max(a[1], b[1]) / GRID_CELL_DEG)
  const keys: string[] = []
  for (let la = latMin; la <= latMax; la++) {
    for (let lo = lonMin; lo <= lonMax; lo++) {
      keys.push(cellKey(la, lo))
    }
  }
  return keys
}

function buildSurfaceGrid(ways: OverpassWay[]): SurfaceGrid {
  const grid: SurfaceGrid = new Map()

  for (const way of ways) {
    const kind = classifyWay(way.tags)
    const coords = (way.geometry ?? []).map((entry): Point => [entry.lat, entry.lon])
    for (let i = 1; i < coords.length; i++) {
      const candidate: SurfaceGridCandidate = { a: coords[i - 1], b: coords[i], kind }
      for (const key of cellsForSegment(candidate.a, candidate.b)) {
        const bucket = grid.get(key)
        if (bucket) bucket.push(candidate)
        else grid.set(key, [candidate])
      }
    }
  }

  return grid
}

function nearestSurfaceKind(point: Point, grid: SurfaceGrid): SurfaceKind {
  const cellLat = Math.floor(point[0] / GRID_CELL_DEG)
  const cellLon = Math.floor(point[1] / GRID_CELL_DEG)
  let bestDistance = Infinity
  let bestKind: SurfaceKind = 'unknown'
  const seen = new Set<SurfaceGridCandidate>()

  for (let la = cellLat - 1; la <= cellLat + 1; la++) {
    for (let lo = cellLon - 1; lo <= cellLon + 1; lo++) {
      const bucket = grid.get(cellKey(la, lo))
      if (!bucket) continue
      for (const candidate of bucket) {
        if (seen.has(candidate)) continue
        seen.add(candidate)
        const dist = distancePointToSegmentM(point, candidate.a, candidate.b)
        if (dist < bestDistance) {
          bestDistance = dist
          bestKind = candidate.kind
        }
      }
    }
  }

  return bestDistance <= 35 ? bestKind : 'unknown'
}

function bboxFor(track: Point[]) {
  const lats = track.map(point => point[0])
  const lngs = track.map(point => point[1])
  return {
    south: Math.min(...lats) - 0.01,
    west: Math.min(...lngs) - 0.01,
    north: Math.max(...lats) + 0.01,
    east: Math.max(...lngs) + 0.01,
  }
}

function buildSurfaceSegments(track: Point[], kinds: SurfaceKind[], sampleIndexes?: number[]): SurfaceSegment[] {
  if (track.length < 2 || kinds.length < 2) return []
  const segments: SurfaceSegment[] = []
  let currentKind = kinds[0] ?? 'unknown'
  const indexes = sampleIndexes ?? track.map((_, index) => index)
  let current: Point[] = [track[indexes[0]] ?? track[0]]

  for (let i = 1; i < kinds.length; i++) {
    const kind = kinds[i] ?? currentKind
    const fromIndex = indexes[i - 1]
    const toIndex = indexes[i]
    const coords = track.slice(fromIndex, toIndex + 1)
    current.push(...(coords.length > 1 ? coords.slice(1) : [track[toIndex]]))
    if (kind !== currentKind) {
      const meta = SURFACE_META[currentKind]
      segments.push({ coords: current, color: meta.color, dashArray: meta.dashArray, surfaceKind: currentKind, label: meta.label })
      currentKind = kind
      current = [track[toIndex]]
    }
  }

  const meta = SURFACE_META[currentKind]
  segments.push({ coords: current, color: meta.color, dashArray: meta.dashArray, surfaceKind: currentKind, label: meta.label })
  return segments
}

function buildSummary(segments: SurfaceSegment[]): SurfaceSummaryItem[] {
  const distances = new Map<SurfaceKind, number>()
  let total = 0
  for (const segment of segments) {
    let segmentKm = 0
    for (let i = 1; i < segment.coords.length; i++) {
      segmentKm += haversineKm(segment.coords[i - 1], segment.coords[i])
    }
    distances.set(segment.surfaceKind, (distances.get(segment.surfaceKind) ?? 0) + segmentKm)
    total += segmentKm
  }

  return (Object.keys(SURFACE_META) as SurfaceKind[])
    .map(kind => {
      const distanceKm = distances.get(kind) ?? 0
      const meta = SURFACE_META[kind]
      return {
        kind,
        label: meta.label,
        distanceKm: Math.round(distanceKm * 10) / 10,
        percent: total > 0 ? Math.round((distanceKm / total) * 100) : 0,
        color: meta.color,
      }
    })
    .filter(item => item.distanceKm > 0)
}

async function fetchOverpass(query: string): Promise<{ elements?: OverpassWay[] }> {
  let lastError: unknown = null

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const getResponse = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'FitMeet/1.0 route-surface',
        },
      })
      if (getResponse.ok) return await getResponse.json()
      lastError = new Error(`Overpass GET failed: ${getResponse.status}`)
    } catch (error) {
      lastError = error
    }

    try {
      const postResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'FitMeet/1.0 route-surface',
        },
        body: `data=${encodeURIComponent(query)}`,
      })
      if (postResponse.ok) return await postResponse.json()
      lastError = new Error(`Overpass POST failed: ${postResponse.status}`)
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Overpass request failed')
}

export async function analyzeRouteSurface(track: Point[]): Promise<SurfaceAnalysis | null> {
  const sampledInfo = sampleTrackWithIndexes(track)
  const sampled = sampledInfo.points
  if (sampled.length < 2) return null

  const { south, west, north, east } = bboxFor(sampled)
  const query = `[out:json][timeout:10];way["highway"](${south},${west},${north},${east});out tags geom;`
  const data = await fetchOverpass(query)
  const ways = data.elements?.filter(way => way.geometry && way.geometry.length >= 2) ?? []
  if (ways.length === 0) return null

  const grid = buildSurfaceGrid(ways)
  const kinds: SurfaceKind[] = []
  for (let i = 0; i < sampled.length; i++) {
    kinds.push(nearestSurfaceKind(sampled[i], grid))
    if (i > 0 && i % 20 === 0) await yieldToMain()
  }
  const segments = buildSurfaceSegments(track, kinds, sampledInfo.indexes)
  const summary = buildSummary(segments)
  if (summary.length === 0) return null
  return { segments, summary }
}
