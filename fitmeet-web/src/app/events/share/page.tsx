import type { Metadata } from 'next'

import ShareEventClientPage from './share-client'

export const metadata: Metadata = {
  title: 'FitMeet — Join this event',
  description: 'Open this event in FitMeet and see who\'s going.',
  openGraph: {
    title: 'FitMeet — Join this event',
    description: 'Open this event in FitMeet and see who\'s going.',
    siteName: 'FitMeet',
    type: 'website',
    images: [{ url: 'https://fitmeet.fit/logo_full.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FitMeet — Join this event',
    description: 'Open this event in FitMeet and see who\'s going.',
    images: ['https://fitmeet.fit/logo_full.png'],
  },
}

export default function ShareEventPage() {
  return <ShareEventClientPage />
}
