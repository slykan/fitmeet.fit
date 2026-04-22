'use client'

import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useRouter } from 'next/navigation'
import { Calendar, ArrowRight, X, Users } from 'lucide-react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const CATEGORY_EMOJI: Record<string, string> = {
  running:  '🏃', cycling:  '🚴', hiking:  '🥾', swimming: '🏊',
  football: '⚽', party:    '🎉', chill:   '😎', yoga:     '🧘',
  climbing: '🏔️', camping:  '🏕️',
}

interface EventPin {
  id: number
  title: string
  category: { value: string; label: string }
  location: { lat: number; lng: number; address: string | null }
  schedule: { start_at: string }
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
      if (lat !== null && lng !== null) pts.push([lat, lng])
      map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], animate: true, duration: 1 })
    } else if (lat !== null && lng !== null) {
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

export default function HubMap() {
  const { user }   = useAuthStore()
  const router     = useRouter()
  const [events,   setEvents]   = useState<EventPin[]>([])
  const [selected, setSelected] = useState<EventPin | null>(null)
  const [ready,    setReady]    = useState(false)
  const [radar,    setRadar]    = useState(true)

  const lat      = user?.location?.lat ?? user?.home?.lat ?? null
  const lng      = user?.location?.lng ?? user?.home?.lng ?? null
  const radiusKm = user?.radius_km ?? 50

  useEffect(() => {
    const params: Record<string, unknown> = {}
    if (lat !== null && lng !== null) {
      params.lat = lat
      params.lng = lng
      params.radius_km = radiusKm
    }
    api.get('/events', { params })
      .then(({ data }) => setEvents(data.data ?? []))
      .catch(() => {})
      .finally(() => setReady(true))

    const t = setTimeout(() => setRadar(false), 1600)
    return () => clearTimeout(t)
  }, [lat, lng, radiusKm])

  const mapCenter: [number, number] = (lat !== null && lng !== null) ? [lat, lng] : [44.5, 16.5]

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
        }}>
          <style>{`
            @keyframes fm-sweep {
              from { transform: rotate(0deg);   opacity: 1; }
              85%  {                             opacity: 1; }
              to   { transform: rotate(360deg); opacity: 0; }
            }
          `}</style>
          {/* Static ring */}
          <div style={{
            position: 'absolute',
            width: 280, height: 280,
            borderRadius: '50%',
            border: '1px solid rgba(30,144,255,0.2)',
          }} />
          {/* Rotating sweep */}
          <div style={{
            width: 280, height: 280,
            borderRadius: '50%',
            overflow: 'hidden',
            animation: 'fm-sweep 1.5s linear forwards',
            background: 'conic-gradient(from 0deg, rgba(30,144,255,0.95) 0deg 2deg, rgba(30,144,255,0.5) 2deg 45deg, rgba(30,144,255,0.15) 45deg 75deg, transparent 75deg 360deg)',
          }} />
          {/* Center dot */}
          <div style={{
            position: 'absolute',
            width: 7, height: 7,
            borderRadius: '50%',
            background: 'rgba(30,144,255,0.9)',
            boxShadow: '0 0 6px rgba(30,144,255,0.8)',
          }} />
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
