'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { ChevronLeft, MapPin, MessageCircle, Pencil, CheckCircle2, Trash2, X, Share2 } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import api from '@/lib/api'
import { CATEGORY_EMOJI } from '@/lib/categories'
import { useAuthStore } from '@/store/auth'

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
  is_mine: boolean
  created_at: string
}

const CONDITION_LABEL: Record<string, string> = {
  new: 'New',
  used: 'Used',
  like_new: 'Like new',
}

function ViewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token, user } = useAuthStore()
  const id = searchParams.get('id')

  const [listing, setListing] = useState<MarketListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeImg, setActiveImg] = useState(0)
  const [lightbox, setLightbox]   = useState(false)
  const [acting, setActing] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!token || !id) return
    api.get(`/market/${id}`)
      .then(({ data }) => setListing(data.data))
      .catch(() => setError('Listing not found.'))
      .finally(() => setLoading(false))
  }, [token, id])

  async function handleMessage() {
    if (!listing) return
    router.push(`/messages?user=${listing.seller.id}`)
  }

  async function handleShare() {
    if (!listing || typeof window === 'undefined') return
    const url = `${window.location.origin}/market/share/?id=${encodeURIComponent(String(listing.id))}`
    const priceLabel = listing.price > 0
      ? `${listing.type === 'buy' ? 'up to ' : ''}${listing.price.toFixed(0)} ${listing.currency}`
      : listing.type === 'buy' ? 'Wanted on FitMeet' : 'For sale on FitMeet'
    const text = [priceLabel, listing.description].filter(Boolean).join('\n\n')

    try {
      if (navigator.share) {
        await navigator.share({
          title: listing.title,
          text,
          url,
        })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  async function handleSold() {
    if (!listing || !confirm('Mark this listing as sold?')) return
    setActing(true)
    try {
      await api.post(`/market/${listing.id}/sold`)
      setListing(l => l ? { ...l, status: 'sold' } : l)
    } catch {
      alert('Could not update listing.')
    } finally {
      setActing(false)
    }
  }

  async function handleDelete() {
    if (!listing || !confirm('Delete this listing permanently?')) return
    setActing(true)
    try {
      await api.delete(`/market/${listing.id}`)
      router.back()
    } catch {
      alert('Could not delete listing.')
      setActing(false)
    }
  }

  if (!token) return null

  if (loading) return (
    <>
      <Navbar />
      <main className="min-h-screen py-8 px-4">
        <div className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      </main>
    </>
  )

  if (error || !listing) return (
    <>
      <Navbar />
      <main className="min-h-screen py-8 px-4">
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <button onClick={() => router.back()} className="flex items-center gap-2 mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            <ChevronLeft size={16} /> Back
          </button>
          <p className="text-center py-16" style={{ color: 'var(--text-muted)' }}>{error ?? 'Not found.'}</p>
        </div>
      </main>
    </>
  )

  const emoji = CATEGORY_EMOJI[listing.category.value] ?? '🏷️'
  const canEdit = listing.is_mine || user?.is_admin
  const sold = listing.status === 'sold'

  return (
    <>
      <Navbar />
      <main className="min-h-screen py-8 px-4">
        <div style={{ maxWidth: 680, margin: '0 auto' }} className="space-y-5">

          <button onClick={() => router.back()} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <ChevronLeft size={16} /> Back
          </button>

          {/* Lightbox */}
          {lightbox && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.92)' }}
              onClick={() => setLightbox(false)}
            >
              <button
                className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.12)' }}
                onClick={() => setLightbox(false)}
              >
                <X size={20} color="#fff" />
              </button>
              <div className="relative w-full h-full max-w-4xl max-h-[90vh] m-4">
                <Image src={listing.images[activeImg]} alt={listing.title} fill className="object-contain" unoptimized />
              </div>
            </div>
          )}

          {/* Images */}
          {listing.images.length > 0 ? (
            <div className="space-y-2">
              <button
                className="relative w-full rounded-2xl overflow-hidden cursor-zoom-in"
                style={{ height: 340, background: 'var(--surface)' }}
                onClick={() => setLightbox(true)}
              >
                <Image src={listing.images[activeImg]} alt={listing.title} fill className="object-contain" unoptimized />
                {sold && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
                    <span className="text-2xl font-black px-6 py-3 rounded-2xl border-2" style={{ color: '#f87171', borderColor: '#f87171', background: 'rgba(248,113,113,0.1)' }}>SOLD</span>
                  </div>
                )}
              </button>
              {listing.images.length > 1 && (
                <div className="flex gap-2">
                  {listing.images.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImg(i)}
                      className="relative w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors"
                      style={{ borderColor: activeImg === i ? 'var(--primary)' : 'var(--border)' }}
                    >
                      <Image src={src} alt="" fill className="object-cover" unoptimized />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-48 rounded-2xl flex items-center justify-center text-6xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {emoji}
            </div>
          )}

          {/* Info */}
          <div className="rounded-2xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="space-y-1">
              <h1 className="text-lg font-black leading-snug">{listing.title}</h1>
              <p className="text-2xl font-black" style={{ color: 'var(--primary)' }}>
                {listing.price > 0 ? <>{listing.price.toFixed(0)} <span className="text-base">{listing.currency}</span></> : (listing.type === 'buy' ? 'Wanted' : 'For sale')}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs px-2 py-0.5 rounded-full border font-medium"
                  style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(57,255,20,0.08)' }}>
                  {emoji} {listing.category.label}
                </span>
                {listing.condition && (
                  <span className="text-xs px-2 py-0.5 rounded-full border font-medium" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                    {CONDITION_LABEL[listing.condition]}
                  </span>
                )}
                {sold && (
                  <span className="text-xs px-2 py-0.5 rounded-full border font-medium" style={{ borderColor: '#f87171', color: '#f87171', background: 'rgba(248,113,113,0.08)' }}>
                    Sold
                  </span>
                )}
              </div>
            </div>

            {listing.description && (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{listing.description}</p>
            )}

            {(listing.location.city || listing.location.country) && (
              <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                <MapPin size={14} />
                {[listing.location.city, listing.location.country].filter(Boolean).join(', ')}
              </div>
            )}

            {/* Seller */}
            <div className="flex items-center gap-3 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-black text-sm"
                style={{ background: 'var(--primary)', color: '#000' }}>
                {listing.seller.avatar
                  ? <Image src={listing.seller.avatar} alt="" width={36} height={36} className="object-cover" />
                  : listing.seller.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Seller</p>
                <p className="font-bold text-sm truncate">{listing.seller.name}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border font-bold text-sm transition-opacity hover:opacity-80"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'var(--background)' }}
              >
                <Share2 size={15} /> {copied ? 'Copied' : 'Share'}
              </button>
              {!listing.is_mine && !sold && (
                <button
                  onClick={handleMessage}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-opacity hover:opacity-80"
                  style={{ background: 'var(--primary)', color: '#000' }}
                >
                  <MessageCircle size={16} /> Message seller
                </button>
              )}
              {listing.is_mine && !sold && (
                <>
                  <button
                    onClick={() => router.push(`/market/create?id=${listing.id}`)}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border font-bold text-sm transition-opacity hover:opacity-80"
                    style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                  >
                    <Pencil size={15} /> Edit
                  </button>
                  <button
                    onClick={handleSold}
                    disabled={acting}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-opacity hover:opacity-80 disabled:opacity-40"
                    style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80' }}
                  >
                    <CheckCircle2 size={15} /> Mark as sold
                  </button>
                </>
              )}
              {canEdit && (
                <button
                  onClick={handleDelete}
                  disabled={acting}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border font-bold text-sm transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ borderColor: 'rgba(248,113,113,0.3)', color: '#f87171', background: 'rgba(248,113,113,0.08)' }}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>

        </div>
      </main>
    </>
  )
}

export default function ViewListingPage() {
  return (
    <Suspense fallback={null}>
      <ViewContent />
    </Suspense>
  )
}
