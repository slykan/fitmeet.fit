import { formatEventDateTime } from '@/lib/event-time'

import type { SharedEvent } from './share-client'

export const FALLBACK_TITLE = 'FitMeet - Join this event'
export const FALLBACK_DESCRIPTION = 'Open this event in FitMeet and see who is going.'
export const FALLBACK_IMAGE = 'https://fitmeet.fit/logo_full.png'

type EventListItem = {
  id: number
  created_at?: string | null
  schedule?: { start_at?: string | null }
}

function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL ?? 'https://api.fitmeet.fit/api'
}

export async function getShareEvent(id: string): Promise<SharedEvent | null> {
  try {
    const response = await fetch(`${apiBase()}/events/public/${id}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    })

    if (!response.ok) return null

    const payload = await response.json() as { data?: SharedEvent }
    return payload.data ?? null
  } catch {
    return null
  }
}

export async function getPublicShareEvents(limit = 20): Promise<EventListItem[]> {
  try {
    const response = await fetch(`${apiBase()}/events/public-latest?limit=${limit}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    })

    if (!response.ok) return []

    const payload = await response.json() as { data?: EventListItem[] }
    return payload.data ?? []
  } catch {
    return []
  }
}

export function buildDescription(event: SharedEvent) {
  const parts: string[] = []

  if (event.category?.label) {
    parts.push(event.category.label)
  }

  if (event.schedule?.start_at) {
    parts.push(formatEventDateTime(event.schedule.start_at, event.schedule.timezone))
  }

  if (event.description) {
    parts.push(event.description)
  }

  return parts.join(' | ').slice(0, 280) || FALLBACK_DESCRIPTION
}

export function buildEventJsonLd(event: SharedEvent) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: event.title,
    description: event.description ?? buildDescription(event),
    startDate: event.schedule.start_at,
    endDate: event.schedule.duration_minutes
      ? new Date(new Date(event.schedule.start_at).getTime() + event.schedule.duration_minutes * 60_000).toISOString()
      : undefined,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: event.image_url ? [event.image_url] : [FALLBACK_IMAGE],
    sport: event.category.label,
    location: {
      '@type': 'Place',
      name: event.location.address ?? event.category.label,
      address: event.location.address ?? undefined,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: event.location.lat,
        longitude: event.location.lng,
      },
    },
    organizer: event.organizer ? {
      '@type': 'Person',
      name: event.organizer.name,
    } : {
      '@type': 'Organization',
      name: 'FitMeet',
      url: 'https://fitmeet.fit',
    },
    url: `https://fitmeet.fit/events/share/${event.id}`,
  }
}
