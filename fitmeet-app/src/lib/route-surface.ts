import type { TrackSegment } from '@/src/lib/gpx'

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

function sampleTrack(track: Point[], maxPoints = 180) {
  if (track.length <= maxPoints) return track
  const last = track.length - 1
  return Array.from({ length: maxPoints }, (_, index) => track[Math.round((index / (maxPoints - 1)) * last)])
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

function nearestSurfaceKind(point: Point, ways: OverpassWay[]): SurfaceKind {
  let bestDistance = Infinity
  let bestKind: SurfaceKind = 'unknown'

  for (const way of ways) {
    const coords = (way.geometry ?? []).map((entry): Point => [entry.lat, entry.lon])
    for (let i = 1; i < coords.length; i++) {
      const dist = distancePointToSegmentM(point, coords[i - 1], coords[i])
      if (dist < bestDistance) {
        bestDistance = dist
        bestKind = classifyWay(way.tags)
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

function buildSurfaceSegments(track: Point[], kinds: SurfaceKind[]): SurfaceSegment[] {
  if (track.length < 2) return []
  const segments: SurfaceSegment[] = []
  let currentKind = kinds[0] ?? 'unknown'
  let current: Point[] = [track[0]]

  for (let i = 1; i < track.length; i++) {
    const kind = kinds[i] ?? currentKind
    current.push(track[i])
    if (kind !== currentKind) {
      const meta = SURFACE_META[currentKind]
      segments.push({ coords: current, color: meta.color, dashArray: meta.dashArray, surfaceKind: currentKind, label: meta.label })
      currentKind = kind
      current = [track[i]]
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

export async function analyzeRouteSurface(track: Point[]): Promise<SurfaceAnalysis | null> {
  const sampled = sampleTrack(track)
  if (sampled.length < 2) return null

  const { south, west, north, east } = bboxFor(sampled)
  const query = `[out:json][timeout:10];way["highway"](${south},${west},${north},${east});out tags geom;`
  const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
  if (!response.ok) throw new Error(`Overpass request failed: ${response.status}`)
  const data = await response.json() as { elements?: OverpassWay[] }
  const ways = data.elements?.filter(way => way.geometry && way.geometry.length >= 2) ?? []
  if (ways.length === 0) return null

  const kinds = sampled.map(point => nearestSurfaceKind(point, ways))
  const segments = buildSurfaceSegments(sampled, kinds)
  const summary = buildSummary(segments)
  if (summary.length === 0) return null
  return { segments, summary }
}
