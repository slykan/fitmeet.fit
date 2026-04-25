'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, ZoomControl, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useRouter } from 'next/navigation'
import { Calendar, ArrowRight, X, Users, Zap, LocateFixed, Check } from 'lucide-react'
import api from '@/lib/api'
import { formatEventDateTime } from '@/lib/event-time'
import { useAuthStore } from '@/store/auth'
import { CATEGORIES, CATEGORY_EMOJI } from '@/lib/categories'
import { WeatherBadge } from '@/components/WeatherBadge'

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
  category: { value: string; label: string }
  location: { lat: number; lng: number; address: string | null }
  schedule: { start_at: string; timezone: string }
  activity: { distance_km: number | null; elevation_gain: number | null }
  participants_count: number
  max_participants: number | null
  status: string
  is_full: boolean
  is_joined: boolean
  is_organizer: boolean
  organizer: { id: number; name: string } | null
}

function createEmojiIcon(emoji: string, angle = 0, zIndex = 1, delayMs = 0, cancelled = false) {
  const offsetPx = Math.round(Math.sin(angle * Math.PI / 180) * 30)
  const stemHeight = 40 + Math.round(Math.abs(angle) * 0.22)
  const accent = cancelled ? '#f87171' : '#39FF14'
  const secondary = cancelled ? '#7f1d1d' : '#0ea5e9'

  return L.divIcon({
    html: `<div style="
      position:relative;
      width:78px;
      height:82px;
      z-index:${zIndex};
      cursor:pointer;
    ">
      <div style="
        position:absolute;
        inset:0;
        transform-origin:50% calc(100% - 3px);
        animation:fm-marker-bloom 620ms cubic-bezier(.2,.85,.2,1) ${delayMs}ms both;
      ">
      <div style="
        position:absolute;
        left:50%;
        bottom:8px;
        width:3px;
        height:${stemHeight}px;
        transform:translateX(-50%) rotate(${angle}deg);
        transform-origin:bottom center;
        border-radius:999px;
        background:linear-gradient(180deg,${accent},${secondary});
        box-shadow:0 0 10px ${cancelled ? 'rgba(248,113,113,0.35)' : 'rgba(57,255,20,0.35)'};
      "></div>
      <div style="
        position:absolute;
        left:calc(50% - 19px + ${offsetPx}px);
        top:${Math.max(2, 10 - Math.abs(angle) * 0.12)}px;
        width:38px;
        height:38px;
        background:#16161F;
        border:2.5px solid ${accent};
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:18px;
        transform:rotate(${angle * 0.18}deg);
        box-shadow:0 4px 14px rgba(0,0,0,0.65),0 0 16px ${cancelled ? 'rgba(248,113,113,0.22)' : 'rgba(57,255,20,0.22)'};
      ">${emoji}</div>
      <div style="
        position:absolute;
        left:50%;
        bottom:3px;
        width:8px;
        height:8px;
        transform:translateX(-50%);
        border-radius:50%;
        background:${accent};
        box-shadow:0 0 10px ${cancelled ? 'rgba(248,113,113,0.55)' : 'rgba(57,255,20,0.55)'};
      "></div>
      </div>
    </div>`,
    className: '',
    iconSize: [78, 82],
    iconAnchor: [39, 79],
  })
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

function formatDate(iso: string, timezone?: string | null) {
  return formatEventDateTime(iso, timezone)
}

interface Participant { id: number; name: string; avatar: string | null }

interface MarkerDisplay {
  event: EventPin
  angle: number
  zIndex: number
  delayMs: number
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
  const [radar,    setRadar]        = useState(true)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [radiusIndex, setRadiusIndex] = useState(0)
  const [goingOnly, setGoingOnly] = useState(false)
  const [friendsOnly, setFriendsOnly] = useState(false)
  const [myOnly, setMyOnly] = useState(false)
  const [friendIds, setFriendIds] = useState<Set<number>>(new Set())
  const [recenterKey, setRecenterKey] = useState(0)

  const lat      = (user?.location?.lat  || user?.home?.lat  || null)
  const lng      = (user?.location?.lng  || user?.home?.lng  || null)
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
    const params: Record<string, unknown> = {}
    const hasCoords = Boolean(lat && lng)
    if (hasCoords) {
      params.lat = lat
      params.lng = lng
      params.radius_km = 500
    }
    if (friendsOnly) {
      params.friends_only = 1
    }
    api.get('/events', { params })
      .then(({ data }) => {
        const events = data.data ?? []
        if (events.length === 0 && hasCoords && !friendsOnly) {
          // Location filter returned nothing — fall back to all events
          return api.get('/events').then(({ data: d }) => setEvents(d.data ?? []))
        }
        setEvents(events)
      })
      .catch(() => {})
      .finally(() => setReady(true))

    const t = setTimeout(() => setRadar(false), 5200)
    return () => clearTimeout(t)
  }, [lat, lng, friendsOnly])

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

  const visibleEvents = useMemo(() => {
    const source = myOnly && !goingOnly ? myEvents : goingOnly ? joinedEvents : events
    return source.filter(ev => {
      if (myOnly && !ev.is_organizer) return false
      if (friendsOnly && (!ev.organizer?.id || !friendIds.has(ev.organizer.id))) return false
      if (selectedCategories.size > 0 && !selectedCategories.has(ev.category.value)) return false
      if (radiusKm !== null && lat && lng) {
        return getDistanceKm(lat, lng, ev.location.lat, ev.location.lng) <= radiusKm
      }
      return true
    })
  }, [events, joinedEvents, myEvents, goingOnly, friendsOnly, myOnly, friendIds, selectedCategories, radiusKm, lat, lng])

  const markerDisplays = useMemo<MarkerDisplay[]>(() => {
    return getNearbyMarkerGroups(visibleEvents).flatMap(group =>
      group.map((event, index) => ({
        event,
        angle: getBouquetAngle(index, group.length),
        zIndex: 1000 + index,
        delayMs: index * 55,
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
      `}</style>

      <MapContainer
        center={mapCenter}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <ZoomControl position="bottomleft" />
        <MapViewport
          events={visibleEvents}
          lat={lat}
          lng={lng}
          radiusKm={radiusKm}
          ready={ready}
          recenterKey={recenterKey}
        />

        {markerDisplays.map(({ event: ev, angle, zIndex, delayMs }) => (
          <Marker
            key={ev.id}
            position={[ev.location.lat, ev.location.lng]}
            icon={createEmojiIcon(CATEGORY_EMOJI[ev.category.value] ?? '📍', angle, zIndex, delayMs, ev.status === 'cancelled')}
            zIndexOffset={zIndex}
            eventHandlers={{ click: () => setSelected(ev) }}
          />
        ))}
      </MapContainer>

      {/* Filters */}
      <div
        className="absolute top-3 left-3 right-3 z-[700] pointer-events-none flex flex-col gap-2 md:flex-row md:items-stretch md:gap-3"
      >
        <div
          className="min-w-0 pointer-events-auto"
          style={{
            flex: 1,
            border: '1px solid var(--border)',
            background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
            borderRadius: 14,
            padding: '8px 10px',
            boxShadow: '0 6px 22px rgba(0,0,0,0.35)',
          }}
        >
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide md:gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategories(new Set())}
              className="flex-shrink-0 text-[11px] px-2.5 py-1.5 rounded-full border font-semibold transition-colors md:text-xs md:px-3"
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
                  className="flex-shrink-0 text-[11px] px-2.5 py-1.5 rounded-full border font-semibold transition-colors md:text-xs md:px-3"
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

            <div className="order-2 flex items-center gap-2 md:contents">
              <button
                type="button"
                onClick={() => setGoingOnly(v => !v)}
                className="inline-flex flex-1 items-center justify-center gap-1 text-[11px] px-2.5 py-2 rounded-full border font-semibold transition-colors md:flex-none md:text-xs md:px-3"
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
                className="inline-flex flex-1 items-center justify-center gap-1.5 text-[11px] px-3 py-2 rounded-full border font-semibold transition-colors md:flex-none md:text-xs"
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
                className="inline-flex flex-1 items-center justify-center gap-1.5 text-[11px] px-3 py-2 rounded-full border font-semibold transition-colors md:flex-none md:text-xs"
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

      {/* Radar sweep */}
      {radar && (
        <>
          <style>{`
            @keyframes fm-radar-fade { 0% { opacity:1; } 100% { opacity:0; } }
          `}</style>
          <svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: '100vmin',
              height: '100vmin',
              transform: 'translate(-50%, -50%)',
              display: 'block',
              pointerEvents: 'none',
              zIndex: 500,
              overflow: 'visible',
              animation: 'fm-radar-fade 5s linear forwards',
            }}>
            <defs>
              <clipPath id="fm-clip">
                <circle cx="110" cy="110" r="100"/>
              </clipPath>
            </defs>

            <g clipPath="url(#fm-clip)">
              <circle cx="110" cy="110" r="100" fill="none" stroke="#00aaff" strokeOpacity="0.25" strokeWidth="2"/>
              <circle cx="110" cy="110" r="75"  fill="none" stroke="#00aaff" strokeOpacity="0.18"/>
              <circle cx="110" cy="110" r="50"  fill="none" stroke="#00aaff" strokeOpacity="0.18"/>
              <circle cx="110" cy="110" r="25"  fill="none" stroke="#00aaff" strokeOpacity="0.18"/>
              <line x1="10"  y1="110" x2="210" y2="110" stroke="#00aaff" strokeOpacity="0.15"/>
              <line x1="110" y1="10"  x2="110" y2="210" stroke="#00aaff" strokeOpacity="0.15"/>

              <g transform="translate(110 110)">
                <line x1="0" y1="0" x2="0" y2="-100"
                  stroke="#00aaff" strokeOpacity="0.65" strokeWidth="2" strokeLinecap="round">
                  <animateTransform attributeName="transform" type="rotate"
                    from="0" to="360" dur="3s" repeatCount="indefinite"/>
                </line>
              </g>

              <circle cx="110" cy="110" r="8" fill="none" stroke="#00aaff" strokeWidth="2">
                <animate attributeName="r"       from="8" to="95" dur="2.4s" repeatCount="indefinite"/>
                <animate attributeName="opacity" from="0.8" to="0" dur="2.4s" repeatCount="indefinite"/>
              </circle>
              <circle cx="110" cy="110" r="8" fill="none" stroke="#00aaff" strokeWidth="2">
                <animate attributeName="r"       from="8" to="95" dur="2.4s" begin="1.2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" from="0.8" to="0" dur="2.4s" begin="1.2s" repeatCount="indefinite"/>
              </circle>

              <circle cx="110" cy="110" r="5" fill="#00aaff">
                <animate attributeName="opacity" values="1;0.5;1" dur="1.2s" repeatCount="indefinite"/>
              </circle>
            </g>
          </svg>
        </>
      )}

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
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14 }}>
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
                {(selected.activity.distance_km || selected.activity.elevation_gain) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                    <Zap size={12} style={{ color: 'var(--primary)' }} />
                    {[
                      selected.activity.distance_km    && `${selected.activity.distance_km} km`,
                      selected.activity.elevation_gain && `↑${selected.activity.elevation_gain} m`,
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
