'use client'

import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const pinIcon = L.divIcon({
  className: '',
  html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#39FF14;transform:rotate(-45deg);border:2px solid #0b0b0b;box-shadow:0 2px 6px rgba(0,0,0,0.5);"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 24],
})

/**
 * Market listing location: pin + ~1 km circle (the API rounds the seller's spot).
 * Static (no drag/zoom) so it doesn't trap page scrolling; click opens Google Maps.
 */
export default function ListingMap({ lat, lng }: { lat: number; lng: number }) {
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block relative h-48 rounded-2xl overflow-hidden border"
      style={{ borderColor: 'var(--border)' }}
      title="Open in Google Maps"
    >
      <MapContainer
        center={[lat, lng]}
        zoom={13}
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        touchZoom={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        boxZoom={false}
        keyboard={false}
        className="h-full w-full pointer-events-none"
        style={{ zIndex: 0 }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={18} />
        <Circle center={[lat, lng]} radius={900} pathOptions={{ color: '#39FF14', weight: 1, fillColor: '#39FF14', fillOpacity: 0.12 }} />
        <Marker position={[lat, lng]} icon={pinIcon} />
      </MapContainer>
      <span className="absolute left-2 bottom-2 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', zIndex: 500 }}>
        Approximate location
      </span>
    </a>
  )
}
