'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { MapPin, Plus, ChevronDown, Search } from 'lucide-react'

import api from '@/lib/api'
import { CATEGORIES, CATEGORY_EMOJI } from '@/lib/categories'
import { useAuthStore } from '@/store/auth'

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
  seller: { id: number; name: string; avatar: string | null }
  is_mine: boolean
}

const CONDITION_LABEL: Record<string, string> = { new: 'New', used: 'Used', like_new: 'Like new' }
const CONDITION_COLOR: Record<string, string> = {
  new: '#4ade80',
  like_new: 'var(--primary)',
  used: 'var(--text-muted)',
}

type ListingType = '' | 'sell' | 'buy'
type Condition   = '' | 'new' | 'used' | 'like_new'

export function MarketTab() {
  const router = useRouter()
  const { token } = useAuthStore()

  const [listings,  setListings]  = useState<MarketListing[]>([])
  const [loading,   setLoading]   = useState(true)
  const [typeFilter, setType]     = useState<ListingType>('')
  const [category,  setCategory]  = useState('')
  const [condition, setCondition] = useState<Condition>('')
  const [showCats,  setShowCats]  = useState(false)
  const [search,    setSearch]    = useState('')
  const [searchQ,   setSearchQ]   = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setSearchQ(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!token) return
    setLoading(true)
    const params = new URLSearchParams()
    if (typeFilter)  params.set('type',      typeFilter)
    if (category)    params.set('category',  category)
    if (condition)   params.set('condition', condition)
    if (searchQ)     params.set('search',    searchQ)
    api.get(`/market?${params}`)
      .then(({ data }) => setListings(data.data ?? []))
      .catch(() => setListings([]))
      .finally(() => setLoading(false))
  }, [token, typeFilter, category, condition, searchQ])

  const activeCat = CATEGORIES.find(c => c.value === category)

  return (
    <div className="space-y-4">

      {/* Top row: S/B toggle + Sell button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {([['', 'All'], ['sell', 'Selling'], ['buy', 'Buying']] as [ListingType, string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setType(v)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg transition-colors"
              style={{
                background: typeFilter === v ? 'var(--primary)' : 'transparent',
                color:      typeFilter === v ? '#000' : 'var(--text-muted)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => router.push('/market/create')}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl font-bold flex-shrink-0 transition-opacity hover:opacity-80"
          style={{ background: 'var(--primary)', color: '#000' }}
        >
          <Plus size={14} /> Post
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search title or description…"
          className="w-full rounded-xl border pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[--primary] transition-colors"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* Filter row: Category + Condition */}
      <div className="flex flex-wrap gap-2">
        {/* Category dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowCats(v => !v)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors"
            style={{
              borderColor: category ? 'var(--primary)' : 'var(--border)',
              color:       category ? 'var(--primary)' : 'var(--text-muted)',
              background:  category ? 'rgba(57,255,20,0.08)' : 'transparent',
            }}
          >
            {category ? `${CATEGORY_EMOJI[category]} ${activeCat?.label}` : 'Category'}
            <ChevronDown size={11} />
          </button>
          {showCats && (
            <div
              className="absolute top-full left-0 mt-1 z-50 rounded-xl border p-2 flex flex-col gap-0.5 min-w-[160px] max-h-72 overflow-y-auto"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
            >
              <button
                onClick={() => { setCategory(''); setShowCats(false) }}
                className="text-left px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors hover:opacity-80"
                style={{ color: !category ? 'var(--primary)' : 'var(--text-muted)', background: !category ? 'rgba(57,255,20,0.08)' : 'transparent' }}
              >
                All categories
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => { setCategory(cat.value); setShowCats(false) }}
                  className="text-left px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors hover:opacity-80"
                  style={{
                    color:      category === cat.value ? 'var(--primary)' : 'var(--text-muted)',
                    background: category === cat.value ? 'rgba(57,255,20,0.08)' : 'transparent',
                  }}
                >
                  {CATEGORY_EMOJI[cat.value]} {cat.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Condition chips — only relevant for sell */}
        {typeFilter !== 'buy' && (
          <>
            {([['', 'Any'], ['new', 'New'], ['like_new', 'Like new'], ['used', 'Used']] as [Condition, string][]).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setCondition(v)}
                className="text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors"
                style={{
                  borderColor: condition === v ? 'var(--primary)' : 'var(--border)',
                  color:       condition === v ? 'var(--primary)' : 'var(--text-muted)',
                  background:  condition === v ? 'rgba(57,255,20,0.08)' : 'transparent',
                }}
              >
                {label}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-3xl">🏪</p>
          <p className="font-bold">No listings yet</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {typeFilter === 'buy' ? 'No one is looking for anything yet.' : 'Be the first to sell your sports gear.'}
          </p>
          <button
            onClick={() => router.push('/market/create')}
            className="mx-auto flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl font-bold transition-opacity hover:opacity-80"
            style={{ background: 'var(--primary)', color: '#000' }}
          >
            <Plus size={15} /> {typeFilter === 'buy' ? 'Post a request' : 'List something'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {listings.map(listing => (
            <button
              key={listing.id}
              onClick={() => router.push(`/market/view?id=${listing.id}`)}
              className="text-left rounded-2xl border overflow-hidden transition-opacity hover:opacity-80"
              style={{ background: 'var(--surface)', borderColor: listing.type === 'buy' ? 'rgba(96,165,250,0.35)' : 'var(--border)' }}
            >
              {listing.type === 'buy' ? (
                /* Buy request card — no image, different look */
                <div className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>WANTED</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{listing.category.label}</span>
                  </div>
                  <p className="font-bold text-sm">{listing.title}</p>
                  {listing.price > 0 && (
                    <p className="text-sm font-black" style={{ color: '#60a5fa' }}>up to {listing.price.toFixed(0)} {listing.currency}</p>
                  )}
                  {(listing.location.city || listing.location.country) && (
                    <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <MapPin size={11} /> {[listing.location.city, listing.location.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              ) : (
                /* Sell card — with image */
                <>
                  <div className="relative w-full h-44" style={{ background: 'var(--surface-raised)' }}>
                    {listing.images[0] ? (
                      <Image src={listing.images[0]} alt={listing.title} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        {CATEGORY_EMOJI[listing.category.value] ?? '🏷️'}
                      </div>
                    )}
                    {listing.condition && (
                      <span className="absolute top-2 left-2 text-[10px] font-black px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(5,8,22,0.82)', color: CONDITION_COLOR[listing.condition] }}>
                        {CONDITION_LABEL[listing.condition]}
                      </span>
                    )}
                  </div>
                  <div className="p-3 space-y-1.5">
                    <p className="font-bold text-sm truncate">{listing.title}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-black" style={{ color: 'var(--primary)' }}>
                        {listing.price.toFixed(0)} {listing.currency}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {CATEGORY_EMOJI[listing.category.value]} {listing.category.label}
                      </span>
                    </div>
                    {(listing.location.city || listing.location.country) && (
                      <p className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                        <MapPin size={11} /> {[listing.location.city, listing.location.country].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
