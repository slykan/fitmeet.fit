'use client'

import { useEffect, useState } from 'react'
import { MessageSquareText } from 'lucide-react'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.fitmeet.fit/api'

const CATEGORY_EMOJI: Record<string, string> = {
  running: '🏃', cycling: '🚴', hiking: '🥾', swimming: '🏊', football: '⚽',
  basketball: '🏀', tennis: '🎾', volleyball: '🏐', yoga: '🧘', fitness: '💪',
  martial_arts: '🥊', climbing: '🧗', skiing: '⛷️', skating: '⛸️', surfing: '🏄',
  golf: '⛳', rugby: '🏉', baseball: '⚾', rowing: '🚣', dance: '💃',
  social: '🎉', other: '📅',
}

interface PublicComment {
  id: number
  body: string
  created_at: string
  user: { name: string; avatar: string | null }
  event: { id: number; title: string; category: string | null }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function Avatar({ user }: { user: PublicComment['user'] }) {
  if (user.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={user.avatar} alt={user.name} width={32} height={32}
        className="rounded-full object-cover shrink-0 w-8 h-8" />
    )
  }
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0"
      style={{ background: 'rgba(57,255,20,0.12)', color: 'var(--primary)' }}>
      {user.name?.charAt(0).toUpperCase() ?? '?'}
    </div>
  )
}

export function PublicCommentsSection() {
  const [comments, setComments] = useState<PublicComment[]>([])

  useEffect(() => {
    fetch(`${API_URL}/comments/public-latest`, { cache: 'no-store' })
      .then(r => r.json())
      .then(setComments)
      .catch(() => {})
  }, [])

  if (!comments.length) return null

  return (
    <section className="py-16 md:py-20 border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center gap-3 mb-3">
          <MessageSquareText size={18} style={{ color: 'var(--primary)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>Community buzz</p>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold mb-10">What people are saying.</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {comments.map(c => (
            <Link
              key={c.id}
              href={`/events/view?id=${c.event.id}`}
              className="group rounded-2xl border p-4 flex flex-col gap-3 transition-opacity hover:opacity-80"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2.5">
                <Avatar user={c.user} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{c.user.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{timeAgo(c.created_at)}</p>
                </div>
              </div>

              <p className="text-sm leading-relaxed flex-1" style={{ color: 'var(--text-muted)' }}>
                &ldquo;{c.body.length > 120 ? c.body.slice(0, 120) + '…' : c.body}&rdquo;
              </p>

              <div className="flex items-center gap-1.5 text-xs font-medium mt-auto"
                style={{ color: 'var(--text-muted)' }}>
                <span>{CATEGORY_EMOJI[c.event.category ?? ''] ?? '📅'}</span>
                <span className="truncate">{c.event.title}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
