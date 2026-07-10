'use client'

import { useEffect, useState } from 'react'
import api from '@/lib/api'

export type BadgeGridItem = {
  key: string
  emoji: string
  name: string
  description: string
  unlocked: boolean
  unlocked_at: string | null
}

function BadgeDetailModal({ badge, onClose }: { badge: BadgeGridItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xs rounded-3xl border p-6 text-center flex flex-col items-center gap-2"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-5xl" style={{ opacity: badge.unlocked ? 1 : 0.3 }}>{badge.emoji}</span>
        <span className="font-bold text-base">{badge.name}</span>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{badge.description}</span>
        {badge.unlocked && badge.unlocked_at && (
          <span className="text-xs mt-1" style={{ color: 'var(--primary)' }}>
            Unlocked {new Date(badge.unlocked_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  )
}

export function BadgeGrid({ badges: providedBadges }: { badges?: BadgeGridItem[] }) {
  const [fetched, setFetched] = useState<BadgeGridItem[] | null>(null)
  const [selected, setSelected] = useState<BadgeGridItem | null>(null)

  useEffect(() => {
    if (providedBadges) return
    api.get('/badges').then(({ data }) => setFetched(data.data)).catch(() => {})
  }, [providedBadges])

  const badges = providedBadges ?? fetched
  if (!badges) return null

  const unlockedCount = badges.filter((b) => b.unlocked).length

  return (
    <div
      className="rounded-2xl border p-4 sm:p-6 mb-5"
      style={{ background: 'var(--surface)', borderColor: 'rgba(57,255,20,0.2)' }}
    >
      <div className="flex items-center gap-3 mb-5">
        <span className="text-2xl">🏅</span>
        <div>
          <h2 className="font-bold text-base">Badges</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{unlockedCount} of {badges.length} unlocked</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        {badges.map((badge) => (
          <button
            key={badge.key}
            onClick={() => setSelected(badge)}
            className="flex flex-col items-center gap-1 rounded-xl py-2.5 w-[76px] transition-opacity hover:opacity-80"
            style={{ background: badge.unlocked ? 'rgba(57,255,20,0.08)' : 'rgba(255,255,255,0.04)' }}
          >
            <span className="text-2xl" style={{ opacity: badge.unlocked ? 1 : 0.28 }}>{badge.emoji}</span>
            <span
              className="text-[10px] font-bold text-center truncate w-full px-1"
              style={{ color: badge.unlocked ? 'var(--text-primary)' : 'var(--text-muted)', opacity: badge.unlocked ? 1 : 0.5 }}
            >
              {badge.name}
            </span>
          </button>
        ))}
      </div>

      {selected && <BadgeDetailModal badge={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
