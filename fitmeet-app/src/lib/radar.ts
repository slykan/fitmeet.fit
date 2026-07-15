const RADAR_TTL_MS = 10 * 60 * 1000

type CacheEntry = {
  value: string | null
  fetchedAt: number
}

let cache: CacheEntry | null = null

export async function fetchLatestRadarPath(): Promise<string | null> {
  if (cache && Date.now() - cache.fetchedAt <= RADAR_TTL_MS) return cache.value

  try {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json')
    const data = await res.json()
    const past = data?.radar?.past
    const path = Array.isArray(past) && past.length > 0 ? past[past.length - 1].path : null
    cache = { value: path, fetchedAt: Date.now() }
    return path
  } catch {
    return cache?.value ?? null
  }
}
