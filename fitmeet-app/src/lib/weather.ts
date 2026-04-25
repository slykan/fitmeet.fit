export type EventWeather = {
  code: number
  tempMin: number
  tempMax: number
  windSpeed: number
  windDir: number
}

type OpenMeteoResponse = {
  hourly: {
    time: string[]
    temperature_2m: number[]
    weathercode: number[]
    windspeed_10m: number[]
    winddirection_10m: number[]
  }
  daily: {
    temperature_2m_max: number[]
    temperature_2m_min: number[]
  }
}

const cache = new Map<string, EventWeather>()

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

    const res = await fetch(url)
    const data: OpenMeteoResponse = await res.json()

    const targetTime = `${isoDate}T${String(hour).padStart(2, '0')}:00`
    const idx = data.hourly.time.indexOf(targetTime)
    if (idx === -1) return null

    const result: EventWeather = {
      code: data.hourly.weathercode[idx],
      tempMin: Math.round(data.daily.temperature_2m_min[0]),
      tempMax: Math.round(data.daily.temperature_2m_max[0]),
      windSpeed: Math.round(data.hourly.windspeed_10m[idx]),
      windDir: Math.round(data.hourly.winddirection_10m[idx]),
    }

    cache.set(key, result)
    return result
  } catch {
    return null
  }
}

export function weatherIconName(code: number): string {
  if (code === 0) return 'sunny-outline'
  if (code <= 3) return 'partly-sunny-outline'
  if (code <= 48) return 'cloudy-outline'
  if (code <= 67) return 'rainy-outline'
  if (code <= 77) return 'snow-outline'
  if (code <= 82) return 'rainy-outline'
  return 'thunderstorm-outline'
}
