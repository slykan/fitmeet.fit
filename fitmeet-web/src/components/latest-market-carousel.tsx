'use client'

import { useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, MapPin, Tag } from 'lucide-react'
import { CATEGORY_EMOJI } from '@/lib/categories'

interface MarketListing {
  id: number
  type: 'sell' | 'buy'
  title: string
  price: number
  currency: string
  condition: 'new' | 'used' | 'like_new' | null
  category: { value: string; label: string }
  status: string
  location: { city: string | null; country: string | null }
  images: string[]
  seller: { id: number; name: string }
}

const CONDITION_LABEL: Record<string, string> = { new: 'New', used: 'Used', like_new: 'Like new' }
const CONDITION_COLOR: Record<string, string> = {
  new:      '#4ade80',
  like_new: '#6cff2f',
  used:     '#94a3b8',
}

export function LatestMarketCarousel({ listings }: { listings: MarketListing[] }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  function scrollByAmount(direction: 'left' | 'right') {
    const scroller = scrollerRef.current
    if (!scroller) return
    const amount = Math.round(scroller.clientWidth * 0.9)
    scroller.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  if (listings.length === 0) return null

  const href = (id: number) => `/login?redirect=${encodeURIComponent(`/market/view?id=${id}`)}`

  return (
    <section className="py-12 md:py-14 border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--primary)' }}>
              Marketplace
            </p>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              A real look at what athletes near you are selling.
            </h2>
            <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Sports gear posted by the community — bikes, shoes, kit and more. Sign in to message a seller or post your own listing.
            </p>
          </div>

          <div className="hidden md:flex items-center gap-2 shrink-0">
            <button
              type="button"
              aria-label="Scroll left"
              onClick={() => scrollByAmount('left')}
              className="w-10 h-10 rounded-full border flex items-center justify-center transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Scroll right"
              onClick={() => scrollByAmount('right')}
              className="w-10 h-10 rounded-full border flex items-center justify-center transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
        >
          {listings.map((listing) => {
            const emoji = CATEGORY_EMOJI[listing.category.value] ?? '🏷️'
            const isBuy = listing.type === 'buy'

            return (
              <Link
                key={listing.id}
                href={href(listing.id)}
                className="group snap-start shrink-0 w-[17rem] sm:w-[19rem] rounded-2xl border overflow-hidden transition-transform hover:-translate-y-0.5"
                style={{
                  background: 'var(--surface)',
                  borderColor: isBuy ? 'rgba(96,165,250,0.35)' : 'var(--border)',
                }}
              >
                {isBuy ? (
                  /* Buy / Wanted card */
                  <div className="p-5 flex flex-col gap-3 h-full min-h-[13rem]">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[10px] font-black px-2.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}
                      >
                        WANTED
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {emoji} {listing.category.label}
                      </span>
                    </div>
                    <p className="font-semibold leading-snug line-clamp-3 group-hover:opacity-80">
                      {listing.title}
                    </p>
                    {listing.price > 0 && (
                      <p className="text-base font-black" style={{ color: '#60a5fa' }}>
                        up to {listing.price.toFixed(0)} {listing.currency}
                      </p>
                    )}
                    {(listing.location.city || listing.location.country) && (
                      <div className="flex items-center gap-1.5 text-xs mt-auto" style={{ color: 'var(--text-muted)' }}>
                        <MapPin size={11} />
                        {[listing.location.city, listing.location.country].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Sell card — with image */
                  <>
                    <div className="relative w-full h-44" style={{ background: 'var(--background)' }}>
                      {listing.images[0] ? (
                        <Image
                          src={listing.images[0]}
                          alt={listing.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl">
                          {emoji}
                        </div>
                      )}
                      {listing.condition && (
                        <span
                          className="absolute top-2 left-2 text-[10px] font-black px-2.5 py-0.5 rounded-full"
                          style={{
                            background: 'rgba(5,8,22,0.8)',
                            color: CONDITION_COLOR[listing.condition],
                          }}
                        >
                          {CONDITION_LABEL[listing.condition]}
                        </span>
                      )}
                    </div>
                    <div className="p-4 space-y-2">
                      <p className="font-semibold leading-snug line-clamp-2 group-hover:opacity-80">
                        {listing.title}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-lg font-black" style={{ color: 'var(--primary)' }}>
                          {listing.price.toFixed(0)}{' '}
                          <span className="text-sm font-semibold">{listing.currency}</span>
                        </span>
                        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <Tag size={11} /> {listing.category.label}
                        </span>
                      </div>
                      {(listing.location.city || listing.location.country) && (
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <MapPin size={11} />
                          {[listing.location.city, listing.location.country].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
