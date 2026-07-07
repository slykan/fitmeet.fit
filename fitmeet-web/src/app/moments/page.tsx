'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Share2, X, ArrowRight, Play, Flag } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import api from '@/lib/api'
import { reportContent } from '@/lib/moderation'

interface Moment {
  id: number
  title: string
  image_url: string
  cover?: { x: number; y: number } | null
  category: string | null
  start_at: string
}

const CAT_EMOJI: Record<string, string> = {
  running:'🏃', cycling:'🚴', hiking:'🥾', swimming:'🏊', football:'⚽',
  basketball:'🏀', tennis:'🎾', volleyball:'🏐', yoga:'🧘', fitness:'💪',
  martial_arts:'🥊', climbing:'🧗', skiing:'⛷️', skating:'⛸️', surfing:'🏄',
  golf:'⛳', social:'🎉', other:'📅',
}

export default function MomentsPage() {
  const [moments, setMoments] = useState<Moment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [lightbox, setLightbox] = useState<Moment | null>(null)

  const load = useCallback(async (p: number) => {
    if (p === 1) setLoading(true); else setLoadingMore(true)
    try {
      const r = await api.get(`/moments?page=${p}`)
      setMoments(prev => p === 1 ? r.data.data : [...prev, ...r.data.data])
      setHasMore(r.data.has_more)
      setPage(p)
    } catch {}
    finally { setLoading(false); setLoadingMore(false) }
  }, [])

  useEffect(() => { load(1) }, [load])

  function handleShare() {
    const url = 'https://fitmeet.fit/moments'
    if (navigator.share) {
      navigator.share({ title: 'FitMeet Moments', text: 'Real people, real events 📸', url })
    } else {
      navigator.clipboard.writeText(url)
        .then(() => alert('Link copied!'))
        .catch(() => {})
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black">Moments</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Real events, real people</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
              Event organizers can add one photo after each event ends.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/moments/slideshow"
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'rgba(57,255,20,0.15)', border: '1px solid rgba(57,255,20,0.4)', color: 'var(--primary)' }}
            >
              <Play size={15} /> Play
            </Link>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.25)', color: 'var(--primary)' }}
            >
              <Share2 size={15} /> Share
            </button>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          </div>
        ) : moments.length === 0 ? (
          <p className="text-center py-20 text-sm" style={{ color: 'var(--text-muted)' }}>
            No moments yet. Events with photos will appear here.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1 sm:gap-2">
              {moments.map(m => (
                <button
                  key={m.id}
                  onClick={() => setLightbox(m)}
                  className="relative aspect-square rounded-xl overflow-hidden group"
                  style={{ background: 'var(--surface)' }}
                >
                  <Image
                    src={m.image_url}
                    alt={m.title}
                    fill
                    sizes="(max-width: 768px) 33vw, 280px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    style={{
                      objectPosition: `${(m.cover?.x ?? 0.5) * 100}% ${(m.cover?.y ?? 0.5) * 100}%`,
                    }}
                  />
                  {m.category && (
                    <span className="absolute bottom-1.5 left-1.5 text-xs px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(0,0,0,0.6)' }}>
                      {CAT_EMOJI[m.category] ?? '📅'}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => load(page + 1)}
                  disabled={loadingMore}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.25)', color: 'var(--primary)' }}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full"
            style={{ background: 'rgba(255,255,255,0.1)' }}
            onClick={() => setLightbox(null)}
          >
            <X size={20} />
          </button>

          <div
            className="relative w-full max-w-2xl"
            style={{ height: '70vh' }}
            onClick={e => e.stopPropagation()}
          >
            <Image
              src={lightbox.image_url}
              alt={lightbox.title}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>

          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl mt-4 mx-4 w-full max-w-2xl"
            style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={e => e.stopPropagation()}
          >
            <span className="text-3xl shrink-0">{CAT_EMOJI[lightbox.category ?? ''] ?? '📅'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{lightbox.title}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {new Date(lightbox.start_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <button
              onClick={() => reportContent('event', lightbox.id)}
              title="Report photo"
              className="p-2 rounded-full transition-opacity hover:opacity-80 shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              <Flag size={18} />
            </button>
            <Link
              href={`/events/view?id=${lightbox.id}`}
              onClick={() => setLightbox(null)}
              className="p-2 rounded-full transition-opacity hover:opacity-80 shrink-0"
              style={{ color: 'var(--primary)' }}
            >
              <ArrowRight size={24} />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
