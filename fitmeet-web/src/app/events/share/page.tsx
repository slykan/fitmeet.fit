import type { Metadata } from 'next'

import ShareEventClientPage from './share-client'
import { FALLBACK_DESCRIPTION, FALLBACK_IMAGE, FALLBACK_TITLE } from './share-seo'

export const metadata: Metadata = {
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

export default function ShareEventPage() {
  return <ShareEventClientPage id={null} initialEvent={null} />
}
