import Link from 'next/link'
import { ArrowLeft, MapPin, MessageCircle } from 'lucide-react'
import type { Metadata } from 'next'

import { Navbar } from '@/components/navbar'
import { CATEGORY_EMOJI } from '@/lib/categories'
import { CONDITION_LABEL, getPublicListings, place, priceLabel } from '@/lib/market-public'

// Public listing page, built at deploy time from the public API (HTML contains the listing).
// Listings posted after the last build are reachable via /market/share/?id= until the next deploy.
export const dynamicParams = false

export async function generateStaticParams() {
  const listings = await getPublicListings(60)
  // static export needs at least one path
  return listings.length ? listings.map(l => ({ id: String(l.id) })) : [{ id: '0' }]
}

async function find(id: string) {
  return (await getPublicListings(60)).find(l => String(l.id) === id) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const l = await find(id)
  if (!l) return { title: 'Listing not available | FitMeet Marketplace', robots: { index: false } }
  const desc = (l.description ?? '').replace(/\s+/g, ' ').slice(0, 155)
  return {
    title: `${l.title} — ${priceLabel(l)} | FitMeet Marketplace`,
    description: desc || `${l.category.label} ${l.type === 'buy' ? 'wanted' : 'for sale'}${place(l) ? ' in ' + place(l) : ''}.`,
    alternates: { canonical: `https://fitmeet.fit/market/item/${l.id}/` },
    openGraph: { title: l.title, description: desc, images: l.images[0] ? [l.images[0]] : undefined },
    robots: l.status === 'sold' ? { index: false, follow: true } : undefined,
  }
}

export default async function MarketItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const l = await find(id)

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
          <Link href="/market" className="inline-flex items-center gap-2 text-sm mb-6 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft size={14} /> Marketplace
          </Link>

          {!l ? (
            <p className="py-16 text-center" style={{ color: 'var(--text-muted)' }}>This listing is no longer available. <Link href="/market" className="underline">Browse the marketplace</Link>.</p>
          ) : (
            <article className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <div className="relative flex items-center justify-center text-7xl" style={{ background: 'var(--background)', height: l.images[0] ? 420 : 220 }}>
                {l.images[0]
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={l.images[0]} alt={l.title} className="absolute inset-0 w-full h-full object-contain" />
                  : (CATEGORY_EMOJI[l.category.value] ?? '🏷️')}
              </div>
              {l.images.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {l.images.slice(1, 6).map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={src} alt={`${l.title} photo ${i + 2}`} className="h-20 w-28 rounded-lg object-cover shrink-0" loading="lazy" />
                  ))}
                </div>
              )}
              <div className="p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full border px-2.5 py-1" style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}>{CATEGORY_EMOJI[l.category.value] ?? '🏷️'} {l.category.label}</span>
                  <span className="rounded-full border px-2.5 py-1" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>{l.type === 'buy' ? 'Wanted' : 'For sale'}</span>
                  {l.condition && <span className="rounded-full border px-2.5 py-1" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>{CONDITION_LABEL[l.condition]}</span>}
                  {l.status === 'sold' && <span className="rounded-full border px-2.5 py-1" style={{ borderColor: '#f87171', color: '#f87171' }}>Sold</span>}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold leading-tight">{l.title}</h1>
                <p className="text-3xl font-black">{priceLabel(l)}</p>
                {place(l) && <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}><MapPin size={14} /> {place(l)}</p>}
                {l.description && (
                  <div className="text-base leading-relaxed whitespace-pre-line pt-2 border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>{l.description}</div>
                )}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Link href={`/market/view?id=${l.id}`} className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold">
                    <MessageCircle size={15} /> Contact {l.seller.name.split(' ')[0]}
                  </Link>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Sign in required to message the seller.</span>
                </div>
              </div>
            </article>
          )}
        </div>
      </main>
    </>
  )
}
