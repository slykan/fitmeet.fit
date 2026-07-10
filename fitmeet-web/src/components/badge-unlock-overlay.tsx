'use client'

import { useEffect } from 'react'
import { useBadgesStore } from '@/store/badges'

const AUTO_DISMISS_MS = 3000

export function BadgeUnlockOverlay() {
  const current = useBadgesStore((s) => s.current)
  const dismiss = useBadgesStore((s) => s.dismiss)

  useEffect(() => {
    if (!current) return

    const audio = new Audio('/sounds/applause.mp3')
    audio.volume = 0.85
    audio.play().catch(() => {})

    const timer = setTimeout(dismiss, AUTO_DISMISS_MS)
    return () => {
      clearTimeout(timer)
      audio.pause()
    }
  }, [current, dismiss])

  if (!current) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 cursor-pointer"
      style={{ background: 'rgba(5,5,10,0.96)' }}
      onClick={dismiss}
    >
      <div
        className="badge-glow-in absolute rounded-full pointer-events-none"
        style={{
          width: '140vmax',
          height: '140vmax',
          background: 'var(--primary)',
          opacity: 0,
        }}
      />

      <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
        <div
          className="badge-ring-pulse absolute rounded-full border-2 pointer-events-none"
          style={{ width: 140, height: 140, borderColor: 'var(--primary)' }}
        />
        <div key={current.key} className="badge-pop" style={{ fontSize: 76, lineHeight: 1 }}>
          {current.emoji}
        </div>
      </div>

      <div className="badge-text-in flex flex-col items-center gap-1 text-center px-6">
        <span
          className="text-xs font-bold uppercase tracking-[0.2em]"
          style={{ color: 'var(--primary)' }}
        >
          Badge Unlocked
        </span>
        <span className="text-2xl font-black text-white">{current.name}</span>
        <span className="text-sm max-w-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {current.description}
        </span>
      </div>
    </div>
  )
}
