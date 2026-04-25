'use client'

import { useEffect, useState } from 'react'
import {
  Sun, CloudSun, Cloud, CloudRain, CloudSnow, CloudLightning,
  Wind,
} from 'lucide-react'
import { fetchEventWeather, weatherIcon, weatherSlot, EventWeather } from '@/lib/weather'

// All badges on a page wait for the same 2-second window before revealing.
// The timer starts on the first badge mount so late-loaded pages don't wait extra.
let pageReadyPromise: Promise<void> | null = null
function getPageReady(): Promise<void> {
  if (!pageReadyPromise) {
    pageReadyPromise = new Promise(resolve => setTimeout(resolve, 2000))
  }
  return pageReadyPromise
}

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
  timezone?: string | null
  inline?: boolean
  mapOverlay?: boolean
  weather?: EventWeather | null
}

export function WeatherBadge({ lat, lng, startAt, timezone, inline = false, mapOverlay = false, weather: providedWeather }: Props) {
  const [weather, setWeather] = useState<EventWeather | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(false)
    setWeather(null)

    let cancelled = false

    const ready = getPageReady()
    const { isoDate, hour } = weatherSlot(startAt, timezone)
    const dataPromise = providedWeather
      ? Promise.resolve(providedWeather)
      : fetchEventWeather(lat, lng, isoDate, hour)

    Promise.all([ready, dataPromise]).then(([, w]) => {
      if (cancelled || !w) return
      setWeather(w)
      requestAnimationFrame(() => { if (!cancelled) setVisible(true) })
    })
    return () => { cancelled = true }
  }, [lat, lng, startAt, timezone, providedWeather])

  if (!weather) return null

  const IconComp = ICONS[weatherIcon(weather.code)] ?? Cloud
  const fadeStyle = { opacity: visible ? 1 : 0, transition: 'opacity 0.35s ease' }

  // Map overlay variant
  if (mapOverlay) {
    return (
      <div style={{
        ...fadeStyle,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        fontWeight: 600,
        color: 'rgba(255,255,255,0.85)',
        background: 'rgba(5,8,22,0.72)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(6px)',
        borderRadius: 999,
        padding: '5px 12px',
        whiteSpace: 'nowrap',
      }}>
        <IconComp size={13} />
        <span>{weather.tempMin}°/{weather.tempMax}°</span>
        <span style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.2)', display: 'inline-block', margin: '0 2px' }} />
        <Wind size={12} />
        <span>{weather.windSpeed} km/h</span>
        <span style={{ display: 'inline-block', transform: `rotate(${weather.windDir + 180}deg)`, lineHeight: 1 }}>↑</span>
      </div>
    )
  }

  if (inline) {
    return (
      <span style={{
        ...fadeStyle,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 12,
        color: 'var(--text-muted)',
        background: 'rgba(11,16,32,0.9)',
        border: '1px solid var(--border)',
        borderRadius: 999,
        padding: '3px 10px',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        <IconComp size={13} />
        <span>{weather.tempMin}°/{weather.tempMax}°</span>
        <span style={{ width: 1, height: 10, background: 'var(--border)', display: 'inline-block', margin: '0 2px' }} />
        <Wind size={12} />
        <span>{weather.windSpeed} km/h</span>
        <span style={{ display: 'inline-block', transform: `rotate(${weather.windDir + 180}deg)`, lineHeight: 1 }}>↑</span>
      </span>
    )
  }

  return (
    <div style={{
      ...fadeStyle,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 5,
      marginTop: 8,
      fontSize: 11,
      color: 'rgba(120,135,170,0.9)',
    }}>
      <IconComp size={12} />
      <span>{weather.tempMin}°/{weather.tempMax}°</span>
      <span style={{ width: 1, height: 9, background: 'var(--border)', display: 'inline-block', margin: '0 1px' }} />
      <Wind size={11} />
      <span>{weather.windSpeed} km/h</span>
      <span style={{ display: 'inline-block', transform: `rotate(${weather.windDir + 180}deg)`, lineHeight: 1 }}>↑</span>
    </div>
  )
}
