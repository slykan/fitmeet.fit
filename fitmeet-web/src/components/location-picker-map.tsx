'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default marker icons (broken in bundlers)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface Props {
  lat:       number | null
  lng:       number | null
  onChange?: (lat: number, lng: number) => void
  track?:    [number, number][]
  readOnly?: boolean
  height?:   number
}

function ClickHandler({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onChange(e.latlng.lat, e.latlng.lng) })
  return null
}

function FitTrack({ track }: { track: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (track.length > 1) {
      map.fitBounds(L.latLngBounds(track), { padding: [20, 20] })
    }
  }, [map, track])
  return null
}

export default function LocationPickerMap({
  lat, lng, onChange, track, readOnly = false, height = 220,
}: Props) {
  const hasPin   = lat !== null && lng !== null
  const hasTrack = track && track.length > 1

  const center: [number, number] = hasPin
    ? [lat!, lng!]
    : hasTrack
    ? track![0]
    : [44.5, 16.5]

  const zoom = hasPin || hasTrack ? 11 : 5

  return (
    <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: `${height}px`, width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {!readOnly && onChange && <ClickHandler onChange={onChange} />}
        {hasPin && <Marker position={[lat!, lng!]} />}
        {hasTrack && (
          <>
            <Polyline
              positions={track!}
              pathOptions={{ color: '#39ff14', weight: 3, opacity: 0.85 }}
            />
            <FitTrack track={track!} />
          </>
        )}
      </MapContainer>
    </div>
  )
}
