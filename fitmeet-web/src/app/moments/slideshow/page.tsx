'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Share2, ArrowLeft, Volume2, VolumeX } from 'lucide-react'
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

type Animation = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'pan-up' | 'ken-burns'
const ANIMATIONS: Animation[] = ['zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'pan-up', 'ken-burns']

function getAnimationStyle(anim: Animation, active: boolean): React.CSSProperties {
  const dur = '4.5s'
  if (!active) return { transform: 'scale(1)', transition: 'none' }
  switch (anim) {
    case 'zoom-in':
      return { transform: 'scale(1.15)', transition: `transform ${dur} ease-out` }
    case 'zoom-out':
      return { transform: 'scale(1.0)', transition: `transform ${dur} ease-out` }
    case 'pan-left':
      return { transform: 'scale(1.1) translateX(-3%)', transition: `transform ${dur} ease-out` }
    case 'pan-right':
      return { transform: 'scale(1.1) translateX(3%)', transition: `transform ${dur} ease-out` }
    case 'pan-up':
      return { transform: 'scale(1.1) translateY(-3%)', transition: `transform ${dur} ease-out` }
    case 'ken-burns':
      return { transform: 'scale(1.15) translateX(2%) translateY(-2%)', transition: `transform ${dur} ease-out` }
  }
}

function getInitialStyle(anim: Animation): React.CSSProperties {
  switch (anim) {
    case 'zoom-in': return { transform: 'scale(1.0)' }
    case 'zoom-out': return { transform: 'scale(1.15)' }
    case 'pan-left': return { transform: 'scale(1.1) translateX(3%)' }
    case 'pan-right': return { transform: 'scale(1.1) translateX(-3%)' }
    case 'pan-up': return { transform: 'scale(1.1) translateY(3%)' }
    case 'ken-burns': return { transform: 'scale(1.0) translateX(-2%) translateY(2%)' }
  }
}

export default function SlideshowPage() {
  const [moments, setMoments] = useState<Moment[]>([])
  const [loading, setLoading] = useState(true)
  const [slideIndex, setSlideIndex] = useState(0)
  const [slideFade, setSlideFade] = useState(true)
  const [animActive, setAnimActive] = useState(false)
  const [muted, setMuted] = useState(false)
  const [started, setStarted] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const animations = useMemo(() => {
    return moments.map(() => ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)])
  }, [moments])

  const load = useCallback(async () => {
    try {
      let all: Moment[] = []
      let p = 1
      let hasMore = true
      while (hasMore && p <= 20) {
        const r = await api.get(`/moments?page=${p}`)
        const data = r.data.data ?? []
        all = [...all, ...data]
        hasMore = !!r.data.has_more && data.length > 0
        p++
      }
      const seen = new Set<string>()
      all = all.filter(m => {
        if (seen.has(m.image_url)) return false
        seen.add(m.image_url)
        return true
      })
      for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]]
      }
      setMoments(all)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const startPlayback = () => {
    setStarted(true)
    if (!audioRef.current) {
      audioRef.current = new Audio('/volim_nju.mp3')
      audioRef.current.loop = true
    }
    audioRef.current.currentTime = 0
    audioRef.current.play().catch(() => {})
    setTimeout(() => setAnimActive(true), 50)
  }

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !muted
    }
    setMuted(!muted)
  }

  useEffect(() => {
    if (!started || moments.length === 0) return
    const interval = setInterval(() => {
      setSlideFade(false)
      setAnimActive(false)
      setTimeout(() => {
        setSlideIndex(i => {
          const next = i + 1
          if (next >= moments.length) {
            setMoments(prev => {
              const last = prev[prev.length - 1]
              const shuffled = [...prev]
              for (let k = shuffled.length - 1; k > 0; k--) {
                const j = Math.floor(Math.random() * (k + 1));
                [shuffled[k], shuffled[j]] = [shuffled[j], shuffled[k]]
              }
              if (shuffled[0]?.id === last?.id && shuffled.length > 1) {
                [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]]
              }
              return shuffled
            })
            return 0
          }
          return next
        })
        setSlideFade(true)
        setTimeout(() => setAnimActive(true), 50)
      }, 400)
    }, 4500)
    return () => clearInterval(interval)
  }, [started, moments.length])

  useEffect(() => {
    return () => { audioRef.current?.pause() }
  }, [])

  function handleShare() {
    const url = 'https://fitmeet.fit/moments/slideshow'
    if (navigator.share) {
      navigator.share({ title: 'FitMeet — Video Moments from Events!', text: 'Real people, real events — watch the highlights! 📸🎶', url })
    } else {
      navigator.clipboard.writeText(url)
        .then(() => alert('Link copied!'))
        .catch(() => {})
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#000' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#39ff14', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (moments.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#000', color: '#fff' }}>
        <p className="text-sm opacity-60">No moments yet.</p>
        <Link href="/moments" className="text-sm underline" style={{ color: '#39ff14' }}>Back to Moments</Link>
      </div>
    )
  }

  if (!started) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ background: '#000', color: '#fff' }}>
        <div className="grid grid-cols-3 gap-1 w-64 h-64 rounded-2xl overflow-hidden opacity-40">
          {moments.slice(0, 9).map((m, i) => (
            <div key={i} className="relative aspect-square">
              <Image src={m.image_url} alt="" fill sizes="85px" className="object-cover" />
            </div>
          ))}
        </div>
        <div className="text-center">
          <h1 className="text-xl font-black">FitMeet Moments</h1>
          <p className="text-sm opacity-50 mt-1">Real events, real people</p>
        </div>
        <button
          onClick={startPlayback}
          className="w-16 h-16 rounded-full flex items-center justify-center transition-transform hover:scale-110"
          style={{ background: '#39ff14' }}
        >
          <svg viewBox="0 0 24 24" fill="#000" width="28" height="28"><polygon points="6,3 20,12 6,21" /></svg>
        </button>
        <p className="text-xs opacity-30">Tap to play with music</p>
      </div>
    )
  }

  const current = moments[slideIndex]
  const currentAnim = animations[slideIndex] || 'zoom-in'

  return (
    <div className="absolute inset-0" style={{ background: '#000' }}>
      {/* Image */}
      <div
        className="absolute inset-0 z-0 transition-opacity duration-400"
        style={{ opacity: slideFade ? 1 : 0 }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <Image
            src={current.image_url}
            alt={current.title}
            fill
            sizes="100vw"
            className="object-cover"
            style={{
              objectPosition: `${(current.cover?.x ?? 0.5) * 100}% ${(current.cover?.y ?? 0.5) * 100}%`,
              ...(animActive ? getAnimationStyle(currentAnim, true) : getInitialStyle(currentAnim)),
            }}
            priority
          />
        </div>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.8))' }} />
      </div>

      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
        <Link
          href="/moments"
          className="p-2.5 rounded-full"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        >
          <ArrowLeft size={20} className="text-white" />
        </Link>
        <div className="flex gap-2">
          <button
            onClick={toggleMute}
            className="p-2.5 rounded-full"
            style={{ background: 'rgba(0,0,0,0.5)' }}
          >
            {muted ? <VolumeX size={20} className="text-white" /> : <Volume2 size={20} className="text-white" />}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold"
            style={{ background: 'rgba(57,255,20,0.2)', border: '1px solid rgba(57,255,20,0.4)', color: '#39ff14' }}
          >
            <Share2 size={15} /> Share
          </button>
        </div>
      </div>

      {/* Bottom info */}
      <div
        className="absolute bottom-0 left-0 right-0 p-6 z-10 transition-opacity duration-400"
        style={{ opacity: slideFade ? 1 : 0 }}
      >
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <span className="text-3xl">{CAT_EMOJI[current.category ?? ''] ?? '📅'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-white truncate">{current.title}</p>
            <p className="text-sm text-white/50">
              {new Date(current.start_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4 max-w-2xl mx-auto">
          <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <div
              className="h-full rounded-full"
              style={{
                background: '#39ff14',
                width: `${((slideIndex + 1) / moments.length) * 100}%`,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <p className="text-center text-xs text-white/30 mt-2">{slideIndex + 1} / {moments.length}</p>
        </div>
      </div>
    </div>
  )
}
