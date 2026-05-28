'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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

interface Props {
  category: string
  height?: number
  initialWaypoints?: LatLng[]
  onUpdate: (result: DrawResult) => void
}

// ─── OSRM profile per category ────────────────────────────────────────────────

function osrmProfile(category: string): 'foot' | 'bike' | null {
  if (category === 'cycling') return 'bike'
  if (['running', 'hiking', 'skiing', 'climbing', 'kayaking'].includes(category)) return 'foot'
  return null
}

// ─── OSRM fetch ───────────────────────────────────────────────────────────────

async function fetchOsrmSegment(
  from: LatLng,
  to: LatLng,
  profile: 'foot' | 'bike',
): Promise<{ coords: LatLng[]; distanceM: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/${profile}/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.routes?.length) return null
    const route = data.routes[0]
    const coords: LatLng[] = (route.geometry.coordinates as [number, number][]).map(
      ([lng, lat]) => [lat, lng],
    )
    return { coords, distanceM: route.distance as number }
  } catch {
    return null
  }
}

// ─── Elevation via Open-Meteo ─────────────────────────────────────────────────

function sampleTrack(track: LatLng[], max = 100): LatLng[] {
  if (track.length <= max) return track
  const result: LatLng[] = []
  const step = (track.length - 1) / (max - 1)
  for (let i = 0; i < max; i++) result.push(track[Math.round(i * step)])
  return result
}

async function fetchElevGain(track: LatLng[]): Promise<number> {
  if (track.length < 2) return 0
  const sampled = sampleTrack(track, 100)
  const lats = sampled.map(p => p[0].toFixed(5)).join(',')
  const lngs = sampled.map(p => p[1].toFixed(5)).join(',')
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) return 0
    const data = await res.json()
    const elevs: number[] = data.elevation ?? []
    let gain = 0
    for (let i = 1; i < elevs.length; i++) {
      if (elevs[i] > elevs[i - 1]) gain += elevs[i] - elevs[i - 1]
    }
    return Math.round(gain)
  } catch {
    return 0
  }
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

export default function RouteDrawMap({ category, height = 500, initialWaypoints, onUpdate }: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const waypointsRef = useRef<WaypointEntry[]>([])
  const segmentsRef = useRef<SegmentEntry[]>([])
  const selectedIdxRef = useRef<number | null>(null)
  const categoryRef = useRef(category)
  const elevDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRoutingRef = useRef(0)
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [stats, setStats] = useState({ distanceKm: 0, elevGain: 0 })
  const [routing, setRouting] = useState(false)

  // ─── Helper: build full track from all segments ──────────────────────────

  function buildFullTrack(): LatLng[] {
    const track: LatLng[] = []
    segmentsRef.current.forEach((seg, i) => {
      if (i === 0) track.push(...seg.coords)
      else track.push(...seg.coords.slice(1))
    })
    if (track.length === 0 && waypointsRef.current.length === 1) {
      track.push(waypointsRef.current[0].latlng)
    }
    return track
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
    elevDebounceRef.current = setTimeout(async () => {
      const track = buildFullTrack()
      const gain = await fetchElevGain(track)
      setStats(s => ({ ...s, elevGain: gain }))
      publishResult(gain)
    }, 900)
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

    const profile = osrmProfile(categoryRef.current)
    let result: { coords: LatLng[]; distanceM: number } | null = null

    if (profile) {
      result = await fetchOsrmSegment(from, to, profile)
    }

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
      routeSegment(idx - 1)
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

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (pendingRoutingRef.current > 0) return
      addWaypoint([e.latlng.lat, e.latlng.lng])
    })

    mapRef.current = map

    // GPS button
    const gpsDiv = document.createElement('div')
    gpsDiv.style.cssText =
      'position:absolute;top:10px;right:10px;z-index:900;width:36px;height:36px;border-radius:10px;background:rgba(5,8,22,0.88);border:1.5px solid rgba(255,255,255,0.14);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:16px;'
    gpsDiv.title = 'My location'
    gpsDiv.innerHTML = '📍'
    gpsDiv.onclick = () => {
      navigator.geolocation?.getCurrentPosition(pos => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 14)
      })
    }
    mapDivRef.current.appendChild(gpsDiv)

    return () => {
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
    const map = mapRef.current

    const loadAsync = async () => {
      for (const latlng of initialWaypoints) {
        addWaypoint(latlng)
        // Small delay between waypoints to avoid flooding OSRM
        await new Promise(r => setTimeout(r, 80))
      }
      // Fit map to track
      const wps = waypointsRef.current
      if (wps.length > 1) {
        map.fitBounds(L.latLngBounds(wps.map(w => w.latlng)), { padding: [32, 32] })
      } else if (wps.length === 1) {
        map.setView(wps[0].latlng, 13)
      }
    }

    loadAsync()
  // Only run once on mount (initialWaypoints is stable ref from parent)
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
              {stats.elevGain > 0 && (
                <span style={{ color: 'var(--text-muted)' }}>↑ {stats.elevGain} m</span>
              )}
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
          <button
            onClick={undoLast}
            disabled={waypointsRef.current.length === 0}
            className="text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors disabled:opacity-30"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--surface)' }}
          >
            ↩ Undo
          </button>
        </div>
      </div>
    </div>
  )
}
