'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Activity } from 'lucide-react'

import api from '@/lib/api'

interface ActivityActor { id: number; name: string; avatar: string | null }
interface ActivityEvent { id: number; title: string; category: string; start_at: string; timezone: string; address: string | null; image_url: string | null }

interface ActivityItem {
  id: number
  type: 'event_joined' | 'event_created' | 'event_commented' | 'event_applauded'
  meta: { excerpt?: string } | null
  actor: ActivityActor
  event: ActivityEvent
  created_at: string
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function verb(item: ActivityItem): string {
  switch (item.type) {
    case 'event_joined':    return 'joined'
    case 'event_created':   return 'created'
    case 'event_commented': return 'commented on'
    case 'event_applauded': return 'applauded'
  }
}

function ActorAvatar({ actor }: { actor: ActivityActor }) {
  if (actor.avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={actor.avatar} alt={actor.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
  }
  return (
    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0"
      style={{ background: 'var(--primary)', color: '#000' }}>
      {actor.name.charAt(0).toUpperCase()}
    </div>
  )
}

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  const load = useCallback(async (before?: string) => {
    if (before) setLoadingMore(true); else setLoading(true)
    try {
      const { data } = await api.get('/feed', { params: before ? { before } : undefined })
      setItems(prev => before ? [...prev, ...data.data] : data.data)
      setHasMore(!!data.has_more)
    } catch {}
    finally { setLoading(false); setLoadingMore(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20 space-y-2">
        <Activity size={32} style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
        <p className="text-sm font-semibold">Nothing from friends yet</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          When friends join, create, or comment on events, it&apos;ll show up here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map(item => (
        <Link
          key={item.id}
          href={item.type === 'event_commented' ? `/events/view?id=${item.event.id}&wall=1` : `/events/view?id=${item.event.id}`}
          className="flex items-center gap-3 rounded-2xl border p-4 transition-opacity hover:opacity-90"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <ActorAvatar actor={item.actor} />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-bold" style={{ color: 'var(--primary)' }}>{item.actor.name}</span>
              {' '}{verb(item)}{' '}
              <span className="font-bold" style={{ color: 'var(--primary)' }}>{item.event.title}</span>
            </p>
            {item.type === 'event_commented' && item.meta?.excerpt && (
              <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-muted)' }}>&quot;{item.meta.excerpt}&quot;</p>
            )}
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{timeAgo(item.created_at)}</p>
          </div>
          {item.event.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.event.image_url} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
          )}
        </Link>
      ))}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => load(items[items.length - 1].created_at)}
            disabled={loadingMore}
            className="text-sm px-4 py-2 rounded-xl font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
