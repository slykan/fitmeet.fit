import { fetchElevationProfile, parseGpxText } from '@/src/lib/gpx'
import type { GpxParsed } from '@/src/lib/gpx'

export type GpxActivityStats = {
  distanceKm: number
  elevGain: number
}

function statsFromElevationProfile(profile: { km: number; ele: number }[]) {
  let elevGain = 0

  for (let i = 1; i < profile.length; i++) {
    const eleM = profile[i].ele - profile[i - 1].ele
    if (eleM > 0) elevGain += eleM
  }

  return { elevGain: Math.round(elevGain) }
}

async function statsFromParsedGpx(parsed: GpxParsed): Promise<GpxActivityStats> {
  if (parsed.elevGain > 0 || parsed.elevationProfile.length >= 2) {
    const profileStats = parsed.elevationProfile.length >= 2
      ? statsFromElevationProfile(parsed.elevationProfile)
      : null

    return {
      distanceKm: parsed.distanceKm,
      elevGain: parsed.elevGain || profileStats?.elevGain || 0,
    }
  }

  try {
    const profile = await fetchElevationProfile(parsed.track)
    const profileStats = statsFromElevationProfile(profile.elevationProfile)
    return {
      distanceKm: parsed.distanceKm,
      elevGain: profileStats.elevGain,
    }
  } catch {
    return {
      distanceKm: parsed.distanceKm,
      elevGain: 0,
    }
  }
}

export async function fetchGpxActivityStats(gpxUrl: string, token?: string | null): Promise<GpxActivityStats | null> {
  const separator = gpxUrl.includes('?') ? '&' : '?'
  const response = await fetch(`${gpxUrl}${separator}t=${Date.now()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!response.ok) return null

  const parsed = parseGpxText(await response.text())
  if (parsed.track.length < 2) return null

  return statsFromParsedGpx(parsed)
}
