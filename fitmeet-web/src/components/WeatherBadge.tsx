'use client'

import { useEffect, useState } from 'react'
import {
  Sun, CloudSun, Cloud, CloudRain, CloudSnow, CloudLightning,
  Wind,
} from 'lucide-react'
import { fetchEventWeather, weatherIcon, weatherSlot, EventWeather } from '@/lib/weather'

// CSS keyframe injected once — animation-delay handles the 2s hold with fill-mode:both
const REVEAL_CSS = `@keyframes fm-weather-in{from{opacity:0}to{opacity:1}}`

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  'sun':             Sun,
  'cloud-sun':       CloudSun,
  'cloud':           Cloud,
  'cloud-rain':      CloudRain,
  'cloud-snow':      CloudSnow,
  'cloud-lightning': CloudLightning,
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

// animation-fill-mode:both means opacity stays 0 during the delay, then fades to 1
const revealAnim = 'fm-weather-in 0.45s ease 1.8s both'

export function WeatherBadge({ lat, lng, startAt, timezone, inline = false, mapOverlay = false, weather: providedWeather }: Props) {
  const [weather, setWeather] = useState<EventWeather | null>(null)

  useEffect(() => {
    setWeather(null)
    let cancelled = false
    const { isoDate, hour } = weatherSlot(startAt, timezone)
    const p = providedWeather
      ? Promise.resolve(providedWeather)
      : fetchEventWeather(lat, lng, isoDate, hour)
    p.then(w => { if (!cancelled && w) setWeather(w) })
    return () => { cancelled = true }
  }, [lat, lng, startAt, timezone, providedWeather])

  if (!weather) return null

  const IconComp = ICONS[weatherIcon(weather.code)] ?? Cloud

  if (mapOverlay) {
    return (
      <>
        <style>{REVEAL_CSS}</style>
        <div style={{
          animation: revealAnim,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 12, fontWeight: 600,
          color: 'rgba(255,255,255,0.85)',
          background: 'rgba(5,8,22,0.72)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(6px)',
          borderRadius: 999, padding: '5px 12px', whiteSpace: 'nowrap',
        }}>
          <IconComp size={13} />
          <span>{weather.tempMin}°/{weather.tempMax}°</span>
          <span style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.2)', display: 'inline-block', margin: '0 2px' }} />
          <Wind size={12} />
          <span>{weather.windSpeed} km/h</span>
          <span style={{ display: 'inline-block', transform: `rotate(${weather.windDir + 90}deg)`, lineHeight: 1, color: '#58beff' }}>→</span>
        </div>
      </>
    )
  }

  if (inline) {
    return (
      <>
        <style>{REVEAL_CSS}</style>
        <span style={{
          animation: revealAnim,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 12, color: 'var(--text-muted)',
          background: 'rgba(11,16,32,0.9)',
          border: '1px solid var(--border)',
          borderRadius: 999, padding: '3px 10px',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          <IconComp size={13} />
          <span>{weather.tempMin}°/{weather.tempMax}°</span>
          <span style={{ width: 1, height: 10, background: 'var(--border)', display: 'inline-block', margin: '0 2px' }} />
          <Wind size={12} />
          <span>{weather.windSpeed} km/h</span>
          <span style={{ display: 'inline-block', transform: `rotate(${weather.windDir + 90}deg)`, lineHeight: 1, color: '#58beff' }}>→</span>
        </span>
      </>
    )
  }

  return (
    <>
      <style>{REVEAL_CSS}</style>
      <div style={{
        animation: revealAnim,
        display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
        gap: 5, marginTop: 8, fontSize: 11,
        color: 'rgba(120,135,170,0.9)',
      }}>
        <IconComp size={12} />
        <span>{weather.tempMin}°/{weather.tempMax}°</span>
        <span style={{ width: 1, height: 9, background: 'var(--border)', display: 'inline-block', margin: '0 1px' }} />
        <Wind size={11} />
        <span>{weather.windSpeed} km/h</span>
        <span style={{ display: 'inline-block', transform: `rotate(${weather.windDir + 90}deg)`, lineHeight: 1, color: '#58beff' }}>→</span>
      </div>
    </>
  )
}
