'use client'

import { Suspense, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { MapPin, Tag } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import { Button } from '@/components/ui/button'
import { CATEGORY_EMOJI } from '@/lib/categories'

interface MarketListing {
  id: number
  type: 'sell' | 'buy'
  title: string
  description: string | null
  price: number
  currency: string
  condition: 'new' | 'used' | 'like_new' | null
  category: { value: string; label: string }
  status: string
  location: { city: string | null; country: string | null }
  images: string[]
  seller: { id: number; name: string; avatar: string | null }
  created_at: string
}

const CONDITION_LABEL: Record<string, string> = {
  new: 'New',
  used: 'Used',
  like_new: 'Like new',
}

function priceLabel(listing: MarketListing) {
  if (listing.price <= 0) return listing.type === 'buy' ? 'Wanted' : 'For sale'
  return `${listing.type === 'buy' ? 'up to ' : ''}${listing.price.toFixed(0)} ${listing.currency}`
}

function MarketShareContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const [listing, setListing] = useState<MarketListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setError('Listing not found.')
      setLoading(false)
      return
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.fitmeet.fit/api'
    fetch(`${apiBase}/market/public/${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Listing not found.')
        return response.json()
      })
      .then((payload) => setListing(payload.data ?? null))
      .catch(() => setError('This listing is not available.'))
      .finally(() => setLoading(false))
  }, [id])

  const image = listing?.images[0]
  const emoji = listing ? CATEGORY_EMOJI[listing.category.value] ?? '🏷️' : '🏷️'
  const sold = listing?.status === 'sold'

  return (
    <>
      <Navbar />
      <main className="min-h-screen py-8 px-4">
        <div className="mx-auto max-w-3xl space-y-5">
          {loading && <div className="py-20 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>}

          {!loading && error && (
            <div className="py-20 text-center">
              <p className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>
              <Link href="/"><Button variant="ghost">Back home</Button></Link>
            </div>
          )}

          {listing && (
            <>
              <section className="overflow-hidden rounded-2xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                {image ? (
                  <div className="relative h-[280px] sm:h-[420px]" style={{ background: 'var(--background)' }}>
                    <Image src={image} alt={listing.title} fill className="object-contain" unoptimized priority />
                    {sold && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
                        <span className="rounded-2xl border-2 px-6 py-3 text-2xl font-black" style={{ color: '#f87171', borderColor: '#f87171', background: 'rgba(248,113,113,0.1)' }}>
                          SOLD
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-[220px] items-center justify-center text-6xl" style={{ background: 'var(--background)' }}>
                    {emoji}
                  </div>
                )}

                <div className="space-y-4 p-5 sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(57,255,20,0.08)' }}>
                          {emoji} {listing.category.label}
                        </span>
                        {listing.condition && (
                          <span className="rounded-full border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                            {CONDITION_LABEL[listing.condition]}
                          </span>
                        )}
                        {sold && (
                          <span className="rounded-full border px-2.5 py-1 text-xs font-semibold" style={{ borderColor: '#f87171', color: '#f87171', background: 'rgba(248,113,113,0.08)' }}>
                            Sold
                          </span>
                        )}
                      </div>
                      <h1 className="text-2xl font-black leading-tight sm:text-3xl">{listing.title}</h1>
                    </div>
                    <p className="text-3xl font-black sm:text-right" style={{ color: 'var(--primary)' }}>
                      {priceLabel(listing)}
                    </p>
                  </div>

                  {listing.description && (
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {listing.description}
                    </p>
                  )}

                  <div className="grid gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {(listing.location.city || listing.location.country) && (
                      <div className="flex items-center gap-2">
                        <MapPin size={15} style={{ color: 'var(--primary)' }} />
                        <span>{[listing.location.city, listing.location.country].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Tag size={15} style={{ color: 'var(--primary)' }} />
                      <span>Seller: {listing.seller.name}</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div>
                  <p className="font-semibold">Open this listing in FitMeet</p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                    Sign in to message the seller or manage your marketplace listings.
                  </p>
                </div>
                <Link href={`/login?redirect=${encodeURIComponent(`/market/view?id=${listing.id}`)}`}>
                  <Button>Open Listing</Button>
                </Link>
              </section>
            </>
          )}
        </div>
      </main>
    </>
  )
}

export default function MarketSharePage() {
  return (
    <Suspense fallback={null}>
      <MarketShareContent />
    </Suspense>
  )
}
