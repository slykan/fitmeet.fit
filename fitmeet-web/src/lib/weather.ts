export type EventWeather = {
  code: number
  tempMin: number
  tempMax: number
  windSpeed: number
  windDir: number
  tempCurrent?: number
  uvIndex?: number
  precipitation?: number
}

export { eventWeatherSlot as weatherSlot } from '@/lib/event-time'

type OpenMeteoResponse = {
  current?: {
    temperature_2m: number
    weathercode: number
    windspeed_10m: number
    winddirection_10m: number
    uv_index?: number
    precipitation?: number
  }
  hourly?: {
    time: string[]
    temperature_2m: number[]
    weathercode: number[]
    windspeed_10m: number[]
    winddirection_10m: number[]
    precipitation?: number[]
  }
  daily?: {
    temperature_2m_max: number[]
    temperature_2m_min: number[]
  }
  error?: boolean
}

const cache = new Map<string, EventWeather | null>()

export async function fetchEventWeather(
  lat: number,
  lng: number,
  isoDate: string,
  hour: number,
): Promise<EventWeather | null> {
  const key = `${lat},${lng},${isoDate},${hour}`
  if (cache.has(key)) return cache.get(key)!

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&hourly=temperature_2m,weathercode,windspeed_10m,winddirection_10m,precipitation` +
      `&daily=temperature_2m_max,temperature_2m_min` +
      `&timezone=auto&start_date=${isoDate}&end_date=${isoDate}`

    const res = await fetch(url, { next: { revalidate: 3600 } })
    const data: OpenMeteoResponse = await res.json()

    if (data.error || !data.hourly || !data.daily) {
      cache.set(key, null)
      return null
    }

    const targetTime = `${isoDate}T${String(hour).padStart(2, '0')}:00`
    const idx = data.hourly.time.indexOf(targetTime)

    let resolvedIdx = idx

    if (resolvedIdx === -1) {
      const sameDay = data.hourly.time
        .map((time, index) => ({ time, index }))
        .filter((entry) => entry.time.startsWith(`${isoDate}T`))

      if (sameDay.length > 0) {
        resolvedIdx = sameDay.reduce((best, current) => {
          const bestHour = Number.parseInt(sameDay[best].time.slice(11, 13), 10)
          const currentHour = Number.parseInt(current.time.slice(11, 13), 10)
          return Math.abs(currentHour - hour) < Math.abs(bestHour - hour) ? sameDay.indexOf(current) : best
        }, 0)
        resolvedIdx = sameDay[resolvedIdx]?.index ?? -1
      }
    }

    if (resolvedIdx === -1) {
      cache.set(key, null)
      return null
    }

    const result: EventWeather = {
      code: data.hourly.weathercode[resolvedIdx],
      tempMin: Math.round(data.daily.temperature_2m_min[0]),
      tempMax: Math.round(data.daily.temperature_2m_max[0]),
      windSpeed: Math.round(data.hourly.windspeed_10m[resolvedIdx]),
      windDir: Math.round(data.hourly.winddirection_10m[resolvedIdx]),
      tempCurrent: Math.round(data.hourly.temperature_2m[resolvedIdx]),
      precipitation:
        data.hourly.precipitation?.[resolvedIdx] != null
          ? Math.round(data.hourly.precipitation[resolvedIdx] * 10) / 10
          : undefined,
    }

    cache.set(key, result)
    return result
  } catch {
    cache.set(key, null)
    return null
  }
}

export async function fetchCurrentWeather(
  lat: number,
  lng: number,
): Promise<EventWeather | null> {
  const now = new Date()
  const bucket = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(Math.floor(now.getMinutes() / 10) * 10).padStart(2, '0')}`
  const key = `current:${lat},${lng},${bucket}`
  if (cache.has(key)) return cache.get(key)!

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,weathercode,windspeed_10m,winddirection_10m,uv_index,precipitation` +
      `&daily=temperature_2m_max,temperature_2m_min` +
      `&timezone=auto`

    const res = await fetch(url, { next: { revalidate: 600 } })
    const data: OpenMeteoResponse = await res.json()

    if (data.error || !data.current || !data.daily) {
      cache.set(key, null)
      return null
    }

    const result: EventWeather = {
      code: Math.round(data.current.weathercode),
      tempMin: Math.round(data.daily.temperature_2m_min[0]),
      tempMax: Math.round(data.daily.temperature_2m_max[0]),
      windSpeed: Math.round(data.current.windspeed_10m),
      windDir: Math.round(data.current.winddirection_10m),
      tempCurrent: Math.round(data.current.temperature_2m),
      uvIndex: data.current.uv_index != null ? Math.round(data.current.uv_index * 10) / 10 : undefined,
      precipitation: data.current.precipitation != null ? Math.round(data.current.precipitation * 10) / 10 : undefined,
    }

    cache.set(key, result)
    return result
  } catch {
    cache.set(key, null)
    return null
  }
}

export function weatherIcon(code: number): string {
  if (code === 0) return 'sun'
  if (code <= 3) return 'cloud-sun'
  if (code <= 48) return 'cloud'
  if (code <= 67) return 'cloud-rain'
  if (code <= 77) return 'cloud-snow'
  if (code <= 82) return 'cloud-rain'
  return 'cloud-lightning'
}

export function weatherCloudStrength(code: number): number {
  if (code === 0) return 0
  if (code === 1) return 0.32
  if (code === 2) return 0.6
  if (code === 3) return 1
  if (code <= 48) return 0.92
  if (code <= 67) return 0.96
  if (code <= 77) return 0.98
  if (code <= 82) return 1
  return 1
}

export function weatherRainStrength(code: number, precipitation?: number): number {
  const amountBoost = precipitation ? Math.min(1, precipitation / 2.5) * 0.18 : 0
  if (code >= 51 && code <= 55) return Math.min(1, 0.34 + ((code - 51) / 4) * 0.3 + amountBoost)
  if (code >= 56 && code <= 57) return Math.min(1, 0.58 + amountBoost)
  if (code >= 61 && code <= 65) return Math.min(1, 0.42 + ((code - 61) / 4) * 0.4 + amountBoost)
  if (code >= 66 && code <= 67) return Math.min(1, 0.72 + amountBoost)
  if (code >= 80 && code <= 82) return Math.min(1, 0.56 + ((code - 80) / 2) * 0.34 + amountBoost)
  if (code >= 95) return Math.min(1, 0.82 + amountBoost)
  return 0
}

export function weatherConditionLabel(code: number, precipitation?: number): string {
  if (code === 0) return 'Clear sky'
  if (code === 1) return 'Mostly clear'
  if (code === 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code === 45 || code === 48) return 'Fog'
  if (code >= 51 && code <= 55) {
    if (precipitation != null && precipitation >= 0.8) return 'Heavy drizzle'
    if (precipitation != null && precipitation >= 0.2) return 'Light drizzle'
    return 'Drizzle'
  }
  if (code >= 56 && code <= 57) return 'Freezing drizzle'
  if (code >= 61 && code <= 65) {
    if (precipitation != null && precipitation >= 2.5) return 'Heavy rain'
    if (precipitation != null && precipitation >= 0.3) return 'Light rain'
    return 'Rain'
  }
  if (code >= 66 && code <= 67) return 'Freezing rain'
  if (code >= 71 && code <= 77) return 'Snow'
  if (code >= 80 && code <= 82) {
    if (code === 82 || (precipitation != null && precipitation >= 2.5)) return 'Heavy showers'
    if (precipitation != null && precipitation >= 0.3) return 'Light showers'
    return 'Showers'
  }
  if (code >= 95) return 'Thunderstorm'
  return 'Clouds active'
}
