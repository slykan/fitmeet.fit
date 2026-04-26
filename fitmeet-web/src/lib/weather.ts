export type EventWeather = {
  code: number
  tempMin: number
  tempMax: number
  windSpeed: number
  windDir: number
  tempCurrent?: number
}

export { eventWeatherSlot as weatherSlot } from '@/lib/event-time'

type OpenMeteoResponse = {
  current?: {
    temperature_2m: number
    weathercode: number
    windspeed_10m: number
    winddirection_10m: number
  }
  hourly?: {
    time: string[]
    temperature_2m: number[]
    weathercode: number[]
    windspeed_10m: number[]
    winddirection_10m: number[]
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
      `&hourly=temperature_2m,weathercode,windspeed_10m,winddirection_10m` +
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
      `&current=temperature_2m,weathercode,windspeed_10m,winddirection_10m` +
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
