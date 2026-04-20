'use client'

import dynamic from 'next/dynamic'

const HeroMapDynamic = dynamic(() => import('./hero-map').then(m => m.HeroMap), { ssr: false })

export function HeroMapClient() {
  return <HeroMapDynamic />
}
