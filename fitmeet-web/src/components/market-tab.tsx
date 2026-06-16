'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { MapPin, Tag, Plus } from 'lucide-react'

import api from '@/lib/api'
import { CATEGORIES, CATEGORY_EMOJI } from '@/lib/categories'
import { useAuthStore } from '@/store/auth'

interface MarketListing {
  id: number
  title: string
  price: number
  currency: string
  condition: 'new' | 'used' | 'like_new'
  category: { value: string; label: string }
  status: string
  location: { city: string | null; country: string | null }
  images: string[]
  seller: { id: number; name: string; avatar: string | null }
  is_mine: boolean
  created_at: string
}

const CONDITION_LABEL: Record<string, string> = {
  new: 'New',
  used: 'Used',
  like_new: 'Like new',
}

const CONDITION_COLOR: Record<string, string> = {
  new: '#4ade80',
  like_new: 'var(--primary)',
  used: 'var(--text-muted)',
}

export function MarketTab() {
  const router = useRouter()
  const { token } = useAuthStore()
  const [listings, setListings] = useState<MarketListing[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')

  useEffect(() => {
    if (!token) return
    setLoading(true)
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    api.get(`/market?${params}`)
      .then(({ data }) => setListings(data.data ?? []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false))
  }, [token, category])

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategory('')}
            className="text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors"
            style={{
              borderColor: !category ? 'var(--primary)' : 'var(--border)',
              color: !category ? 'var(--primary)' : 'var(--text-muted)',
              background: !category ? 'rgba(57,255,20,0.08)' : 'transparent',
            }}
          >
            All
          </button>
          {CATEGORIES.slice(0, 8).map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value === category ? '' : cat.value)}
              className="text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors"
              style={{
                borderColor: category === cat.value ? 'var(--primary)' : 'var(--border)',
                color: category === cat.value ? 'var(--primary)' : 'var(--text-muted)',
                background: category === cat.value ? 'rgba(57,255,20,0.08)' : 'transparent',
              }}
            >
              {CATEGORY_EMOJI[cat.value]} {cat.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => router.push('/market/create')}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-bold flex-shrink-0 transition-opacity hover:opacity-80"
          style={{ background: 'var(--primary)', color: '#000' }}
        >
          <Plus size={14} /> Sell
        </button>
      </div>

      {/* Listings */}
      {loading ? (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-3xl">🏪</p>
          <p className="font-bold">No listings yet</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Be the first to sell your sports gear.</p>
          <button
            onClick={() => router.push('/market/create')}
            className="mx-auto flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl font-bold transition-opacity hover:opacity-80"
            style={{ background: 'var(--primary)', color: '#000' }}
          >
            <Plus size={15} /> List something
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {listings.map(listing => (
            <button
              key={listing.id}
              onClick={() => router.push(`/market/view?id=${listing.id}`)}
              className="text-left rounded-2xl border overflow-hidden transition-opacity hover:opacity-80"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              {/* Image */}
              <div className="relative w-full h-44 bg-black" style={{ background: 'var(--surface-raised)' }}>
                {listing.images[0] ? (
                  <Image src={listing.images[0]} alt={listing.title} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl">
                    {CATEGORY_EMOJI[listing.category.value] ?? '🏷️'}
                  </div>
                )}
                <span
                  className="absolute top-2 left-2 text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(5,8,22,0.82)', color: CONDITION_COLOR[listing.condition] }}
                >
                  {CONDITION_LABEL[listing.condition]}
                </span>
              </div>

              {/* Info */}
              <div className="p-3 space-y-1.5">
                <p className="font-bold text-sm truncate">{listing.title}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-black" style={{ color: 'var(--primary)' }}>
                    {listing.price.toFixed(0)} {listing.currency}
                  </span>
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Tag size={11} /> {listing.category.label}
                  </span>
                </div>
                {(listing.location.city || listing.location.country) && (
                  <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <MapPin size={11} />
                    {[listing.location.city, listing.location.country].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
