import type { Metadata } from 'next'

import { formatEventDateTime } from '@/lib/event-time'

import ShareEventClientPage from './share-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SharePageProps = {
  searchParams?: Record<string, string | string[] | undefined>
}

type PublicShareEvent = {
  id: number
  title: string
  description: string | null
  category?: { label?: string | null }
  schedule?: { start_at?: string | null; timezone?: string | null }
}

const FALLBACK_TITLE = 'FitMeet - Join this event'
const FALLBACK_DESCRIPTION = 'Open this event in FitMeet and see who is going.'
const FALLBACK_IMAGE = 'https://fitmeet.fit/logo_full.png'

async function getShareEvent(id: string): Promise<PublicShareEvent | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.fitmeet.fit/api'

  try {
    const response = await fetch(`${apiBase}/events/public/${id}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) return null

    const payload = await response.json() as { data?: PublicShareEvent }
    return payload.data ?? null
  } catch {
    return null
  }
}

function buildDescription(event: PublicShareEvent) {
  const parts: string[] = []

  if (event.category?.label) {
    parts.push(event.category.label)
  }

  if (event.schedule?.start_at) {
    parts.push(
      formatEventDateTime(
        event.schedule.start_at,
        event.schedule.timezone,
      ),
    )
  }

  if (event.description) {
    parts.push(event.description)
  }

  return parts.join(' | ').slice(0, 280) || FALLBACK_DESCRIPTION
}

export async function generateMetadata(
  { searchParams }: SharePageProps,
): Promise<Metadata> {
  const resolvedSearchParams = searchParams ?? {}
  const rawId = resolvedSearchParams.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId

  if (!id) {
    return {
      title: FALLBACK_TITLE,
      description: FALLBACK_DESCRIPTION,
      openGraph: {
        title: FALLBACK_TITLE,
        description: FALLBACK_DESCRIPTION,
        siteName: 'FitMeet',
        type: 'website',
        images: [{ url: FALLBACK_IMAGE }],
      },
      twitter: {
        card: 'summary_large_image',
        title: FALLBACK_TITLE,
        description: FALLBACK_DESCRIPTION,
        images: [FALLBACK_IMAGE],
      },
    }
  }

  const event = await getShareEvent(id)

  if (!event) {
    return {
      title: FALLBACK_TITLE,
      description: FALLBACK_DESCRIPTION,
      openGraph: {
        title: FALLBACK_TITLE,
        description: FALLBACK_DESCRIPTION,
        siteName: 'FitMeet',
        type: 'website',
        images: [{ url: FALLBACK_IMAGE }],
      },
      twitter: {
        card: 'summary_large_image',
        title: FALLBACK_TITLE,
        description: FALLBACK_DESCRIPTION,
        images: [FALLBACK_IMAGE],
      },
    }
  }

  const title = `${event.title} | FitMeet`
  const description = buildDescription(event)
  const canonicalUrl = `/events/share?id=${event.id}`

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: 'FitMeet',
      type: 'article',
      images: [{ url: FALLBACK_IMAGE }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [FALLBACK_IMAGE],
    },
  }
}

export default function ShareEventPage() {
  return <ShareEventClientPage />
}
