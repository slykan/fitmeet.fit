export type RadarFrame = {
  time: number
  path: string
}

export type RadarFrames = {
  frames: RadarFrame[]
  nowIndex: number
}

const RADAR_TTL_MS = 5 * 60 * 1000

type CacheEntry = {
  value: RadarFrames | null
  fetchedAt: number
}

let cache: CacheEntry | null = null

export async function fetchRadarFrames(): Promise<RadarFrames | null> {
  if (cache && Date.now() - cache.fetchedAt < RADAR_TTL_MS) return cache.value

  try {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json')
    const data = await res.json()
    const past: RadarFrame[] = data?.radar?.past ?? []
    const nowcast: RadarFrame[] = data?.radar?.nowcast ?? []
    if (past.length === 0) {
      cache = { value: null, fetchedAt: Date.now() }
      return null
    }

    const result: RadarFrames = {
      frames: [...past, ...nowcast].map((f) => ({ time: f.time, path: f.path })),
      nowIndex: past.length - 1,
    }
    cache = { value: result, fetchedAt: Date.now() }
    return result
  } catch {
    return cache?.value ?? null
  }
}
