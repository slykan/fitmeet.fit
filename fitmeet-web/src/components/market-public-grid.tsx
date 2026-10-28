'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin, Share2, X } from 'lucide-react'

import { CATEGORY_EMOJI } from '@/lib/categories'
import { apiBase, CONDITION_LABEL, place, priceLabel, type PublicListing } from '@/lib/market-public'

// Public marketplace grid: starts with the listings baked in at build time (crawlers see them),
// then refreshes from the public API so visitors always get the latest. No login needed.
// /market?seller=ID&sellerName=… shows one seller's listings ("All ads by …" on a listing).
export function MarketPublicGrid({ initial, builtIds }: { initial: PublicListing[]; builtIds: number[] }) {
  const [listings, setListings] = useState(initial)
  const [filter, setFilter] = useState<'all' | 'sell' | 'buy'>('all')
  const [seller, setSeller] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    // static export: query string is read in the browser, not at build time
    const q = new URLSearchParams(window.location.search)
    const id = q.get('seller')
    if (id) setSeller({ id, name: q.get('sellerName') ?? '' })
    fetch(`${apiBase()}/market/public-latest?limit=60${id ? `&seller=${encodeURIComponent(id)}` : ''}`, { headers: { Accept: 'application/json' } })
      .then(r => (r.ok ? r.json() : null))
      .then(p => { if (p?.data) setListings(p.data) })
      .catch(() => {})
  }, [])

  const [copied, setCopied] = useState(false)

  // Share this page (whole marketplace, or one seller's ads): phone share sheet, otherwise copy the link
  async function share() {
    const name = seller ? (seller.name || listings[0]?.seller.name || '') : ''
    const url = seller
      ? `https://fitmeet.fit/market/?seller=${encodeURIComponent(seller.id)}&sellerName=${encodeURIComponent(name)}`
      : 'https://fitmeet.fit/market/'
    const title = seller ? `Ads by ${name} – FitMeet Marketplace` : 'FitMeet Marketplace'
    const text = seller
      ? `Bikes and sports gear for sale by ${name}. See all listings on FitMeet.`
      : 'Sports gear from people near you – bikes, running gear, SUP boards and more. Browse free on FitMeet.'
    try {
      if (navigator.share) { await navigator.share({ title, text, url }); return }
    } catch { return } // share sheet closed
    try {
      await navigator.clipboard.writeText(`${title}\n${text}\n${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const built = new Set(builtIds)
  const shown = listings.filter(l => (filter === 'all' || l.type === filter) && (!seller || String(l.seller.id) === seller.id))

  return (
    <>
      {seller && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span style={{ color: 'var(--text-muted)' }}>Ads by</span>
          <a href="/market" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs"
            style={{ background: 'rgba(57,255,20,0.12)', border: '1px solid var(--primary)', color: 'var(--primary)' }} title="Show all listings">
            {seller.name || listings[0]?.seller.name || 'this seller'} <X size={12} />
          </a>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {(['all', 'sell', 'buy'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className="px-4 h-9 rounded-full text-sm font-semibold border"
            style={{ borderColor: filter === f ? 'var(--primary)' : 'var(--border)', background: filter === f ? 'rgba(57,255,20,0.1)' : 'transparent', color: filter === f ? 'var(--primary)' : 'var(--text-muted)' }}>
            {f === 'all' ? 'All' : f === 'sell' ? 'For sale' : 'Wanted'}
          </button>
        ))}
        <button onClick={share} className="ml-auto inline-flex items-center gap-2 px-4 h-9 rounded-full text-sm font-semibold border transition-opacity hover:opacity-80"
          style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
          <Share2 size={14} /> {copied ? 'Link copied' : 'Share'}
        </button>
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
