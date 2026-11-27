import { api } from '@/src/lib/api'
import type { EventWeather } from '@/src/lib/weather'

export type EventWeatherSnapshot = EventWeather & {
  updated_at: string
}

const CLIENT_TTL_MS = 15 * 60 * 1000
const MAX_IDS_PER_REQUEST = 30

type SnapshotCacheEntry = {
  value: EventWeatherSnapshot | null
  fetchedAt: number
}

const snapshotCache = new Map<number, SnapshotCacheEntry>()

export async function fetchEventWeatherSnapshots(
  eventIds: number[],
): Promise<Record<number, EventWeatherSnapshot | null>> {
  const uniqueIds = Array.from(new Set(eventIds.filter((id) => Number.isFinite(id))))
  if (uniqueIds.length === 0) return {}

  const now = Date.now()
  const missingIds = uniqueIds.filter((id) => {
    const cached = snapshotCache.get(id)
    if (!cached) return true
    return now - cached.fetchedAt > CLIENT_TTL_MS
  })

  if (missingIds.length > 0) {
    // API accepts at most MAX_IDS_PER_REQUEST ids (validation max:30); bigger lists returned 422
    const chunks: number[][] = []
    for (let i = 0; i < missingIds.length; i += MAX_IDS_PER_REQUEST) {
      chunks.push(missingIds.slice(i, i + MAX_IDS_PER_REQUEST))
    }

    const results = await Promise.allSettled(
      chunks.map((ids) => api.post('/events/weather-snapshots', { event_ids: ids })),
    )

    results.forEach((result, i) => {
      if (result.status !== 'fulfilled') return
      const payload = (result.value.data?.data ?? {}) as Record<string, EventWeatherSnapshot | null>
      chunks[i].forEach((id) => {
        snapshotCache.set(id, {
          value: payload[String(id)] ?? null,
          fetchedAt: now,
        })
      })
    })
  }

  return uniqueIds.reduce<Record<number, EventWeatherSnapshot | null>>((acc, id) => {
    acc[id] = snapshotCache.get(id)?.value ?? null
    return acc
  }, {})
}

export function invalidateEventWeatherSnapshots(eventIds?: number[]) {
  if (!eventIds || eventIds.length === 0) {
    snapshotCache.clear()
    return
  }

  eventIds.forEach((id) => snapshotCache.delete(id))
}
