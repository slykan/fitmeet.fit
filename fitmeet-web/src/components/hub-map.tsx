'use client'

import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useRouter } from 'next/navigation'
import { Calendar, ArrowRight, X, Users, Zap } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { CATEGORY_EMOJI } from '@/lib/categories'

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
  schedule: { start_at: string }
  activity: { distance_km: number | null; elevation_gain: number | null }
  participants_count: number
  max_participants: number | null
  is_full: boolean
}

function createEmojiIcon(emoji: string) {
  return L.divIcon({
    html: `<div style="
      width:38px;height:38px;
      background:#16161F;
      border:2.5px solid #39FF14;
      border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:18px;
      box-shadow:0 2px 10px rgba(0,0,0,0.6);
      cursor:pointer;
    ">${emoji}</div>`,
    className: '',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
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

function AutoZoom({ events, lat, lng, radiusKm, ready }: {
  events: EventPin[]; lat: number | null; lng: number | null; radiusKm: number; ready: boolean
}) {
  const map  = useMap()
  const done = useRef(false)

  useEffect(() => {
    if (!ready || done.current) return
    done.current = true
    if (events.length > 0) {
      const pts: [number, number][] = events.map(e => [e.location.lat, e.location.lng])
      if (lat && lng) pts.push([lat, lng])
      map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], animate: true, duration: 1 })
    } else if (lat && lng) {
      map.setView([lat, lng], getZoomForRadius(radiusKm), { animate: true, duration: 1 })
    }
  }, [ready, map, events, lat, lng, radiusKm])

  return null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

interface Participant { id: number; name: string; avatar: string | null }

export default function HubMap() {
  const { user }   = useAuthStore()
  const router     = useRouter()
  const [events,   setEvents]       = useState<EventPin[]>([])
  const [selected, setSelected]     = useState<EventPin | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [ready,    setReady]        = useState(false)
  const [radar,    setRadar]        = useState(true)

  const lat      = (user?.location?.lat  || user?.home?.lat  || null)
  const lng      = (user?.location?.lng  || user?.home?.lng  || null)
  const radiusKm = user?.radius_km ?? 50

  useEffect(() => {
    const params: Record<string, unknown> = {}
    const hasCoords = Boolean(lat && lng)
    if (hasCoords) {
      params.lat = lat
      params.lng = lng
      params.radius_km = radiusKm
    }
    api.get('/events', { params })
      .then(({ data }) => {
        const events = data.data ?? []
        if (events.length === 0 && hasCoords) {
          // Location filter returned nothing — fall back to all events
          return api.get('/events').then(({ data: d }) => setEvents(d.data ?? []))
        }
        setEvents(events)
      })
      .catch(() => {})
      .finally(() => setReady(true))

    const t = setTimeout(() => setRadar(false), 5200)
    return () => clearTimeout(t)
  }, [lat, lng, radiusKm])

  useEffect(() => {
    if (!selected) { setParticipants([]); return }
    api.get(`/events/${selected.id}`)
      .then(({ data }) => setParticipants(data.data.participants ?? []))
      .catch(() => {})
  }, [selected])

  const mapCenter: [number, number] = (lat && lng) ? [lat, lng] : [44.5, 16.5]

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>

      <MapContainer
        center={mapCenter}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
        zoomControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <AutoZoom events={events} lat={lat} lng={lng} radiusKm={radiusKm} ready={ready} />

        {events.map(ev => (
          <Marker
            key={ev.id}
            position={[ev.location.lat, ev.location.lng]}
            icon={createEmojiIcon(CATEGORY_EMOJI[ev.category.value] ?? '📍')}
            eventHandlers={{ click: () => setSelected(ev) }}
          />
        ))}
      </MapContainer>

      {/* Radar sweep */}
      {radar && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 500,
          background: '#060b14',
          animation: 'fm-radar-fade 5s linear forwards',
        }}>
          <style>{`
            @keyframes fm-radar-fade { 0% { opacity:1; } 100% { opacity:0; } }
          `}</style>
          <svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg"
            style={{ width: '100vmin', height: '100vmin', display: 'block' }}>
            <defs>
              <radialGradient id="fm-rg" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#00aaff" stopOpacity="0.9"/>
                <stop offset="40%"  stopColor="#00aaff" stopOpacity="0.25"/>
                <stop offset="100%" stopColor="#00aaff" stopOpacity="0"/>
              </radialGradient>
              <filter id="fm-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4"/>
              </filter>
              <clipPath id="fm-clip">
                <circle cx="110" cy="110" r="100"/>
              </clipPath>
            </defs>

            <circle cx="110" cy="110" r="100" fill="url(#fm-rg)"/>

            <g clipPath="url(#fm-clip)">
              <circle cx="110" cy="110" r="100" fill="rgba(0,170,255,0.04)" stroke="#00aaff" strokeOpacity="0.25" strokeWidth="2"/>
              <circle cx="110" cy="110" r="75"  fill="none" stroke="#00aaff" strokeOpacity="0.18"/>
              <circle cx="110" cy="110" r="50"  fill="none" stroke="#00aaff" strokeOpacity="0.18"/>
              <circle cx="110" cy="110" r="25"  fill="none" stroke="#00aaff" strokeOpacity="0.18"/>
              <line x1="10"  y1="110" x2="210" y2="110" stroke="#00aaff" strokeOpacity="0.15"/>
              <line x1="110" y1="10"  x2="110" y2="210" stroke="#00aaff" strokeOpacity="0.15"/>

              <g transform="translate(110 110)">
                <path d="M0,0 L0,-100 A100,100 0 0,1 38,-92 Z"
                  fill="#00aaff" fillOpacity="0.22" filter="url(#fm-glow)">
                  <animateTransform attributeName="transform" type="rotate"
                    from="0" to="360" dur="3s" repeatCount="indefinite"/>
                </path>
              </g>

              <circle cx="110" cy="110" r="8" fill="none" stroke="#00aaff" strokeWidth="2">
                <animate attributeName="r"       from="8" to="95" dur="2.4s" repeatCount="indefinite"/>
                <animate attributeName="opacity" from="0.8" to="0" dur="2.4s" repeatCount="indefinite"/>
              </circle>
              <circle cx="110" cy="110" r="8" fill="none" stroke="#00aaff" strokeWidth="2">
                <animate attributeName="r"       from="8" to="95" dur="2.4s" begin="1.2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" from="0.8" to="0" dur="2.4s" begin="1.2s" repeatCount="indefinite"/>
              </circle>

              <circle cx="110" cy="110" r="5" fill="#00aaff" filter="url(#fm-glow)">
                <animate attributeName="opacity" values="1;0.5;1" dur="1.2s" repeatCount="indefinite"/>
              </circle>
            </g>
          </svg>
        </div>
      )}

      {/* Empty state */}
      {ready && events.length === 0 && !selected && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 600, pointerEvents: 'none',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '8px 16px',
          fontSize: 13, color: 'var(--text-muted)',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
        }}>
          No events nearby · try expanding your radius
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
                  {formatDate(selected.schedule.start_at)}
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

          <button
            onClick={() => router.push(`/events/view?id=${selected.id}`)}
            style={{
              width: '100%', padding: '12px',
              background: '#39FF14', color: '#000',
              border: 'none', borderRadius: 12,
              fontWeight: 700, fontSize: 15,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            View &amp; Join <ArrowRight size={15} />
          </button>
        </div>
      )}

    </div>
  )
}
