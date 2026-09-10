'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { X, ArrowRight, Flag } from 'lucide-react'
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

export function MomentsGrid() {
  const [moments, setMoments] = useState<Moment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [lightbox, setLightbox] = useState<Moment | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) load(page + 1)
    }, { rootMargin: '400px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, page, load])

  return (
    <>
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
            <div ref={sentinelRef} className="flex justify-center mt-8 h-8">
              {loadingMore && (
                <div
                  className="w-5 h-5 rounded-full animate-spin"
                  style={{ border: '2px solid rgba(57,255,20,0.25)', borderTopColor: 'var(--primary)' }}
                />
              )}
            </div>
          )}
        </>
      )}

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
    </>
  )
}
