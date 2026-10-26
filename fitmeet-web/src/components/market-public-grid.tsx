'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin } from 'lucide-react'

import { CATEGORY_EMOJI } from '@/lib/categories'
import { apiBase, CONDITION_LABEL, place, priceLabel, type PublicListing } from '@/lib/market-public'

// Public marketplace grid: starts with the listings baked in at build time (crawlers see them),
// then refreshes from the public API so visitors always get the latest. No login needed.
export function MarketPublicGrid({ initial, builtIds }: { initial: PublicListing[]; builtIds: number[] }) {
  const [listings, setListings] = useState(initial)
  const [filter, setFilter] = useState<'all' | 'sell' | 'buy'>('all')

  useEffect(() => {
    fetch(`${apiBase()}/market/public-latest?limit=60`, { headers: { Accept: 'application/json' } })
      .then(r => (r.ok ? r.json() : null))
      .then(p => { if (p?.data) setListings(p.data) })
      .catch(() => {})
  }, [])

  const built = new Set(builtIds)
  const shown = listings.filter(l => filter === 'all' || l.type === filter)

  return (
    <>
      <div className="flex gap-2 mb-6">
        {(['all', 'sell', 'buy'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className="px-4 h-9 rounded-full text-sm font-semibold border"
            style={{ borderColor: filter === f ? 'var(--primary)' : 'var(--border)', background: filter === f ? 'rgba(57,255,20,0.1)' : 'transparent', color: filter === f ? 'var(--primary)' : 'var(--text-muted)' }}>
            {f === 'all' ? 'All' : f === 'sell' ? 'For sale' : 'Wanted'}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>No listings right now — be the first to post one.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map(l => (
            <Link key={l.id} href={built.has(l.id) ? `/market/item/${l.id}` : `/market/share/?id=${l.id}`}
              className="rounded-2xl border overflow-hidden flex flex-col transition-opacity hover:opacity-85" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="relative h-44 flex items-center justify-center text-5xl" style={{ background: 'var(--background)' }}>
                {l.images[0]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={l.images[0]} alt={l.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                  : (CATEGORY_EMOJI[l.category.value] ?? '🏷️')}
                {l.status === 'sold' && <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md text-xs font-black" style={{ background: '#f87171', color: '#000' }}>SOLD</span>}
              </div>
              <div className="p-4 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>{l.type === 'buy' ? 'Wanted · ' : ''}{l.category.label}</span>
                  {l.condition && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{CONDITION_LABEL[l.condition]}</span>}
                </div>
                <h2 className="font-bold leading-snug line-clamp-2">{l.title}</h2>
                <p className="text-lg font-black">{priceLabel(l)}</p>
                {place(l) && <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><MapPin size={12} /> {place(l)}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
