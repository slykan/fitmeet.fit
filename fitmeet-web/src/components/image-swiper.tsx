'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

/**
 * Photo carousel: swipe with a finger (or drag with the mouse), arrows on desktop.
 * Used for the market cover and, with `fullscreen`, for the enlarged view (← → and Esc work there too).
 * A tap/click without dragging calls onTap (the cover uses it to open the enlarged view).
 */
export function ImageSwiper({
  images,
  index,
  onIndexChange,
  alt = '',
  height = 340,
  fit = 'contain',
  onTap,
  children,
  className = '',
  arrowsAlways = false,
}: {
  images: string[]
  index: number
  onIndexChange: (i: number) => void
  alt?: string
  height?: number | string
  fit?: 'contain' | 'cover'
  onTap?: () => void
  children?: ReactNode
  className?: string
  arrowsAlways?: boolean
}) {
  const box = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const axis = useRef<'x' | 'y' | null>(null)
  const [dx, setDx] = useState(0)
  const n = images.length

  const go = (i: number) => onIndexChange(Math.max(0, Math.min(n - 1, i)))

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    axis.current = null
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const mx = e.clientX - s.x
    const my = e.clientY - s.y
    if (!axis.current && Math.hypot(mx, my) > 8) {
      axis.current = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
      if (axis.current === 'x') box.current?.setPointerCapture(e.pointerId)
    }
    if (axis.current === 'x' && n > 1) {
      // resist at the ends
      const edge = (index === 0 && mx > 0) || (index === n - 1 && mx < 0)
      setDx(edge ? mx / 3 : mx)
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    start.current = null
    const width = box.current?.clientWidth ?? 1
    if (axis.current === 'x') {
      if (dx < -Math.min(60, width * 0.15)) go(index + 1)
      else if (dx > Math.min(60, width * 0.15)) go(index - 1)
    } else if (!axis.current) {
      onTap?.()
    }
    axis.current = null
    setDx(0)
  }

  const arrowVis = arrowsAlways ? 'flex' : 'hidden md:flex'

  return (
    <div
      ref={box}
      className={`relative w-full overflow-hidden select-none ${className}`}
      style={{ height, touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { start.current = null; axis.current = null; setDx(0) }}
    >
      <div
        className="flex h-full"
        style={{
          transform: `translateX(calc(${-index * 100}% + ${dx}px))`,
          transition: dx ? 'none' : 'transform 260ms ease',
        }}
      >
        {images.map((src, i) => (
          <div key={i} className="relative h-full w-full shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={i === index ? alt : ''}
              draggable={false}
              loading={Math.abs(i - index) <= 1 ? 'eager' : 'lazy'}
              className={`absolute inset-0 h-full w-full ${fit === 'cover' ? 'object-cover' : 'object-contain'}`}
            />
          </div>
        ))}
      </div>

      {children}

      {n > 1 && (
        <>
          {index > 0 && (
            <button
              type="button"
              aria-label="Previous photo"
              onPointerDown={e => e.stopPropagation()}
              onPointerUp={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); go(index - 1) }}
              className={`${arrowVis} absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full items-center justify-center`}
              style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}
            >
              <ChevronLeft size={22} />
            </button>
          )}
          {index < n - 1 && (
            <button
              type="button"
              aria-label="Next photo"
              onPointerDown={e => e.stopPropagation()}
              onPointerUp={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); go(index + 1) }}
              className={`${arrowVis} absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full items-center justify-center`}
              style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}
            >
              <ChevronRight size={22} />
            </button>
          )}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
            {images.map((_, i) => (
              <span
                key={i}
                className="rounded-full transition-all"
                style={{ width: i === index ? 16 : 6, height: 6, background: i === index ? '#fff' : 'rgba(255,255,255,0.55)', boxShadow: '0 0 2px rgba(0,0,0,0.5)' }}
              />
            ))}
          </div>
          <span
            className="absolute top-3 left-3 text-xs font-bold px-2 py-0.5 rounded-full pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
          >
            {index + 1} / {n}
          </span>
        </>
      )}
    </div>
  )
}

/** Enlarged view: full-screen swiper, ← → to browse, Esc or ✕ to close. */
export function ImageLightbox({
  images,
  index,
  onIndexChange,
  onClose,
  alt = '',
}: {
  images: string[]
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
  alt?: string
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') onIndexChange(Math.min(images.length - 1, index + 1))
      else if (e.key === 'ArrowLeft') onIndexChange(Math.max(0, index - 1))
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [images.length, index, onIndexChange, onClose])

  // portal + z-index above the sticky navbar (z 1001)
  return createPortal(
    <div className="fixed inset-0 flex flex-col" style={{ background: 'rgba(0,0,0,0.94)', zIndex: 1100 }}>
      <button
        type="button"
        aria-label="Close"
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.12)' }}
        onClick={onClose}
      >
        <X size={20} color="#fff" />
      </button>
      <ImageSwiper
        images={images}
        index={index}
        onIndexChange={onIndexChange}
        alt={alt}
        height="100%"
        arrowsAlways
        onTap={onClose}
      />
    </div>,
    document.body,
  )
}
