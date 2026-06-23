'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Share2, X, ArrowRight, Play, Pause } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import api from '@/lib/api'

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
  const [slideshow, setSlideshow] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  const [slideFade, setSlideFade] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const startSlideshow = () => {
    if (moments.length === 0) return
    setSlideIndex(0)
    setSlideFade(true)
    setSlideshow(true)
    if (!audioRef.current) {
      audioRef.current = new Audio('/moments-music.mp3')
      audioRef.current.loop = true
    }
    audioRef.current.currentTime = 0
    audioRef.current.play().catch(() => {})
  }

  const stopSlideshow = () => {
    setSlideshow(false)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }

  useEffect(() => {
    if (!slideshow || moments.length === 0) return
    const interval = setInterval(() => {
      setSlideFade(false)
      setTimeout(() => {
        setSlideIndex(i => (i + 1) % moments.length)
        setSlideFade(true)
      }, 300)
    }, 2500)
    return () => clearInterval(interval)
  }, [slideshow, moments.length])

  useEffect(() => {
    return () => { audioRef.current?.pause() }
  }, [])

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
            <button
              onClick={startSlideshow}
              disabled={moments.length === 0}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-semibold transition-opacity hover:opacity-80 disabled:opacity-30"
              style={{ background: 'rgba(57,255,20,0.15)', border: '1px solid rgba(57,255,20,0.4)', color: 'var(--primary)' }}
            >
              <Play size={15} /> Play
            </button>
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

      {/* Slideshow */}
      {slideshow && moments.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: '#000' }}>
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{ opacity: slideFade ? 1 : 0 }}
          >
            <Image
              src={moments[slideIndex].image_url}
              alt={moments[slideIndex].title}
              fill
              sizes="100vw"
              className="object-cover"
              style={{
                objectPosition: `${(moments[slideIndex].cover?.x ?? 0.5) * 100}% ${(moments[slideIndex].cover?.y ?? 0.5) * 100}%`,
                transform: slideFade ? 'scale(1.05)' : 'scale(1)',
                transition: 'transform 2.5s ease-out, opacity 0.3s ease',
              }}
              priority
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(transparent 50%, rgba(0,0,0,0.7))' }} />
          </div>

          <div
            className="absolute bottom-0 left-0 right-0 p-6 transition-opacity duration-300"
            style={{ opacity: slideFade ? 1 : 0 }}
          >
            <div className="flex items-center gap-3 max-w-2xl mx-auto">
              <span className="text-3xl">{CAT_EMOJI[moments[slideIndex].category ?? ''] ?? '📅'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-white truncate">{moments[slideIndex].title}</p>
                <p className="text-sm text-white/60">
                  {new Date(moments[slideIndex].start_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex gap-1 mt-4 max-w-2xl mx-auto">
              {moments.map((_, i) => (
                <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: 'var(--primary)',
                      width: i < slideIndex ? '100%' : i === slideIndex ? '100%' : '0%',
                      transition: i === slideIndex ? 'width 2.5s linear' : 'none',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={stopSlideshow}
            className="absolute top-4 right-4 p-3 rounded-full z-10"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <X size={22} className="text-white" />
          </button>

          <button
            onClick={stopSlideshow}
            className="absolute top-4 left-4 p-3 rounded-full z-10"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            <Pause size={22} className="text-white" />
          </button>
        </div>
      )}

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
