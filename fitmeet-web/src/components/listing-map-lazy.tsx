'use client'

import dynamic from 'next/dynamic'

// Leaflet needs the browser; server components (the static listing page) use this wrapper.
export const ListingMapLazy = dynamic(() => import('@/components/listing-map'), { ssr: false })
