import type { Metadata } from 'next'

import ShareEventClientPage, { SharedEvent } from './share-client'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function getApiBase() {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api'
}

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://fitmeet.fit'
}

async function getSharedEvent(id: string): Promise<SharedEvent | null> {
  try {
    const res = await fetch(`${getApiBase()}/events/public/${id}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.data ?? null
  } catch {
    return null
  }
}

function buildDescription(event: SharedEvent) {
  const parts = [
    event.category.label,
    new Date(event.schedule.start_at).toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }),
    event.location.address ?? null,
  ].filter(Boolean)

  const summary = event.description?.trim()
  if (summary) return `${parts.join(' | ')} | ${summary}`.slice(0, 180)
  return `${parts.join(' | ')} | Open this event in FitMeet.`.slice(0, 180)
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams
  const idParam = params.id
  const id = Array.isArray(idParam) ? idParam[0] : idParam
  const siteUrl = getSiteUrl()
  const shareUrl = id ? `${siteUrl}/events/share?id=${id}` : `${siteUrl}/events/share`
  const imageUrl = `${siteUrl}/logo_full.png`

  if (!id) {
    return {
      title: 'FitMeet Event Share',
      description: 'Open this event in FitMeet.',
      openGraph: {
        title: 'FitMeet Event Share',
        description: 'Open this event in FitMeet.',
        url: shareUrl,
        siteName: 'FitMeet',
        type: 'website',
        images: [{ url: imageUrl }],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'FitMeet Event Share',
        description: 'Open this event in FitMeet.',
        images: [imageUrl],
      },
    }
  }

  const event = await getSharedEvent(id)
  if (!event) {
    return {
      title: 'Event Not Available | FitMeet',
      description: 'This event is not available for public sharing.',
    }
  }

  const title = `${event.title} | FitMeet`
  const description = buildDescription(event)

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: shareUrl,
      siteName: 'FitMeet',
      type: 'article',
      images: [{ url: imageUrl }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  }
}

export default function ShareEventPage() {
  return <ShareEventClientPage />
}
