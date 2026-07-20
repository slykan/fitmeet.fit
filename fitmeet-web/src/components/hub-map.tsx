'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Pane, ZoomControl, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useRouter } from 'next/navigation'
import { Calendar, ArrowRight, X, Users, Zap, LocateFixed, Check, Wind, CloudRain, SunMedium, ArrowUp, Sun, CloudSun, Cloud, CloudSnow, CloudLightning, Droplets, ChevronDown, ChevronUp } from 'lucide-react'
import api from '@/lib/api'
import { formatEventDateTime } from '@/lib/event-time'
import { useAuthStore } from '@/store/auth'
import { CATEGORIES, CATEGORY_EMOJI } from '@/lib/categories'
import { EventCommentsPreview } from '@/components/event-comments-preview'
import { WeatherBadge } from '@/components/WeatherBadge'
import { fetchCurrentWeather, fetchDailyForecast, fetchRainForecast, fetchRelevantEventWeather, weatherConditionLabel, weatherIcon, windDirectionLabelDetailed, type DailyForecastDay, type EventWeather, type RainForecast } from '@/lib/weather'
import { fetchRadarFrames, type RadarFrame } from '@/lib/radar'
import { WindOverlay } from '@/components/location-picker-map'
import { sortEventsBySchedule } from '@/lib/event-order'
import { fetchGpxActivityStats, type GpxActivityStats } from '@/lib/gpx-activity-stats'

const RADAR_MAX_ZOOM = 7
const BASE_MAX_ZOOM = 18

const FORECAST_ICONS: Record<string, typeof Sun> = {
  'sun': Sun,
  'cloud-sun': CloudSun,
  'cloud': Cloud,
  'cloud-rain': CloudRain,
  'cloud-snow': CloudSnow,
  'cloud-lightning': CloudLightning,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface EventPin {
  id: number
  title: string
  image_url: string | null
  category: { value: string; label: string }
  location: { lat: number; lng: number; address: string | null }
  schedule: { start_at: string; timezone: string; duration_minutes: number | null }
  activity: { distance_km: number | null; elevation_gain: number | null; gpx_url?: string | null }
  participants_count: number
  comments_count: number
  max_participants: number | null
  status: string
  is_full: boolean
  is_joined: boolean
  is_organizer: boolean
  organizer: { id: number; name: string } | null
}

function createEmojiIcon(emoji: string, angle = 0, zIndex = 1, delayMs = 0, cancelled = false) {
  const offsetPx = Math.round(Math.sin(angle * Math.PI / 180) * 18)
  const accent = cancelled ? '#f87171' : '#39FF14'

  return L.divIcon({
    html: `<div style="
      position:relative;
      width:64px;
      height:64px;
      z-index:${zIndex};
      cursor:pointer;
    ">
      <div style="
        position:absolute;
        inset:0;
        animation:fm-marker-bloom 620ms cubic-bezier(.2,.85,.2,1) ${delayMs}ms both;
      ">
      <div style="
        position:absolute;
        left:calc(50% - 19px + ${offsetPx}px);
        top:10px;
        width:38px;
        height:38px;
        background:#16161F;
        border:2.5px solid ${accent};
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:18px;
        box-shadow:0 4px 14px rgba(0,0,0,0.65),0 0 16px ${cancelled ? 'rgba(248,113,113,0.22)' : 'rgba(57,255,20,0.22)'};
      ">${emoji}</div>
      <div style="
        position:absolute;
        left:calc(50% - 3px + ${Math.round(offsetPx * 0.28)}px);
        bottom:10px;
        width:6px;
        height:6px;
        border-radius:50%;
        background:${accent};
        opacity:0.9;
        box-shadow:0 0 8px ${cancelled ? 'rgba(248,113,113,0.42)' : 'rgba(57,255,20,0.42)'};
      "></div>
      </div>
    </div>`,
    className: '',
    iconSize: [64, 64],
    iconAnchor: [32, 54],
  })
}

function eventTiming(event: Pick<EventPin, 'schedule'>) {
  const start = new Date(event.schedule.start_at).getTime()
  const end = start + (event.schedule.duration_minutes ?? 60) * 60_000
  const now = Date.now()
  return {
    inProgress: start <= now && now < end,
    past: now >= end,
  }
}

function getZoomForRadius(km: number): number {
  if (km <= 5)   return 13
  if (km <= 10)  return 12
  if (km <= 25)  return 11
  if (km <= 50)  return 10
  if (km <= 100) return 9
  return 8
}

const RADIUS_OPTIONS = [
  { label: 'Nearby', km: 50 },
  { label: 'City', km: 200 },
  { label: 'Region', km: 500 },
  { label: 'All', km: null },
] as const

const LIGHTNING_POSITIONS = [
  { left: '15%', top: '22%' },
  { left: '42%', top: '58%' },
  { left: '68%', top: '30%' },
  { left: '82%', top: '68%' },
  { left: '30%', top: '78%' },
] as const

function getDistanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number) => deg * Math.PI / 180
  const earthKm = 6371
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function MapViewport({ events, lat, lng, radiusKm, ready, recenterKey }: {
  events: EventPin[]
  lat: number | null
  lng: number | null
  radiusKm: number | null
  ready: boolean
  recenterKey: number
}) {
  const map = useMap()

  useEffect(() => {
    if (!ready) return
    if (events.length > 0) {
      const pts: [number, number][] = events.map(e => [e.location.lat, e.location.lng])
      if (lat && lng) pts.push([lat, lng])
      map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], animate: true, duration: 1 })
    } else if (lat && lng) {
      map.setView([lat, lng], getZoomForRadius(radiusKm ?? 500), { animate: true, duration: 1 })
    }
  }, [ready, map, events, lat, lng, radiusKm, recenterKey])

  return null
}

function HubWeatherSync({
  onCenterChange,
  onInteractionChange,
}: {
  onCenterChange: (center: { lat: number; lng: number }) => void
  onInteractionChange: (moving: boolean) => void
}) {
  const map = useMap()
  const userMovedRef = useRef(false)

  useEffect(() => {
    const container = map.getContainer()

    const markUserInteraction = () => {
      userMovedRef.current = true
      onInteractionChange(true)
    }

    container.addEventListener('pointerdown', markUserInteraction, { passive: true })
    container.addEventListener('wheel', markUserInteraction, { passive: true })

    return () => {
      container.removeEventListener('pointerdown', markUserInteraction)
      container.removeEventListener('wheel', markUserInteraction)
    }
  }, [map])

  useMapEvents({
    movestart: () => {
      if (userMovedRef.current) onInteractionChange(true)
    },
    zoomstart: () => {
      if (userMovedRef.current) onInteractionChange(true)
    },
    moveend: (event) => {
      onInteractionChange(false)
      if (!userMovedRef.current) return
      const center = event.target.getCenter()
      userMovedRef.current = false
      onCenterChange({ lat: center.lat, lng: center.lng })
    },
    zoomend: (event) => {
      onInteractionChange(false)
      if (!userMovedRef.current) return
      const center = event.target.getCenter()
      userMovedRef.current = false
      onCenterChange({ lat: center.lat, lng: center.lng })
    },
  })

  return null
}

function formatFrameTime(unixSeconds?: number) {
  if (!unixSeconds) return '--:--'
  return new Date(unixSeconds * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string, timezone?: string | null) {
  return formatEventDateTime(iso, timezone)
}

interface Participant { id: number; name: string; avatar: string | null }

interface MarkerDisplay {
  event: EventPin
  angle: number
  zIndex: number
  delayMs: number
  icon: L.DivIcon
}

function getBouquetAngle(index: number, total: number): number {
  if (total <= 1) return 0
  const maxSpread = total <= 3 ? 28 : 42
  const step = Math.min(24, (maxSpread * 2) / Math.max(1, total - 1))
  return (index - (total - 1) / 2) * step
}

function getNearbyMarkerGroups(events: EventPin[]): EventPin[][] {
  const remaining = [...events].sort((a, b) => a.id - b.id)
  const groups: EventPin[][] = []
  const closeKm = 0.9

  while (remaining.length > 0) {
    const seed = remaining.shift()
    if (!seed) break

    const group = [seed]
    for (let i = remaining.length - 1; i >= 0; i -= 1) {
      const candidate = remaining[i]
      const isClose = group.some(event =>
        getDistanceKm(
          event.location.lat,
          event.location.lng,
          candidate.location.lat,
          candidate.location.lng,
        ) <= closeKm
      )
      if (isClose) {
        group.push(candidate)
        remaining.splice(i, 1)
      }
    }
    groups.push(group.sort((a, b) => a.id - b.id))
  }

  return groups
}

export default function HubMap() {
  const { user }   = useAuthStore()
  const router     = useRouter()
  const [events,   setEvents]       = useState<EventPin[]>([])
  const [joinedEvents, setJoinedEvents] = useState<EventPin[]>([])
  const [myEvents, setMyEvents] = useState<EventPin[]>([])
  const [selected, setSelected]     = useState<EventPin | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [ready,    setReady]        = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [radiusIndex, setRadiusIndex] = useState(0)
  const [goingOnly, setGoingOnly] = useState(false)
  const [friendsOnly, setFriendsOnly] = useState(false)
  const [myOnly, setMyOnly] = useState(false)
  const [friendIds, setFriendIds] = useState<Set<number>>(new Set())
  const [recenterKey, setRecenterKey] = useState(0)
  const [hubWeather, setHubWeather] = useState<EventWeather | null>(null)
  const [rainForecast, setRainForecast] = useState<RainForecast | null>(null)
  const [dailyForecast, setDailyForecast] = useState<DailyForecastDay[] | null>(null)
  const [showForecast, setShowForecast] = useState(true)
  const [showWindOverlay, setShowWindOverlay] = useState(true)
  const [showCloudOverlay, setShowCloudOverlay] = useState(false)
  const [isMapInteracting, setIsMapInteracting] = useState(false)
  const [weatherRefreshTick, setWeatherRefreshTick] = useState(0)
  const [gpxStats, setGpxStats] = useState<Record<number, GpxActivityStats>>({})
  const [radarFrames, setRadarFrames] = useState<RadarFrame[]>([])
  const [radarNowIndex, setRadarNowIndex] = useState(0)
  const [radarIndex, setRadarIndex] = useState(0)
  const radarUserScrubbed = useRef(false)
  const weatherRequestId = useRef(0)

  const lat      = (user?.location?.lat  || user?.home?.lat  || null)
  const lng      = (user?.location?.lng  || user?.home?.lng  || null)
  const [weatherCenter, setWeatherCenter] = useState<{ lat: number; lng: number } | null>(
    (lat && lng) ? { lat, lng } : null
  )
  const baseRadiusKm = user?.radius_km ?? 50
  const radiusKm = RADIUS_OPTIONS[radiusIndex]?.km ?? null

  useEffect(() => {
    setSelectedCategories(new Set(user?.categories ?? []))
    const initialIndex = baseRadiusKm >= 9999
      ? RADIUS_OPTIONS.length - 1
      : RADIUS_OPTIONS.findIndex(r => r.km === baseRadiusKm)
    setRadiusIndex(initialIndex >= 0 ? initialIndex : 0)
  }, [user?.categories, baseRadiusKm])

  useEffect(() => {
    if (lat && lng) {
      setWeatherCenter({ lat, lng })
    }
  }, [lat, lng])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setWeatherRefreshTick((tick) => tick + 1)
    }, 15 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    let cancelled = false
    function refresh() {
      fetchRadarFrames().then((result) => {
        if (cancelled || !result) return
        setRadarFrames(result.frames)
        setRadarNowIndex(result.nowIndex)
        if (!radarUserScrubbed.current) setRadarIndex(result.nowIndex)
      }).catch(() => {})
    }
    refresh()
    const interval = window.setInterval(refresh, 5 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const params: Record<string, unknown> = {}
    params.per_page = 100
    const hasCoords = Boolean(lat && lng && radiusKm !== null)
    if (hasCoords) {
      params.lat = lat
      params.lng = lng
      params.radius_km = radiusKm
    }
    if (friendsOnly) {
      params.friends_only = 1
    }
    api.get('/events', { params })
      .then(({ data }) => {
        setEvents(data.data ?? [])
      })
      .catch(() => {})
      .finally(() => setReady(true))
  }, [lat, lng, radiusKm, friendsOnly])

  useEffect(() => {
    const targets = events.filter((event) => event.activity.gpx_url)

    if (targets.length === 0) {
      setGpxStats({})
      return
    }

    let cancelled = false

    Promise.all(
      targets.map(async (event) => ({
        id: event.id,
        stats: await fetchGpxActivityStats(event.activity.gpx_url!).catch(() => null),
      })),
    ).then((entries) => {
      if (cancelled) return
      const next: Record<number, GpxActivityStats> = {}
      for (const entry of entries) {
        if (entry.stats) next[entry.id] = entry.stats
      }
      setGpxStats(next)
    }).catch(() => {
      if (!cancelled) setGpxStats({})
    })

    return () => {
      cancelled = true
    }
  }, [events])

  useEffect(() => {
    if (selected?.location?.lat != null && selected.location.lng != null) {
      weatherRequestId.current += 1
      const requestId = weatherRequestId.current
      let cancelled = false

      fetchRelevantEventWeather(
        selected.location.lat,
        selected.location.lng,
        selected.schedule.start_at,
        selected.schedule.timezone,
      )
        .then((weather) => {
          if (cancelled || requestId !== weatherRequestId.current) return
          setHubWeather(weather)
        })
        .catch(() => {
          if (!cancelled && requestId === weatherRequestId.current) setHubWeather(null)
        })

      return () => {
        cancelled = true
      }
    }

    if (!weatherCenter) {
      setHubWeather(null)
      return
    }

    weatherRequestId.current += 1
    const requestId = weatherRequestId.current
    let cancelled = false

    fetchCurrentWeather(weatherCenter.lat, weatherCenter.lng)
      .then((weather) => {
        if (cancelled || requestId !== weatherRequestId.current) return
        setHubWeather(weather)
      })
      .catch(() => {
        if (!cancelled && requestId === weatherRequestId.current) setHubWeather(null)
      })

    return () => {
      cancelled = true
    }
  }, [
    selected?.id,
    selected?.location?.lat,
    selected?.location?.lng,
    selected?.schedule?.start_at,
    selected?.schedule?.timezone,
    weatherCenter,
    weatherRefreshTick,
  ])

  useEffect(() => {
    if (!weatherCenter) {
      setRainForecast(null)
      return
    }
    let cancelled = false
    fetchRainForecast(weatherCenter.lat, weatherCenter.lng)
      .then((forecast) => {
        if (!cancelled) setRainForecast(forecast)
      })
      .catch(() => {
        if (!cancelled) setRainForecast(null)
      })
    return () => {
      cancelled = true
    }
  }, [weatherCenter, weatherRefreshTick])

  useEffect(() => {
    if (!weatherCenter) {
      setDailyForecast(null)
      return
    }
    let cancelled = false
    fetchDailyForecast(weatherCenter.lat, weatherCenter.lng)
      .then((forecast) => {
        if (!cancelled) setDailyForecast(forecast)
      })
      .catch(() => {
        if (!cancelled) setDailyForecast(null)
      })
    return () => {
      cancelled = true
    }
  }, [weatherCenter, weatherRefreshTick])

  useEffect(() => {
    api.get('/events/joined')
      .then(({ data }) => setJoinedEvents(data.data ?? []))
      .catch(() => setJoinedEvents([]))
  }, [])

  useEffect(() => {
    api.get('/events/my')
      .then(({ data }) => setMyEvents(data.data ?? []))
      .catch(() => setMyEvents([]))
  }, [])

  useEffect(() => {
    api.get('/users', { params: { friends_only: 1 } })
      .then(({ data }) => {
        const ids = (data.data ?? []).map((friend: { id: number }) => friend.id)
        setFriendIds(new Set(ids))
      })
      .catch(() => setFriendIds(new Set()))
  }, [])

  useEffect(() => {
    if (!selected) { setParticipants([]); return }
    api.get(`/events/${selected.id}`)
      .then(({ data }) => setParticipants(data.data.participants ?? []))
      .catch(() => {})
  }, [selected])

  const mapCenter: [number, number] = (lat && lng) ? [lat, lng] : [44.5, 16.5]
  const categoryCount = selectedCategories.size
  const selectedRadarFrame = radarFrames[radarIndex]
  const hubHasCloudLayer = Boolean(hubWeather && hubWeather.code > 0)
  const showWeatherLayers = !isMapInteracting
  const selectedActivityDistanceKm = selected
    ? gpxStats[selected.id]?.distanceKm ?? selected.activity.distance_km
    : null
  const selectedActivityElevationGain = selected
    ? gpxStats[selected.id]?.elevationGain ?? selected.activity.elevation_gain
    : null

  const visibleEvents = useMemo(() => {
    const specialMode = goingOnly || friendsOnly || myOnly
    const source = myOnly ? myEvents : goingOnly ? joinedEvents : events
    const filtered = source.filter(ev => {
      if (friendsOnly && (!ev.organizer?.id || !friendIds.has(ev.organizer.id))) return false
      if (specialMode) return true
      if (selectedCategories.size > 0 && !selectedCategories.has(ev.category.value)) return false
      if (radiusKm !== null && lat && lng) {
        return getDistanceKm(lat, lng, ev.location.lat, ev.location.lng) <= radiusKm
      }
      return true
    })
    return sortEventsBySchedule(filtered)
  }, [events, joinedEvents, myEvents, goingOnly, friendsOnly, myOnly, friendIds, selectedCategories, radiusKm, lat, lng])

  const markerDisplays = useMemo<MarkerDisplay[]>(() => {
    return getNearbyMarkerGroups(visibleEvents).flatMap(group =>
      group.map((event, index) => ({
        event,
        angle: getBouquetAngle(index, group.length),
        zIndex: 1000 + index,
        delayMs: index * 55,
        icon: createEmojiIcon(
          CATEGORY_EMOJI[event.category.value] ?? '📍',
          getBouquetAngle(index, group.length),
          1000 + index,
          index * 55,
          event.status === 'cancelled',
        ),
      }))
    )
  }, [visibleEvents])

  useEffect(() => {
    setSelected(current => current && visibleEvents.some(ev => ev.id === current.id) ? current : null)
    setRecenterKey(key => key + 1)
  }, [visibleEvents])

  function toggleCategory(value: string) {
    setSelectedCategories(prev => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const handleWeatherCenterChange = useCallback((center: { lat: number; lng: number }) => {
    setWeatherCenter((current) => {
      if (current && Math.abs(current.lat - center.lat) < 0.0001 && Math.abs(current.lng - center.lng) < 0.0001) {
        return current
      }
      return center
    })
  }, [])

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <style>{`
        @keyframes fm-marker-bloom {
          0% {
            opacity: 0.45;
            transform: translateY(10px) scale(0.08);
          }
          58% {
            opacity: 1;
            transform: translateY(0) scale(1.04);
          }
          76% {
            transform: translateX(-1px) rotate(1.1deg) scale(0.98);
          }
          88% {
            transform: translateX(1px) rotate(-1deg) scale(1.02);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .fitmeet-hub-map .leaflet-bottom.leaflet-left .leaflet-control-zoom {
          margin-bottom: 96px;
          z-index: 650;
        }

        .fitmeet-hub-map .leaflet-control-attribution {
          display: none;
        }

        @media (max-width: 767px) {
          .fitmeet-hub-map .leaflet-bottom.leaflet-left .leaflet-control-zoom {
            margin-bottom: 168px;
          }
        }

        .fitmeet-hub-map .fm-precip-tile-layer {
          filter: brightness(1.15) contrast(1.25) saturate(1.5);
          mix-blend-mode: screen;
        }

        @keyframes fm-lightning-flash {
          0%, 90% { opacity: 0; transform: scale(0.6); }
          91%     { opacity: 1; transform: scale(1.2); }
          93%     { opacity: 0.15; transform: scale(0.85); }
          94.5%   { opacity: 1; transform: scale(1.25); }
          97%     { opacity: 0; transform: scale(0.6); }
          100%    { opacity: 0; transform: scale(0.6); }
        }

        .fm-lightning-bolt {
          position: absolute;
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(255,244,160,0.98), rgba(255,214,64,0.6) 55%, transparent 100%);
          box-shadow: 0 0 18px 7px rgba(255,214,64,0.55);
          opacity: 0;
          animation-name: fm-lightning-flash;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
      `}</style>

      <MapContainer
        className="fitmeet-hub-map"
        center={mapCenter}
        zoom={11}
        maxZoom={BASE_MAX_ZOOM}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {showWeatherLayers && showCloudOverlay && selectedRadarFrame && (
          <TileLayer
            url={`https://tilecache.rainviewer.com${selectedRadarFrame.path}/512/{z}/{x}/{y}/2/1_1.png`}
            opacity={0.85}
            zIndex={221}
            maxZoom={BASE_MAX_ZOOM}
            maxNativeZoom={RADAR_MAX_ZOOM}
            className="fm-precip-tile-layer"
          />
        )}
        <ZoomControl position="bottomleft" />
        <MapViewport
          events={visibleEvents}
          lat={lat}
          lng={lng}
          radiusKm={radiusKm}
          ready={ready}
          recenterKey={recenterKey}
        />
        <HubWeatherSync
          onCenterChange={handleWeatherCenterChange}
          onInteractionChange={setIsMapInteracting}
        />

        <Pane name="fitmeet-event-markers" style={{ zIndex: 900 }}>
          {markerDisplays.map(({ event: ev, zIndex, icon }) => (
            <Marker
              key={ev.id}
              pane="fitmeet-event-markers"
              position={[ev.location.lat, ev.location.lng]}
              icon={icon}
              zIndexOffset={zIndex}
              eventHandlers={{ click: () => setSelected(ev) }}
            />
          ))}
        </Pane>
      </MapContainer>
      {showWeatherLayers && (
        <WindOverlay
          weather={hubWeather}
          variant="hub"
          showWind={showWindOverlay}
          showClouds={false}
          showBadge={false}
        />
      )}
      {showWeatherLayers && showCloudOverlay && hubWeather && hubWeather.code >= 95 && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 501 }}>
          {LIGHTNING_POSITIONS.map((pos, i) => (
            <span
              key={i}
              className="fm-lightning-bolt"
              style={{
                left: pos.left,
                top: pos.top,
                animationDelay: `${i * 0.6}s`,
                animationDuration: `${2.6 + (i % 3) * 0.6}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Filters */}
      <div
        className="absolute top-0 left-0 right-0 z-[700] pointer-events-none flex flex-col gap-2 px-0 md:top-3 md:left-3 md:right-3 md:px-0 md:flex-row md:items-stretch md:gap-3"
      >
        <div
          className="hub-top-filter-shell min-w-0 pointer-events-auto mx-0 md:mx-0"
          style={{
            flex: 1,
            border: '1px solid var(--border)',
            background: 'color-mix(in srgb, var(--surface) 74%, transparent)',
            borderRadius: 14,
            padding: '8px 10px',
            boxShadow: '0 6px 22px rgba(0,0,0,0.35)',
          }}
        >
          <div className="filter-chip-scroll items-center md:gap-2" aria-label="Interest filters">
            <button
              type="button"
              onClick={() => setSelectedCategories(new Set())}
              className="text-[11px] px-2.5 py-1.5 rounded-full border font-semibold transition-colors md:text-xs md:px-3"
              style={{
                borderColor: categoryCount === 0 ? 'var(--primary)' : 'var(--border)',
                color: categoryCount === 0 ? 'var(--primary)' : 'var(--text-muted)',
                background: categoryCount === 0 ? 'rgba(57,255,20,0.1)' : 'var(--background)',
              }}
            >
              All interests
            </button>
            {CATEGORIES.map(c => {
              const active = selectedCategories.has(c.value)
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => toggleCategory(c.value)}
                  className="text-[11px] px-2.5 py-1.5 rounded-full border font-semibold transition-colors md:text-xs md:px-3"
                  style={{
                    borderColor: active ? 'var(--primary)' : 'var(--border)',
                    color: active ? 'var(--primary)' : 'var(--text-muted)',
                    background: active ? 'rgba(57,255,20,0.1)' : 'var(--background)',
                  }}
                >
                  {c.emoji} {c.label}
                </button>
              )
            })}
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[minmax(150px,1fr)_auto_auto] md:items-center md:gap-2.5">
            <label style={{ minWidth: 0 }} className="order-1">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Radius</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>
                    {RADIUS_OPTIONS[radiusIndex]?.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRecenterKey(key => key + 1)}
                    title="Recenter"
                    aria-label="Recenter map"
                    className="inline-flex h-7 w-7 min-w-7 items-center justify-center rounded-full border"
                    style={{
                      borderColor: 'var(--border)',
                      background: 'var(--background)',
                      color: 'var(--primary)',
                      cursor: 'pointer',
                    }}
                  >
                    <LocateFixed size={14} />
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={RADIUS_OPTIONS.length - 1}
                step={1}
                value={radiusIndex}
                onChange={e => setRadiusIndex(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#39FF14', display: 'block' }}
              />
            </label>

            <div className="order-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setGoingOnly(v => !v)}
                className="inline-flex flex-none items-center justify-center gap-1 text-[11px] px-2.5 py-2 rounded-full border font-semibold transition-colors md:text-xs md:px-3"
                style={{
                  borderColor: goingOnly ? 'var(--primary)' : 'var(--border)',
                  color: goingOnly ? 'var(--primary)' : 'var(--text-muted)',
                  background: goingOnly ? 'rgba(57,255,20,0.1)' : 'var(--background)',
                  whiteSpace: 'nowrap',
                }}
              >
                <Check size={12} /> Going
              </button>
              <button
                type="button"
                onClick={() => setFriendsOnly(v => !v)}
                className="inline-flex flex-none items-center justify-center gap-1.5 text-[11px] px-3 py-2 rounded-full border font-semibold transition-colors md:text-xs"
                style={{
                  borderColor: friendsOnly ? 'var(--primary)' : 'var(--border)',
                  color: friendsOnly ? 'var(--primary)' : 'var(--text-muted)',
                  background: friendsOnly ? 'rgba(57,255,20,0.1)' : 'var(--background)',
                  whiteSpace: 'nowrap',
                }}
              >
                <Users size={13} /> Friends
              </button>
              <button
                type="button"
                onClick={() => setMyOnly(v => !v)}
                className="inline-flex flex-none items-center justify-center gap-1.5 text-[11px] px-3 py-2 rounded-full border font-semibold transition-colors md:text-xs"
                style={{
                  borderColor: myOnly ? 'var(--primary)' : 'var(--border)',
                  color: myOnly ? 'var(--primary)' : 'var(--text-muted)',
                  background: myOnly ? 'rgba(57,255,20,0.1)' : 'var(--background)',
                  whiteSpace: 'nowrap',
                }}
              >
                My
              </button>
            </div>
          </div>
        </div>

      </div>

      <div
        className="hub-bottom-stack absolute bottom-0 left-1/2 z-[690] pointer-events-none flex -translate-x-1/2 flex-col items-stretch gap-2"
        style={{
          width: '100vw',
          maxWidth: '100%',
          paddingBottom: 'calc(6px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {dailyForecast && dailyForecast.length > 0 && (
          showForecast ? (
            <div
              className="hub-forecast-shell pointer-events-auto rounded-2xl mx-2 md:mx-0"
              style={{
                position: 'relative',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(7,11,24,0.72)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 10px 24px rgba(0,0,0,0.28)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 4,
                padding: '10px 8px',
              }}
            >
              <button
                type="button"
                onClick={() => setShowForecast(false)}
                aria-label="Hide 5-day forecast"
                title="Hide forecast"
                className="inline-flex items-center justify-center rounded-full"
                style={{
                  position: 'absolute',
                  top: -10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 22,
                  height: 22,
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'rgba(7,11,24,0.9)',
                  color: '#d7dfef',
                }}
              >
                <ChevronDown size={13} />
              </button>
              {dailyForecast.map((day, i) => {
                const Icon = FORECAST_ICONS[weatherIcon(day.code)] ?? Cloud
                return (
                  <div key={day.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#9aa5c4', textTransform: 'uppercase' }}>
                      {i === 0 ? 'Today' : new Date(`${day.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' })}
                    </span>
                    <Icon size={20} color="#f5f7ff" />
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#f5f7ff', whiteSpace: 'nowrap' }}>
                      {day.tempMax}°<span style={{ color: '#9aa5c4', fontWeight: 600 }}> /{day.tempMin}°</span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      <ArrowUp size={10} color="#f5f7ff" style={{ transform: `rotate(${(day.windDir + 180) % 360}deg)` }} />
                      <span style={{ fontSize: 10, color: '#9aa5c4', fontWeight: 600, whiteSpace: 'nowrap' }}>{day.windSpeed}km/h</span>
                    </span>
                    {day.humidity != null && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, color: '#58beff', fontWeight: 600 }}>
                        <Droplets size={10} /> {day.humidity}%
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowForecast(true)}
              className="hub-forecast-pill pointer-events-auto mx-auto inline-flex items-center gap-1.5 rounded-full text-[11px] font-semibold"
              style={{
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(7,11,24,0.72)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 10px 24px rgba(0,0,0,0.28)',
                color: '#d7dfef',
                padding: '5px 14px',
              }}
            >
              <ChevronUp size={13} />
              5-day forecast
            </button>
          )
        )}

      <div
        className="hub-weather-footer-shell pointer-events-auto rounded-t-[18px] rounded-b-none px-2 py-1.5 md:rounded-full md:px-[10px] md:py-2"
        style={{
          border: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(7,11,24,0.62)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 10px 24px rgba(0,0,0,0.28)',
        }}
      >
        {showCloudOverlay && radarFrames.length > 1 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 6,
              padding: '0 2px',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: '#d7dfef', minWidth: 38, flexShrink: 0 }}>
              {formatFrameTime(selectedRadarFrame?.time)}
            </span>
            <input
              type="range"
              min={0}
              max={radarFrames.length - 1}
              step={1}
              value={radarIndex}
              onChange={(e) => {
                radarUserScrubbed.current = true
                setRadarIndex(Number(e.target.value))
              }}
              style={{
                flex: 1,
                accentColor: radarIndex < radarNowIndex ? '#58beff' : radarIndex === radarNowIndex ? '#39FF14' : '#f4d35e',
              }}
            />
            <button
              type="button"
              onClick={() => {
                radarUserScrubbed.current = false
                setRadarIndex(radarNowIndex)
              }}
              className="inline-flex flex-none items-center justify-center text-[10px] px-2.5 py-1 rounded-full border font-semibold transition-colors"
              style={{
                borderColor: radarIndex === radarNowIndex ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                color: radarIndex === radarNowIndex ? 'var(--primary)' : 'var(--text-muted)',
                background: radarIndex === radarNowIndex ? 'rgba(57,255,20,0.1)' : 'rgba(255,255,255,0.03)',
                whiteSpace: 'nowrap',
              }}
            >
              Now
            </button>
          </div>
        )}
        <div
          className="hub-weather-footer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setShowWindOverlay(v => !v)}
              className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-full border font-semibold transition-colors md:text-xs md:px-3"
              style={{
                borderColor: showWindOverlay ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                color: showWindOverlay ? 'var(--primary)' : 'var(--text-muted)',
                background: showWindOverlay ? 'rgba(57,255,20,0.1)' : 'rgba(255,255,255,0.03)',
                whiteSpace: 'nowrap',
              }}
            >
              <Wind size={13} />
              <span>Wind</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCloudOverlay(v => !v)}
              className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-full border font-semibold transition-colors md:text-xs md:px-3"
              style={{
                borderColor: showCloudOverlay ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                color: showCloudOverlay ? 'var(--primary)' : 'var(--text-muted)',
                background: showCloudOverlay ? 'rgba(57,255,20,0.1)' : 'rgba(255,255,255,0.03)',
                whiteSpace: 'nowrap',
              }}
              title="Toggle rain radar overlay"
            >
              <CloudRain size={13} />
              <span>Rain</span>
            </button>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              color: '#d7dfef',
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflowX: 'auto',
              scrollbarWidth: 'none',
            }}
          >
            {hubWeather && (
              <>
                <span>{hubWeather.tempCurrent ?? hubWeather.tempMax}°</span>
                <span
                  style={{
                    width: 1,
                    height: 12,
                    background: 'rgba(255,255,255,0.16)',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    flexShrink: 0,
                  }}
                >
                  <span>{hubWeather.windSpeed} km/h</span>
                  <span style={{ color: '#58beff' }}>{windDirectionLabelDetailed(hubWeather.windDir)}</span>
                </span>
                <span
                  style={{
                    width: 1,
                    height: 12,
                    background: 'rgba(255,255,255,0.16)',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    flexShrink: 0,
                    color: '#f4d35e',
                  }}
                >
                  <SunMedium size={13} />
                  <span>UV {hubWeather.uvIndex ?? '—'}</span>
                </span>
                <span
                  style={{
                    width: 1,
                    height: 12,
                    background: 'rgba(255,255,255,0.16)',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    color: hubHasCloudLayer ? '#d7dfef' : 'var(--text-muted)',
                    flexShrink: 0,
                  }}
                >
                  {hubWeather ? weatherConditionLabel(hubWeather.code, hubWeather.precipitation) : 'Clear sky'}
                </span>
                {rainForecast?.minutesUntilRain != null && (
                  <>
                    <span
                      style={{
                        width: 1,
                        height: 12,
                        background: 'rgba(255,255,255,0.16)',
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        flexShrink: 0,
                        color: '#58beff',
                      }}
                    >
                      <CloudRain size={13} />
                      <span>{rainForecast.minutesUntilRain <= 1 ? 'Rain now' : `Rain in ${rainForecast.minutesUntilRain}m`}</span>
                    </span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        <style>{`
          @media (max-width: 767px) {
            .hub-weather-footer-shell,
            .hub-top-filter-shell {
              border-radius: 0 !important;
            }
            .hub-weather-footer-shell {
              border-left: 0 !important;
              border-right: 0 !important;
              border-bottom: 0 !important;
            }
            .hub-top-filter-shell {
              border-left: 0 !important;
              border-right: 0 !important;
              border-top: 0 !important;
            }
            .hub-weather-footer {
              gap: 8px !important;
            }
          }
          @media (min-width: 768px) {
            .hub-bottom-stack {
              width: min(calc(100vw - 24px), 760px) !important;
            }
          }
        `}</style>
      </div>
      </div>
      {/* Empty state */}
      {ready && visibleEvents.length === 0 && !selected && (
        <div style={{
          position: 'absolute', top: 118, left: '50%', transform: 'translateX(-50%)',
          zIndex: 600, pointerEvents: 'none',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '8px 16px',
          fontSize: 13, color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
        }}>
          {goingOnly ? "No joined events match these filters" : myOnly ? 'No created events match these filters' : 'No events match these filters'}
        </div>
      )}

      {/* Bottom card */}
      {selected && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000,
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          borderRadius: '18px 18px 0 0',
          padding: '20px 16px 24px',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.45)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            {selected.image_url ? (
              <img
                src={selected.image_url}
                alt={selected.title}
                style={{
                  width: 82,
                  height: 82,
                  borderRadius: 14,
                  objectFit: 'cover',
                  flexShrink: 0,
                  border: '1px solid var(--border)',
                }}
              />
            ) : null}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  fontSize: 11, padding: '2px 10px', borderRadius: 999,
                  border: '1px solid var(--primary)', color: 'var(--primary)',
                  background: 'rgba(57,255,20,0.08)', fontWeight: 600,
                }}>
                  {CATEGORY_EMOJI[selected.category.value] ?? '📍'} {selected.category.label}
                </span>
                {selected.status === 'cancelled' && (
                  <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>Cancelled</span>
                )}
                {selected.is_full && (
                  <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>Full</span>
                )}
                {eventTiming(selected).inProgress && (
                  <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>In progress</span>
                )}
                {eventTiming(selected).past && (
                  <span style={{ fontSize: 11, color: 'var(--secondary)', fontWeight: 600 }}>Past</span>
                )}
              </div>
              <h3 style={{ fontWeight: 700, fontSize: 17, marginBottom: 6, lineHeight: 1.3 }}>
                {selected.title}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                  <Calendar size={12} />
                  {formatDate(selected.schedule.start_at, selected.schedule.timezone)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                  <Users size={12} />
                  {selected.participants_count} joined
                  {selected.max_participants ? ` · max ${selected.max_participants}` : ''}
                </div>
                {participants.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4, marginLeft: 18 }}>
                    {participants.map(p => (
                      <div key={p.id} style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        fontSize: 11, color: 'var(--text-primary)',
                        background: 'var(--background)', border: '1px solid var(--border)',
                        borderRadius: 999, padding: '2px 8px 2px 3px',
                      }}>
                        {p.avatar ? (
                          <img src={p.avatar} alt={p.name} width={16} height={16}
                            style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{
                            width: 16, height: 16, borderRadius: '50%',
                            background: 'var(--primary)', color: '#000',
                            fontSize: 9, fontWeight: 700, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>{p.name.charAt(0).toUpperCase()}</div>
                        )}
                        {p.name}
                      </div>
                    ))}
                  </div>
                )}
                {(selectedActivityDistanceKm != null || selectedActivityElevationGain != null) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                    <Zap size={12} style={{ color: 'var(--primary)' }} />
                    {[
                      selectedActivityDistanceKm != null && `${selectedActivityDistanceKm} km`,
                      selectedActivityElevationGain != null && `↑${selectedActivityElevationGain} m`,
                    ].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: 4, marginTop: -2,
              }}
            >
              <X size={20} />
            </button>
          </div>

            <WeatherBadge
              lat={selected.location.lat}
              lng={selected.location.lng}
              startAt={selected.schedule.start_at}
              timezone={selected.schedule.timezone}
            />

            <EventCommentsPreview eventId={selected.id} count={selected.comments_count ?? 0} />

            <button
              onClick={() => router.push(`/events/view?id=${selected.id}`)}
            style={{
              width: '100%', padding: '12px',
              background: selected.status === 'cancelled' ? '#f87171' : '#39FF14', color: '#000',
              border: 'none', borderRadius: 12,
              fontWeight: 700, fontSize: 15,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: 8,
            }}
          >
            {selected.status === 'cancelled' ? 'View Cancelled Event' : 'View & Join'} <ArrowRight size={15} />
          </button>
        </div>
      )}

    </div>
  )
}
