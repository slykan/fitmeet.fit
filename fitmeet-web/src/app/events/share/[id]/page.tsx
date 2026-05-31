import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import ShareEventClientPage from '../share-client'
import {
  FALLBACK_DESCRIPTION,
  FALLBACK_IMAGE,
  FALLBACK_TITLE,
  buildDescription,
  buildEventJsonLd,
  getPublicShareEvents,
  getShareEvent,
} from '../share-seo'

type EventSharePathProps = {
  params: Promise<{ id: string }>
}

export const dynamicParams = false

export async function generateStaticParams() {
  const events = await getPublicShareEvents(20)
  return events.map((event) => ({ id: String(event.id) }))
}

export async function generateMetadata({ params }: EventSharePathProps): Promise<Metadata> {
  const { id } = await params
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
  const canonicalUrl = `https://fitmeet.fit/events/share/${event.id}`

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
      type: 'website',
      images: [{ url: event.image_url ?? FALLBACK_IMAGE }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [event.image_url ?? FALLBACK_IMAGE],
    },
  }
}

export default async function EventSharePathPage({ params }: EventSharePathProps) {
  const { id } = await params
  const event = await getShareEvent(id)

  if (!event) notFound()

  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildEventJsonLd(event)) }}
      />
      <ShareEventClientPage id={id} initialEvent={event} />
    </>
  )
}
