import { fetchElevationProfile, parseGpx } from '@/lib/parse-gpx'
import type { GpxResult } from '@/lib/parse-gpx'

export type GpxActivityStats = {
  distanceKm: number
  elevationGain: number
}

function statsFromElevationProfile(profile: GpxResult['elevationProfile']) {
  let elevationGain = 0

  for (let i = 1; i < profile.length; i++) {
    const eleM = profile[i].ele - profile[i - 1].ele
    if (eleM > 0) elevationGain += eleM
  }

  return { elevationGain: Math.round(elevationGain) }
}

async function statsFromParsedGpx(parsed: GpxResult): Promise<GpxActivityStats> {
  if (parsed.elevationGain > 0 || parsed.elevationProfile.length >= 2) {
    const profileStats = parsed.elevationProfile.length >= 2
      ? statsFromElevationProfile(parsed.elevationProfile)
      : null

    return {
      distanceKm: parsed.distanceKm,
      elevationGain: parsed.elevationGain || profileStats?.elevationGain || 0,
    }
  }

  try {
    const profile = await fetchElevationProfile(parsed.track)
    const profileStats = statsFromElevationProfile(profile.elevationProfile)
    return {
      distanceKm: parsed.distanceKm,
      elevationGain: profileStats.elevationGain,
    }
  } catch {
    return {
      distanceKm: parsed.distanceKm,
      elevationGain: 0,
    }
  }
}

export async function fetchGpxActivityStats(gpxUrl: string): Promise<GpxActivityStats | null> {
  const separator = gpxUrl.includes('?') ? '&' : '?'
  const response = await fetch(`${gpxUrl}${separator}t=${Date.now()}`)
  if (!response.ok) return null

  const parsed = parseGpx(await response.text())
  if (parsed.track.length < 2) return null

  return statsFromParsedGpx(parsed)
}
