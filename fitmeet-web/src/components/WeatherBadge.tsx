'use client'

import { useEffect, useState } from 'react'
import {
  Sun, CloudSun, Cloud, CloudRain, CloudSnow, CloudLightning,
  Wind,
} from 'lucide-react'
import { fetchEventWeather, weatherIcon, EventWeather } from '@/lib/weather'

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  'sun':              Sun,
  'cloud-sun':        CloudSun,
  'cloud':            Cloud,
  'cloud-rain':       CloudRain,
  'cloud-snow':       CloudSnow,
  'cloud-lightning':  CloudLightning,
}

type Props = {
  lat: number
  lng: number
  startAt: string
  inline?: boolean
}

export function WeatherBadge({ lat, lng, startAt, inline = false }: Props) {
  const [weather, setWeather] = useState<EventWeather | null>(null)

  useEffect(() => {
    const d = new Date(startAt)
    const isoDate = startAt.slice(0, 10)
    const hour = d.getHours()
    fetchEventWeather(lat, lng, isoDate, hour).then(setWeather)
  }, [lat, lng, startAt])

  if (!weather) return null

  const IconComp = ICONS[weatherIcon(weather.code)] ?? Cloud

  if (inline) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 12,
          color: 'var(--text-muted)',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 999,
          padding: '3px 10px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <IconComp size={13} />
        <span>{weather.tempMin}°/{weather.tempMax}°</span>
        <span style={{ width: 1, height: 10, background: 'var(--border)', display: 'inline-block', margin: '0 2px' }} />
        <Wind size={12} />
        <span>{weather.windSpeed} km/h</span>
        <span
          style={{
            display: 'inline-block',
            transform: `rotate(${weather.windDir + 180}deg)`,
            lineHeight: 1,
          }}
        >↑</span>
      </span>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 5,
        marginTop: 8,
        fontSize: 11,
        color: 'var(--text-muted)',
      }}
    >
      <IconComp size={12} />
      <span>{weather.tempMin}°/{weather.tempMax}°</span>
      <span style={{ width: 1, height: 9, background: 'var(--border)', display: 'inline-block', margin: '0 1px' }} />
      <Wind size={11} />
      <span>{weather.windSpeed} km/h</span>
      <span
        style={{
          display: 'inline-block',
          transform: `rotate(${weather.windDir + 180}deg)`,
          lineHeight: 1,
        }}
      >↑</span>
    </div>
  )
}
