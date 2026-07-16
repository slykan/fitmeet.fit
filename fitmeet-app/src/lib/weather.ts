export type EventWeather = {
  code: number
  temperature: number
  tempMin: number
  tempMax: number
  windSpeed: number
  windDir: number
  uvIndex: number
  cloudCover: number
  precipitation: number
}

export type CurrentWeather = {
  code: number
  temperature: number
  windSpeed: number
  windDir: number
  uvIndex: number
  cloudCover: number
  precipitation: number
}

type OpenMeteoResponse = {
  hourly: {
    time: string[]
    temperature_2m: number[]
    weathercode: number[]
    windspeed_10m: number[]
    winddirection_10m: number[]
    uv_index: number[]
    cloudcover: number[]
    precipitation: number[]
  }
  daily: {
    temperature_2m_max: number[]
    temperature_2m_min: number[]
  }
}

type OpenMeteoCurrentResponse = {
  current?: {
    temperature_2m?: number
    weather_code?: number
    wind_speed_10m?: number
    wind_direction_10m?: number
    uv_index?: number
    cloud_cover?: number
    precipitation?: number
  }
}

export type RainForecast = {
  minutesUntilRain: number | null
}

type OpenMeteoMinutelyResponse = {
  minutely_15?: {
    time: string[]
    precipitation: number[]
  }
}

type CacheEntry<T> = {
  value: T
  fetchedAt: number
}

const EVENT_WEATHER_TTL_MS = 15 * 60 * 1000
const CURRENT_WEATHER_TTL_MS = 15 * 60 * 1000
const RAIN_FORECAST_TTL_MS = 15 * 60 * 1000
const RAIN_FORECAST_WINDOW_INTERVALS = 16 // 16 * 15min = 4h ahead
const RAIN_FORECAST_THRESHOLD_MM = 0.1

const cache = new Map<string, CacheEntry<EventWeather>>()
const currentCache = new Map<string, CacheEntry<CurrentWeather>>()
const rainForecastCache = new Map<string, CacheEntry<RainForecast>>()

export async function fetchEventWeather(
  lat: number,
  lng: number,
  isoDate: string,
  hour: number,
): Promise<EventWeather | null> {
  const key = `${lat},${lng},${isoDate},${hour}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.fetchedAt <= EVENT_WEATHER_TTL_MS) return cached.value

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&hourly=temperature_2m,weathercode,windspeed_10m,winddirection_10m,uv_index,cloudcover,precipitation` +
      `&daily=temperature_2m_max,temperature_2m_min` +
      `&timezone=auto&start_date=${isoDate}&end_date=${isoDate}`

    const res = await fetch(url)
    const data: OpenMeteoResponse = await res.json()

    const targetTime = `${isoDate}T${String(hour).padStart(2, '0')}:00`
    const idx = data.hourly.time.indexOf(targetTime)
    if (idx === -1) return null

    const result: EventWeather = {
      code: data.hourly.weathercode[idx],
      temperature: Math.round(data.hourly.temperature_2m[idx]),
      tempMin: Math.round(data.daily.temperature_2m_min[0]),
      tempMax: Math.round(data.daily.temperature_2m_max[0]),
      windSpeed: Math.round(data.hourly.windspeed_10m[idx]),
      windDir: Math.round(data.hourly.winddirection_10m[idx]),
      uvIndex: Math.round((data.hourly.uv_index[idx] ?? 0) * 10) / 10,
      cloudCover: Math.round(data.hourly.cloudcover[idx] ?? 0),
      precipitation: Math.round((data.hourly.precipitation[idx] ?? 0) * 10) / 10,
    }

    cache.set(key, { value: result, fetchedAt: Date.now() })
    return result
  } catch {
    return null
  }
}

export async function fetchCurrentWeather(
  lat: number,
  lng: number,
): Promise<CurrentWeather | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`
  const cached = currentCache.get(key)
  if (cached && Date.now() - cached.fetchedAt <= CURRENT_WEATHER_TTL_MS) return cached.value

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,uv_index,cloud_cover,precipitation` +
      `&timezone=auto&forecast_days=1`

    const res = await fetch(url)
    const data: OpenMeteoCurrentResponse = await res.json()
    const current = data.current
    if (!current) return null

    const result: CurrentWeather = {
      code: Math.round(current.weather_code ?? 0),
      temperature: Math.round(current.temperature_2m ?? 0),
      windSpeed: Math.round(current.wind_speed_10m ?? 0),
      windDir: Math.round(current.wind_direction_10m ?? 0),
      uvIndex: Math.round((current.uv_index ?? 0) * 10) / 10,
      cloudCover: Math.round(current.cloud_cover ?? 0),
      precipitation: Math.round((current.precipitation ?? 0) * 10) / 10,
    }

    currentCache.set(key, { value: result, fetchedAt: Date.now() })
    return result
  } catch {
    return null
  }
}

export async function fetchRainForecast(
  lat: number,
  lng: number,
): Promise<RainForecast | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`
  const cached = rainForecastCache.get(key)
  if (cached && Date.now() - cached.fetchedAt <= RAIN_FORECAST_TTL_MS) return cached.value

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&minutely_15=precipitation&forecast_minutely_15=${RAIN_FORECAST_WINDOW_INTERVALS}` +
      `&timezone=auto`

    const res = await fetch(url)
    const data: OpenMeteoMinutelyResponse = await res.json()
    const times = data.minutely_15?.time ?? []
    const precipitation = data.minutely_15?.precipitation ?? []

    const now = Date.now()
    let minutesUntilRain: number | null = null
    for (let i = 0; i < times.length; i++) {
      if ((precipitation[i] ?? 0) < RAIN_FORECAST_THRESHOLD_MM) continue
      const diffMin = Math.round((new Date(times[i]).getTime() - now) / 60000)
      if (diffMin < 0) continue
      minutesUntilRain = diffMin
      break
    }

    const result: RainForecast = { minutesUntilRain }
    rainForecastCache.set(key, { value: result, fetchedAt: Date.now() })
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

export function cloudLabel(cloudCover: number): string {
  if (cloudCover >= 90) return 'Overcast'
  if (cloudCover >= 65) return 'Cloudy'
  if (cloudCover >= 35) return 'Partly cloudy'
  if (cloudCover >= 10) return 'Light clouds'
  return 'Clear'
}
