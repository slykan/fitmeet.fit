'use client'

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { slopeColor } from '@/lib/parse-gpx'

export type LatLng = [number, number]

export interface DrawResult {
  waypoints: LatLng[]
  track: LatLng[]
  distanceKm: number
  elevGain: number
  startLat: number | null
  startLng: number | null
  endLat: number | null
  endLng: number | null
}

interface WaypointEntry {
  latlng: LatLng
  marker: L.Marker
}

interface SegmentEntry {
  polyline: L.Polyline
  coords: LatLng[]
  distanceM: number
}

interface ColoredSegment {
  coords: LatLng[]
  color: string
}

interface ElevationPoint {
  km: number
  ele: number
}

interface Props {
  category: string
  height?: number
  initialWaypoints?: LatLng[]
  initialTrack?: LatLng[]
  undoRequestId?: number
  onUpdate: (result: DrawResult) => void
}

function createMapBaseLayers() {
  return {
    Standard: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }),
    Satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
    }),
    Terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
    }),
  }
}

// ─── Track helpers ────────────────────────────────────────────────────────────

function findClosestIdx(track: LatLng[], point: LatLng, from = 0): number {
  let minDist = Infinity
  let minIdx = from
  for (let i = from; i < track.length; i++) {
    const d = Math.hypot(track[i][0] - point[0], track[i][1] - point[1])
    if (d < minDist) { minDist = d; minIdx = i }
  }
  return minIdx
}

function segmentLength(coords: LatLng[]): number {
  const R = 6371000
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    const dLat = (coords[i][0] - coords[i - 1][0]) * Math.PI / 180
    const dLon = (coords[i][1] - coords[i - 1][1]) * Math.PI / 180
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(coords[i - 1][0] * Math.PI / 180) * Math.cos(coords[i][0] * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }
  return total
}

// ─── Valhalla routing ─────────────────────────────────────────────────────────

interface ValhallaCosting {
  costing: string
  options?: Record<string, unknown>
}

const VALHALLA_ENDPOINTS = [
  'https://valhalla.openstreetmap.de/route',
  'https://valhalla1.openstreetmap.de/route',
]

function valhallaCosting(category: string): ValhallaCosting | null {
  if (category === 'cycling') return { costing: 'bicycle', options: { use_roads: 1.0 } }
  if (category === 'running')  return { costing: 'pedestrian', options: {} }
  if (category === 'hiking')   return { costing: 'pedestrian', options: { max_hiking_difficulty: 1 } }
  return null
}

function decodePolyline6(encoded: string): LatLng[] {
  const coords: LatLng[] = []
  let index = 0, lat = 0, lng = 0
  while (index < encoded.length) {
    let b: number, shift = 0, result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1
    shift = result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1
    coords.push([lat / 1e6, lng / 1e6])
  }
  return coords
}

async function fetchValhallaSegment(
  from: LatLng,
  to: LatLng,
  category: string,
): Promise<{ coords: LatLng[]; distanceM: number } | null> {
  const info = valhallaCosting(category)
  if (!info) return null

  const body = JSON.stringify({
    locations: [{ lon: from[1], lat: from[0] }, { lon: to[1], lat: to[0] }],
    costing: info.costing,
    costing_options: info.options ? { [info.costing]: info.options } : undefined,
    units: 'km',
  })

  for (const endpoint of VALHALLA_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const data = await res.json()
      if (!data.trip?.legs?.length) continue
      const leg = data.trip.legs[0]
      return { coords: decodePolyline6(leg.shape), distanceM: leg.summary.length * 1000 }
    } catch {}
  }

  return null
}

async function fetchOsrmRoadSegment(from: LatLng, to: LatLng): Promise<{ coords: LatLng[]; distanceM: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&radiuses=200;200`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json()
    const route = data.routes?.[0]
    const coords = route?.geometry?.coordinates
    if (!Array.isArray(coords) || coords.length < 2) return null
    return {
      coords: coords.map((point: [number, number]) => [point[1], point[0]] as LatLng),
      distanceM: route.distance,
    }
  } catch {
    return null
  }
}

async function fetchRoutingSegment(
  from: LatLng,
  to: LatLng,
  category: string,
): Promise<{ coords: LatLng[]; distanceM: number } | null> {
  const valhalla = await fetchValhallaSegment(from, to, category)
  if (valhalla) return valhalla
  if (category === 'cycling') return fetchOsrmRoadSegment(from, to)
  return null
}

// ─── Elevation via Open-Meteo ─────────────────────────────────────────────────

function sampleTrackWithIndexes(track: LatLng[], max = 100): { points: LatLng[]; indexes: number[] } {
  if (track.length <= max) {
    return {
      points: track,
      indexes: track.map((_, index) => index),
    }
  }

  const points: LatLng[] = []
  const indexes: number[] = []
  const step = (track.length - 1) / (max - 1)
  for (let i = 0; i < max; i++) {
    const index = Math.round(i * step)
    points.push(track[index])
    indexes.push(index)
  }

  return { points, indexes }
}

async function fetchElevationProfile(track: LatLng[]): Promise<{ gain: number; profile: ElevationPoint[]; coloredSegments: ColoredSegment[] }> {
  if (track.length < 2) return { gain: 0, profile: [], coloredSegments: [] }
  const sampledInfo = sampleTrackWithIndexes(track, 100)
  const sampled = sampledInfo.points
  let totalM = 0
  const distances = sampled.map((point, index) => {
    if (index > 0) totalM += segmentLength([sampled[index - 1], point])
    return totalM / 1000
  })
  const lats = sampled.map(p => p[0].toFixed(5)).join(',')
  const lngs = sampled.map(p => p[1].toFixed(5)).join(',')
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) return { gain: 0, profile: [], coloredSegments: [] }
    const data = await res.json()
    const elevs: number[] = data.elevation ?? []
    let gain = 0
    for (let i = 1; i < elevs.length; i++) {
      if (elevs[i] > elevs[i - 1]) gain += elevs[i] - elevs[i - 1]
    }
    const profile = elevs.map((ele, index) => ({ km: distances[index] ?? 0, ele }))
    const coloredSegments: ColoredSegment[] = []
    if (sampled.length >= 2 && profile.length >= 2) {
      let seg: ColoredSegment | null = null
      for (let i = 1; i < Math.min(sampled.length, profile.length); i++) {
        const distKm = profile[i].km - profile[i - 1].km
        const eleM = profile[i].ele - profile[i - 1].ele
        const grade = distKm > 0 ? (eleM / (distKm * 1000)) * 100 : 0
        const color = slopeColor(grade)
        const fromIndex = sampledInfo.indexes[i - 1]
        const toIndex = sampledInfo.indexes[i]
        const coords = track.slice(fromIndex, toIndex + 1)
        const segmentCoords = coords.length > 1 ? coords : [sampled[i - 1], sampled[i]]
        if (!seg) {
          seg = { coords: segmentCoords, color }
        } else if (color === seg.color) {
          seg.coords.push(...segmentCoords.slice(1))
        } else {
          coloredSegments.push(seg)
          seg = { coords: segmentCoords, color }
        }
      }
      if (seg) coloredSegments.push(seg)
    }

    return {
      gain: Math.round(gain),
      profile,
      coloredSegments,
    }
  } catch {
    return { gain: 0, profile: [], coloredSegments: [] }
  }
}

function ElevationPreview({ profile }: { profile: ElevationPoint[] }) {
  if (profile.length < 2) return null

  const width = 320
  const height = 72
  const pad = 8
  const maxKm = Math.max(profile[profile.length - 1].km, 1)
  const minEle = Math.min(...profile.map(point => point.ele))
  const maxEle = Math.max(...profile.map(point => point.ele))
  const range = Math.max(maxEle - minEle, 1)
  const points = profile.map(point => {
    const x = pad + (point.km / maxKm) * (width - pad * 2)
    const y = height - pad - ((point.ele - minEle) / range) * (height - pad * 2)
    return { x, y, point }
  })
  const baseline = height - pad

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[72px]" aria-hidden="true">
      {points.slice(1).map((current, index) => {
        const prev = points[index]
        const distKm = current.point.km - prev.point.km
        const eleM = current.point.ele - prev.point.ele
        const grade = distKm > 0 ? (eleM / (distKm * 1000)) * 100 : 0
        const color = slopeColor(grade)

        return (
          <g key={index}>
            <polygon
              points={`${prev.x},${baseline} ${prev.x},${prev.y} ${current.x},${current.y} ${current.x},${baseline}`}
              fill={color}
              opacity={0.14}
            />
            <line
              x1={prev.x}
              y1={prev.y}
              x2={current.x}
              y2={current.y}
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )
      })}
      <text x={pad} y={height - 4} fill="rgba(255,255,255,0.52)" fontSize="10">{Math.round(minEle)}m</text>
      <text x={width - pad} y={14} fill="rgba(255,255,255,0.52)" fontSize="10" textAnchor="end">{Math.round(maxEle)}m</text>
    </svg>
  )
}

// ─── Marker icon factory ──────────────────────────────────────────────────────

function makeIcon(num: number, selected: boolean, isLast: boolean): L.DivIcon {
  const bg = selected ? '#fbbf24' : isLast ? '#ff2200' : '#39ff14'
  const textColor = '#000'
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:${bg};color:${textColor};
      font-weight:900;font-size:11px;
      display:flex;align-items:center;justify-content:center;
      border:2.5px solid rgba(0,0,0,0.25);
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
      cursor:pointer;user-select:none;
    ">${num}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function straightLine(from: LatLng, to: LatLng): { coords: LatLng[]; distanceM: number } {
  const R = 6371000
  const dLat = (to[0] - from[0]) * Math.PI / 180
  const dLon = (to[1] - from[1]) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from[0] * Math.PI / 180) * Math.cos(to[0] * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  const distanceM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return { coords: [from, to], distanceM }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RouteDrawMap({ category, height = 500, initialWaypoints, initialTrack, undoRequestId = 0, onUpdate }: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const waypointsRef = useRef<WaypointEntry[]>([])
  const segmentsRef = useRef<SegmentEntry[]>([])
  const coloredRouteLayersRef = useRef<L.Polyline[]>([])
  const selectedIdxRef = useRef<number | null>(null)
  const categoryRef = useRef(category)
  const elevDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRoutingRef = useRef(0)
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate
  const initialLoadedRef = useRef(false)
  const skipRoutingRef = useRef(false)

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [stats, setStats] = useState({ distanceKm: 0, elevGain: 0 })
  const [elevProfile, setElevProfile] = useState<ElevationPoint[]>([])
  const [routing, setRouting] = useState(false)
  const [elevLoading, setElevLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const lastUndoRequestRef = useRef(undoRequestId)

  // ─── Helper: build full track from all segments ──────────────────────────

  function buildFullTrack(): LatLng[] {
    const track: LatLng[] = []
    segmentsRef.current.forEach((seg, i) => {
      if (!seg) return
      if (i === 0) track.push(...seg.coords)
      else track.push(...seg.coords.slice(1))
    })
    if (track.length === 0 && waypointsRef.current.length === 1) {
      track.push(waypointsRef.current[0].latlng)
    }
    return track
  }

  function clearColoredRouteLayers() {
    const map = mapRef.current
    if (!map) return
    coloredRouteLayersRef.current.forEach(layer => map.removeLayer(layer))
    coloredRouteLayersRef.current = []
  }

  function renderColoredRouteLayers(coloredSegments: ColoredSegment[]) {
    const map = mapRef.current
    clearColoredRouteLayers()
    if (!map || coloredSegments.length === 0) return
    coloredRouteLayersRef.current = coloredSegments
      .filter(segment => segment.coords.length > 1)
      .map(segment => L.polyline(segment.coords, {
        color: segment.color,
        weight: 5,
        opacity: 0.98,
        lineJoin: 'round',
        lineCap: 'round',
      }).addTo(map))
  }

  // ─── Helper: compute total distance ──────────────────────────────────────

  function totalDistanceKm(): number {
    const total = segmentsRef.current.reduce((sum, s) => sum + s.distanceM, 0)
    return Math.round(total / 100) / 10
  }

  // ─── Helper: update all marker icons ─────────────────────────────────────

  function refreshMarkerIcons() {
    const wps = waypointsRef.current
    wps.forEach((wp, i) => {
      const isSelected = i === selectedIdxRef.current
      const isLast = i === wps.length - 1 && wps.length > 1
      wp.marker.setIcon(makeIcon(i + 1, isSelected, isLast))
    })
  }

  // ─── Helper: publish result to parent ────────────────────────────────────

  function publishResult(elevGain?: number) {
    const wps = waypointsRef.current
    const track = buildFullTrack()
    const distanceKm = totalDistanceKm()
    const gain = elevGain ?? stats.elevGain
    onUpdateRef.current({
      waypoints: wps.map(w => w.latlng),
      track,
      distanceKm,
      elevGain: gain,
      startLat: wps[0]?.latlng[0] ?? null,
      startLng: wps[0]?.latlng[1] ?? null,
      endLat: wps[wps.length - 1]?.latlng[0] ?? null,
      endLng: wps[wps.length - 1]?.latlng[1] ?? null,
    })
  }

  // ─── Schedule elevation fetch (debounced) ─────────────────────────────────

  function scheduleElevation() {
    if (elevDebounceRef.current) clearTimeout(elevDebounceRef.current)
    setElevLoading(true)
    elevDebounceRef.current = setTimeout(async () => {
      const track = buildFullTrack()
      const { gain, profile, coloredSegments } = await fetchElevationProfile(track)
      setElevLoading(false)
      setElevProfile(profile)
      renderColoredRouteLayers(coloredSegments)
      setStats(s => ({ ...s, elevGain: gain }))
      publishResult(gain)
    }, 600)
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const map = mapRef.current
    const query = searchQuery.trim()
    if (!map || !query) return

    setSearching(true)
    setSearchError(null)
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        limit: '1',
      })
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: { 'Accept-Language': 'en' },
      })
      const data: Array<{ lat: string; lon: string }> = await res.json()
      const first = data[0]
      if (!first) {
        setSearchError('Place not found')
        return
      }
      map.setView([Number(first.lat), Number(first.lon)], 13)
    } catch {
      setSearchError('Search failed')
    } finally {
      setSearching(false)
    }
  }

  function goToCurrentLocation() {
    const map = mapRef.current
    if (!map || typeof navigator === 'undefined') return
    navigator.geolocation?.getCurrentPosition(pos => {
      map.setView([pos.coords.latitude, pos.coords.longitude], 14)
    })
  }

  // ─── Route a single segment (fromIdx → fromIdx+1) ────────────────────────

  const routeSegment = useCallback(async (fromIdx: number) => {
    const map = mapRef.current
    if (!map) return
    const wps = waypointsRef.current
    const segs = segmentsRef.current
    const from = wps[fromIdx]?.latlng
    const to = wps[fromIdx + 1]?.latlng
    if (!from || !to) return

    pendingRoutingRef.current += 1
    setRouting(true)
    clearColoredRouteLayers()

    // Draw a dashed placeholder while routing
    const placeholder = L.polyline([from, to], {
      color: 'rgba(255,255,255,0.3)',
      weight: 3,
      dashArray: '6,8',
    }).addTo(map)

    // Remove existing segment polyline at this index
    if (segs[fromIdx]) {
      map.removeLayer(segs[fromIdx].polyline)
    }

    let result: { coords: LatLng[]; distanceM: number } | null = await fetchRoutingSegment(from, to, categoryRef.current)

    if (!result) {
      result = straightLine(from, to)
    }

    map.removeLayer(placeholder)

    const polyline = L.polyline(result.coords, {
      color: '#39ff14',
      weight: 4,
      opacity: 0.9,
      lineJoin: 'round',
    }).addTo(map)

    segs[fromIdx] = { polyline, coords: result.coords, distanceM: result.distanceM }

    pendingRoutingRef.current -= 1
    if (pendingRoutingRef.current === 0) setRouting(false)

    const km = totalDistanceKm()
    setStats(s => ({ ...s, distanceKm: km }))
    scheduleElevation()
    publishResult()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Add waypoint ─────────────────────────────────────────────────────────

  const addWaypoint = useCallback((latlng: LatLng) => {
    const map = mapRef.current
    if (!map) return
    const wps = waypointsRef.current
    const idx = wps.length
    const isLast = true
    const marker = L.marker(latlng, {
      icon: makeIcon(idx + 1, false, isLast),
      draggable: true,
    })

    marker.on('click', () => {
      selectedIdxRef.current = selectedIdxRef.current === idx ? null : idx
      setSelectedIdx(selectedIdxRef.current)
      refreshMarkerIcons()
    })

    marker.on('drag', (e) => {
      const pos = (e.target as L.Marker).getLatLng()
      const newLatLng: LatLng = [pos.lat, pos.lng]
      wps[idx].latlng = newLatLng
      const segs = segmentsRef.current
      // Update straight-line previews during drag
      if (segs[idx - 1]) {
        segs[idx - 1].polyline.setLatLngs([wps[idx - 1].latlng, newLatLng])
      }
      if (segs[idx]) {
        segs[idx].polyline.setLatLngs([newLatLng, wps[idx + 1].latlng])
      }
    })

    marker.on('dragend', async () => {
      const pos = marker.getLatLng()
      wps[idx].latlng = [pos.lat, pos.lng]
      // Re-route both adjacent segments
      const promises: Promise<void>[] = []
      if (idx > 0) promises.push(routeSegment(idx - 1))
      if (idx < wps.length - 1) promises.push(routeSegment(idx))
      await Promise.all(promises)
    })

    marker.addTo(map)

    // Fix icon of previous last waypoint
    if (idx > 0) {
      wps[idx - 1].marker.setIcon(makeIcon(idx, false, false))
    }

    wps.push({ latlng, marker })

    // Clear selection
    selectedIdxRef.current = null
    setSelectedIdx(null)

    if (idx > 0) {
      if (!skipRoutingRef.current) routeSegment(idx - 1)
    } else {
      // First waypoint — just publish
      const km = totalDistanceKm()
      setStats({ distanceKm: km, elevGain: 0 })
      publishResult(0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSegment])

  // ─── Remove waypoint ──────────────────────────────────────────────────────

  const removeWaypoint = useCallback(async (idx: number) => {
    const map = mapRef.current
    if (!map) return
    const wps = waypointsRef.current
    const segs = segmentsRef.current

    // Remove marker from map
    map.removeLayer(wps[idx].marker)

    // Remove adjacent segments
    if (segs[idx - 1]) { map.removeLayer(segs[idx - 1].polyline); segs.splice(idx - 1, 1) }
    if (segs[idx - 1]) { map.removeLayer(segs[idx - 1].polyline); segs.splice(idx - 1, 1) }

    // Remove from array
    wps.splice(idx, 1)

    // Re-index remaining markers
    wps.forEach((wp, i) => {
      const isLast = i === wps.length - 1 && wps.length > 1
      wp.marker.setIcon(makeIcon(i + 1, false, isLast))
      // Re-bind click with correct index
      wp.marker.off('click')
      wp.marker.on('click', () => {
        selectedIdxRef.current = selectedIdxRef.current === i ? null : i
        setSelectedIdx(selectedIdxRef.current)
        refreshMarkerIcons()
      })
    })

    selectedIdxRef.current = null
    setSelectedIdx(null)

    // If there are now two waypoints that were previously non-adjacent, add segment between them
    if (idx > 0 && idx <= wps.length) {
      await routeSegment(idx - 1)
    } else {
      const km = totalDistanceKm()
      setStats(s => ({ ...s, distanceKm: km }))
      scheduleElevation()
      publishResult()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeSegment])

  // ─── Undo: remove last waypoint ──────────────────────────────────────────

  const undoLast = useCallback(() => {
    const wps = waypointsRef.current
    if (wps.length === 0) return
    removeWaypoint(wps.length - 1)
  }, [removeWaypoint])

  useEffect(() => {
    if (undoRequestId === lastUndoRequestRef.current) return
    lastUndoRequestRef.current = undoRequestId
    undoLast()
  }, [undoRequestId, undoLast])

  // ─── Re-route all segments when category changes ──────────────────────────

  const rerouteAll = useCallback(async () => {
    const wps = waypointsRef.current
    if (wps.length < 2) return
    const promises: Promise<void>[] = []
    for (let i = 0; i < wps.length - 1; i++) {
      promises.push(routeSegment(i))
    }
    await Promise.all(promises)
  }, [routeSegment])

  // ─── Mount Leaflet map ────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return

    const map = L.map(mapDivRef.current, {
      center: [44.5, 16.5],
      zoom: 7,
      zoomControl: false,
      attributionControl: false,
    })

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    const baseLayers = createMapBaseLayers()
    let activeBaseLayer: L.TileLayer | null = null
    const setBaseLayer = (name: keyof ReturnType<typeof createMapBaseLayers>) => {
      if (activeBaseLayer) map.removeLayer(activeBaseLayer)
      activeBaseLayer = baseLayers[name]
      activeBaseLayer.addTo(map)
    }
    setBaseLayer('Standard')

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (pendingRoutingRef.current > 0) return
      addWaypoint([e.latlng.lat, e.latlng.lng])
    })

    mapRef.current = map

    // GPS button
    const layerWrap = document.createElement('div')
    layerWrap.style.cssText =
      'position:absolute;top:10px;right:10px;z-index:900;min-width:112px;'
    const layerBtn = document.createElement('button')
    layerBtn.type = 'button'
    layerBtn.textContent = 'Standard'
    layerBtn.style.cssText =
      'width:100%;border-radius:999px;border:1px solid rgba(255,255,255,0.16);background:rgba(5,8,22,0.88);color:#f5f7ff;padding:8px 12px;font-size:12px;font-weight:800;box-shadow:0 10px 28px rgba(0,0,0,0.3);backdrop-filter:blur(8px);cursor:pointer;'
    const layerMenu = document.createElement('div')
    layerMenu.style.cssText =
      'display:none;margin-top:8px;border-radius:14px;border:1px solid rgba(255,255,255,0.14);background:rgba(5,8,22,0.94);padding:4px;box-shadow:0 14px 32px rgba(0,0,0,0.35);backdrop-filter:blur(10px);'

    const renderLayerMenu = (open: boolean) => {
      layerMenu.innerHTML = ''
      ;(Object.keys(baseLayers) as Array<keyof typeof baseLayers>).forEach(name => {
        const option = document.createElement('button')
        option.type = 'button'
        option.textContent = name
        option.style.cssText =
          'display:block;width:100%;border:0;border-radius:10px;background:transparent;color:#f5f7ff;padding:8px 10px;text-align:left;font-size:12px;font-weight:800;cursor:pointer;'
        option.onclick = (event) => {
          event.stopPropagation()
          setBaseLayer(name)
          layerBtn.textContent = name
          layerMenu.style.display = 'none'
        }
        layerMenu.appendChild(option)
      })
      layerMenu.style.display = open ? 'block' : 'none'
    }

    layerBtn.onclick = (event) => {
      event.stopPropagation()
      renderLayerMenu(layerMenu.style.display !== 'block')
    }
    layerWrap.appendChild(layerBtn)
    layerWrap.appendChild(layerMenu)
    mapDivRef.current.appendChild(layerWrap)

    const gpsDiv = document.createElement('div')
    gpsDiv.style.cssText =
      'position:absolute;top:58px;right:10px;z-index:900;width:36px;height:36px;border-radius:10px;background:rgba(5,8,22,0.88);border:1.5px solid rgba(255,255,255,0.14);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;'
    gpsDiv.title = 'My location'
    gpsDiv.innerHTML = '📍'
    gpsDiv.onclick = () => {
      navigator.geolocation?.getCurrentPosition(pos => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 14)
      })
    }
    mapDivRef.current.appendChild(gpsDiv)

    return () => {
      clearColoredRouteLayers()
      map.remove()
      mapRef.current = null
      waypointsRef.current = []
      segmentsRef.current = []
    }
  // addWaypoint is stable (useCallback with no deps changing after mount)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Load initial waypoints ───────────────────────────────────────────────

  useEffect(() => {
    if (!initialWaypoints?.length || !mapRef.current) return
    if (initialLoadedRef.current) return
    initialLoadedRef.current = true
    const map = mapRef.current

    const loadAsync = async () => {
      if (initialTrack && initialTrack.length >= 2) {
        // Pre-populate from existing GPX track — no Valhalla routing needed
        skipRoutingRef.current = true
        for (const latlng of initialWaypoints) {
          addWaypoint(latlng)
        }
        skipRoutingRef.current = false

        // Split the GPX track into segments by closest waypoint
        const wps = waypointsRef.current
        const segs = segmentsRef.current
        let prevTrackIdx = 0
        for (let i = 1; i < wps.length; i++) {
          const trackIdx = findClosestIdx(initialTrack, wps[i].latlng, prevTrackIdx)
          const coords = initialTrack.slice(prevTrackIdx, trackIdx + 1)
          const distanceM = segmentLength(coords)
          const polyline = L.polyline(coords, { color: '#39ff14', weight: 4, opacity: 0.9, lineJoin: 'round' }).addTo(map)
          segs[i - 1] = { polyline, coords, distanceM }
          prevTrackIdx = trackIdx
        }

        const km = totalDistanceKm()
        setStats(s => ({ ...s, distanceKm: km }))
        scheduleElevation()
        publishResult()
      } else {
        // No track — route via Valhalla
        for (const latlng of initialWaypoints) {
          addWaypoint(latlng)
          await new Promise(r => setTimeout(r, 80))
        }
      }

      // Fit map
      const wps = waypointsRef.current
      if (wps.length > 1) {
        map.fitBounds(L.latLngBounds(wps.map(w => w.latlng)), { padding: [32, 32] })
      } else if (wps.length === 1) {
        map.setView(wps[0].latlng, 13)
      }
    }

    loadAsync()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef.current ? 'ready' : 'not-ready'])

  // ─── React to category change → re-route ─────────────────────────────────

  useEffect(() => {
    if (categoryRef.current === category) return
    categoryRef.current = category
    rerouteAll()
  }, [category, rerouteAll])

  // ─── Expose undo/remove via imperative handle (through parent) ────────────

  // selectedIdx exposed as state — parent reads it from here

  const handleRemoveSelected = useCallback(() => {
    if (selectedIdxRef.current === null) return
    removeWaypoint(selectedIdxRef.current)
  }, [removeWaypoint])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'relative' }}>
      {/* Map */}
      <div
        ref={mapDivRef}
        style={{
          height: `${height}px`,
          width: '100%',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          background: '#050816',
          position: 'relative',
        }}
      />

      <form
        onSubmit={handleSearch}
        className="absolute left-3 top-3 z-[850] flex max-w-[calc(100%-150px)] gap-2"
      >
        <div className="min-w-0 flex-1">
          <input
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Search city or place"
            className="h-10 w-full rounded-xl border px-3 text-sm font-semibold outline-none"
            style={{
              background: 'rgba(5,8,22,0.9)',
              borderColor: 'rgba(255,255,255,0.16)',
              color: '#f5f7ff',
              boxShadow: '0 10px 28px rgba(0,0,0,0.28)',
            }}
          />
          {searchError && (
            <div className="mt-1 rounded-lg px-2 py-1 text-xs font-bold text-red-300"
              style={{ background: 'rgba(5,8,22,0.9)' }}>
              {searchError}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={searching || !searchQuery.trim()}
          className="h-10 rounded-xl border px-3 text-xs font-black disabled:opacity-50"
          style={{ background: 'var(--primary)', borderColor: 'var(--primary)', color: '#031109' }}
        >
          {searching ? '...' : 'Go'}
        </button>
        <button
          type="button"
          onClick={goToCurrentLocation}
          className="h-10 rounded-xl border px-3 text-xs font-black"
          style={{
            background: 'rgba(5,8,22,0.9)',
            borderColor: 'rgba(255,255,255,0.16)',
            color: '#f5f7ff',
          }}
        >
          Current
        </button>
      </form>

      <div
        className="absolute bottom-3 left-3 right-3 z-[850] rounded-2xl border p-3"
        style={{
          background: 'rgba(5,8,22,0.82)',
          borderColor: 'rgba(255,255,255,0.14)',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 18px 48px rgba(0,0,0,0.35)',
        }}
      >
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="text-[10px] font-black uppercase" style={{ color: 'rgba(255,255,255,0.52)' }}>Distance</div>
            <div className="text-base font-black" style={{ color: 'var(--primary)' }}>{stats.distanceKm.toFixed(1)} km</div>
          </div>
          <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="text-[10px] font-black uppercase" style={{ color: 'rgba(255,255,255,0.52)' }}>Elevation</div>
            <div className="text-base font-black" style={{ color: '#f5f7ff' }}>{elevLoading ? '...' : `${stats.elevGain} m`}</div>
          </div>
          <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="text-[10px] font-black uppercase" style={{ color: 'rgba(255,255,255,0.52)' }}>Points</div>
            <div className="text-base font-black" style={{ color: '#f5f7ff' }}>{waypointsRef.current.length}</div>
          </div>
        </div>

        {elevProfile.length >= 2 ? (
          <div className="mt-2 overflow-hidden rounded-xl" style={{ background: 'rgba(0,0,0,0.18)' }}>
            <ElevationPreview profile={elevProfile} />
          </div>
        ) : (
          <div className="mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.58)' }}>
            {routing ? 'Routing...' : waypointsRef.current.length === 0 ? 'Click on the map to add waypoints.' : 'Add another point to see elevation.'}
          </div>
        )}
      </div>

      {/* Stats + controls bar */}
      <div
        className="flex items-center justify-between gap-3 mt-2 px-1"
        style={{ minHeight: 36 }}
      >
        <div className="flex items-center gap-3 text-sm font-bold">
          {routing && (
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Routing…</span>
          )}
          {!routing && (stats.distanceKm > 0 || waypointsRef.current.length > 0) && (
            <>
              <span style={{ color: 'var(--primary)' }}>{stats.distanceKm.toFixed(1)} km</span>
              {elevLoading
                ? <span style={{ color: 'var(--text-muted)' }}>↑ …m</span>
                : stats.elevGain > 0 && <span style={{ color: 'var(--text-muted)' }}>↑ {stats.elevGain} m</span>
              }
              <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 400 }}>
                {waypointsRef.current.length} point{waypointsRef.current.length !== 1 ? 's' : ''}
              </span>
            </>
          )}
          {!routing && waypointsRef.current.length === 0 && (
            <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 400 }}>
              Click on the map to add waypoints
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedIdx !== null && (
            <button
              onClick={handleRemoveSelected}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors"
              style={{ borderColor: '#f87171', color: '#f87171', background: 'rgba(248,113,113,0.08)' }}
            >
              ✕ Remove point
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
