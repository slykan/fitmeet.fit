'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

const BANNERS = [
  { src: '/banner-1.png', alt: 'Find. Join. Fit. — FitMeet' },
  { src: '/banner-2.png', alt: 'Find your crew. Fuel your passion. — FitMeet' },
]

const INTERVAL = 6000

export function BannerCarousel() {
  const [current, setCurrent] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => advance(1), INTERVAL)
    return () => clearInterval(timer)
  }, [current])

  function advance(dir: number) {
    setFading(true)
    setTimeout(() => {
      setCurrent((c) => (c + dir + BANNERS.length) % BANNERS.length)
      setFading(false)
    }, 300)
  }

  return (
    <div className="relative w-full overflow-hidden rounded-2xl" style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
      <div
        style={{
          transition: 'opacity 0.3s ease',
          opacity: fading ? 0 : 1,
          aspectRatio: '16 / 7',
          position: 'relative',
        }}
      >
        <Image
          src={BANNERS[current].src}
          alt={BANNERS[current].alt}
          fill
          sizes="(max-width: 1280px) 100vw, 1152px"
          className="object-cover"
          priority={current === 0}
        />
      </div>

      {/* Prev / Next */}
      <button
        onClick={() => advance(-1)}
        aria-label="Previous banner"
        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-100 opacity-60"
        style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8l4-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        onClick={() => advance(1)}
        aria-label="Next banner"
        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-100 opacity-60"
        style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 4l4 4-4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
        {BANNERS.map((_, i) => (
          <button
            key={i}
            onClick={() => { setFading(true); setTimeout(() => { setCurrent(i); setFading(false) }, 300) }}
            aria-label={`Banner ${i + 1}`}
            style={{
              width: i === current ? 20 : 8,
              height: 8,
              borderRadius: 999,
              background: i === current ? '#6cff2f' : 'rgba(255,255,255,0.35)',
              border: 'none',
              cursor: 'pointer',
              transition: 'width 0.3s ease, background 0.3s ease',
              padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  )
}
