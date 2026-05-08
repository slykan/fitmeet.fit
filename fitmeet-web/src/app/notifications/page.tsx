'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { UserPlus, UserCheck, Check, X, Bell, Calendar, MapPin, Zap, PlayCircle, MessageCircle } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import api from '@/lib/api'
import { formatEventDateTime } from '@/lib/event-time'
import { useAuthStore } from '@/store/auth'

const notificationsSeenKey = (userId: number) => `fitmeet-notifications-last-seen:${userId}`

interface FriendRequestNotif {
  id: number
  type: 'friend_request'
  sender: {
    id: number
    name: string
    avatar: string | null
    skill_level: string | null
    home: { city: string | null; country: string | null }
  }
  created_at: string
}

interface FriendAcceptedNotif {
  id: number
  type: 'friend_accepted'
  friend: {
    id: number
    name: string
    avatar: string | null
    skill_level: string | null
    home: { city: string | null; country: string | null }
  }
  created_at: string
}

interface EventReminderNotif {
  id: number
  type: 'event_reminder'
  remind_offset: '1h' | '5h' | '1d'
  event: {
    id: number
    title: string
    start_at: string
    timezone: string
    address: string | null
    category: string
  }
  created_at: string
}

interface NewEventNotif {
  id: number
  type: 'new_event'
  event: {
    id: number
    title: string
    start_at: string
    timezone: string
    address: string | null
    category: string
    distance_km: number | null
    elevation_gain: number | null
  }
  created_at: string
}

interface EventCancelledNotif {
  id: number
  type: 'event_cancelled'
  event: {
    id: number
    title: string
    start_at: string
    timezone: string
    address: string | null
    category: string
  }
  created_at: string
}

interface EventStartedNotif {
  id: number
  type: 'event_started'
  event: {
    id: number
    title: string
    start_at: string
    timezone: string
    address: string | null
    category: string
  }
  created_at: string
}

interface EventCommentNotif {
  id: number
  type: 'event_comment' | 'event_comment_mention'
  event: {
    id: number
    title: string
    start_at: string
    timezone: string
    address: string | null
    category: string
  }
  created_at: string
}

type Notif =
  | FriendRequestNotif
  | FriendAcceptedNotif
  | EventReminderNotif
  | NewEventNotif
  | EventCancelledNotif
  | EventStartedNotif
  | EventCommentNotif

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function PersonAvatar({ person }: { person: { name: string; avatar: string | null } }) {
  if (person.avatar) {
    return (
      <Image src={person.avatar} alt={person.name} width={44} height={44}
        className="rounded-full object-cover flex-shrink-0" />
    )
  }
  return (
    <div className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center font-bold text-base text-black"
      style={{ background: 'var(--primary)' }}>
      {person.name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function NotificationsPage() {
  const { token, user }  = useAuthStore()
  const router     = useRouter()
  const [mounted,  setMounted]  = useState(false)
  const [notifs,   setNotifs]   = useState<Notif[]>([])
  const [loading,  setLoading]  = useState(true)
  const [acting,   setActing]   = useState<number | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted) return
    if (!token) { router.replace('/login?redirect=/notifications'); return }
    if (typeof window !== 'undefined' && user?.id) {
      window.localStorage.setItem(notificationsSeenKey(user.id), new Date().toISOString())
      window.dispatchEvent(new Event('fitmeet-notifications-seen'))
    }
    api.get('/notifications')
      .then(({ data }) => {
        const items = data.data ?? []
        setNotifs(items)

        if (typeof window !== 'undefined' && user?.id) {
          const newestCreatedAt = items.reduce((latest: string | null, item: { created_at?: string }) => {
            if (!item.created_at) return latest
            if (!latest) return item.created_at
            return new Date(item.created_at).getTime() > new Date(latest).getTime() ? item.created_at : latest
          }, null)

          window.localStorage.setItem(
            notificationsSeenKey(user.id),
            newestCreatedAt ?? new Date().toISOString()
          )
          window.dispatchEvent(new Event('fitmeet-notifications-seen'))
        }
      })
      .finally(() => setLoading(false))
  }, [mounted, token, router, user])

  async function handle(id: number, action: 'accept' | 'decline') {
    setActing(id)
    try {
      await api.post(`/friends/${action}/${id}`)
      setNotifs(n => n.filter(x => x.id !== id))
    } finally {
      setActing(null)
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 py-8">
        <div style={{ maxWidth: 680, margin: '0 auto' }}>

          <h1 className="text-2xl font-bold mb-6">Notifications</h1>

          {loading && (
            <div className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          )}

          {!loading && notifs.length === 0 && (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">🔔</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No notifications yet.</p>
            </div>
          )}

          <div className="space-y-3">
            {notifs.map(n => (
              n.type === 'new_event' ? (
              <div key={n.id}
                onClick={() => router.push(`/events/view?id=${n.event.id}`)}
                className="rounded-2xl border p-4 flex items-start gap-3 cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(57,255,20,0.12)', border: '1px solid var(--primary)' }}>
                  <MapPin size={18} style={{ color: 'var(--primary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--primary)' }}>
                    New {n.event.category} event near you
                  </p>
                  <p className="text-sm font-semibold truncate">{n.event.title}</p>
                  <div className="flex flex-col gap-0.5 mt-1">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Calendar size={10} className="inline mr-1" />
                      {formatEventDateTime(n.event.start_at, n.event.timezone)}
                    </p>
                    {n.event.address && (
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                        <MapPin size={10} className="inline mr-1" />
                        {n.event.address}
                      </p>
                    )}
                    {(n.event.distance_km || n.event.elevation_gain) && (
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        <Zap size={10} className="inline mr-1" style={{ color: 'var(--primary)' }} />
                        {[
                          n.event.distance_km    && `${n.event.distance_km} km`,
                          n.event.elevation_gain && `↑${n.event.elevation_gain} m`,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{timeAgo(n.created_at)}</p>
                </div>
              </div>
            ) : n.type === 'event_cancelled' ? (
              <div key={n.id}
                onClick={() => router.push(`/events/view?id=${n.event.id}`)}
                className="rounded-2xl border p-4 flex items-start gap-3 cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: 'var(--surface)', borderColor: 'rgba(248,113,113,0.35)' }}>
                <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.45)' }}>
                  <X size={18} style={{ color: '#f87171' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold mb-0.5" style={{ color: '#f87171' }}>
                    {n.event.category} event cancelled
                  </p>
                  <p className="text-sm font-semibold truncate">{n.event.title}</p>
                  <div className="flex flex-col gap-0.5 mt-1">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Calendar size={10} className="inline mr-1" />
                      {formatEventDateTime(n.event.start_at, n.event.timezone)}
                    </p>
                    {n.event.address && (
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                        <MapPin size={10} className="inline mr-1" />
                        {n.event.address}
                      </p>
                    )}
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{timeAgo(n.created_at)}</p>
                </div>
              </div>
            ) : n.type === 'event_started' ? (
              <div key={n.id}
                onClick={() => router.push(`/events/view?id=${n.event.id}`)}
                className="rounded-2xl border p-4 flex items-start gap-3 cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: 'var(--surface)', borderColor: 'rgba(57,255,20,0.35)' }}>
                <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(57,255,20,0.12)', border: '1px solid var(--primary)' }}>
                  <PlayCircle size={18} style={{ color: 'var(--primary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--primary)' }}>
                    Your {n.event.category} event just started
                  </p>
                  <p className="text-sm font-semibold truncate">{n.event.title}</p>
                  <div className="flex flex-col gap-0.5 mt-1">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Calendar size={10} className="inline mr-1" />
                      {formatEventDateTime(n.event.start_at, n.event.timezone)}
                    </p>
                    {n.event.address && (
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                        <MapPin size={10} className="inline mr-1" />
                        {n.event.address}
                      </p>
                    )}
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{timeAgo(n.created_at)}</p>
                </div>
              </div>
            ) : n.type === 'event_reminder' ? (
              <div key={n.id}
                onClick={() => router.push(`/events/view?id=${n.event.id}`)}
                className="rounded-2xl border p-4 flex items-start gap-3 cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(57,255,20,0.12)', border: '1px solid var(--primary)' }}>
                  <Bell size={18} style={{ color: 'var(--primary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{n.event.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                    ⏰ Starts in {n.remind_offset === '1h' ? '1 hour' : n.remind_offset === '5h' ? '5 hours' : '1 day'}
                  </p>
                  <div className="flex flex-col gap-0.5 mt-1">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Calendar size={10} className="inline mr-1" />
                      {formatEventDateTime(n.event.start_at, n.event.timezone)}
                    </p>
                    {n.event.address && (
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                        <MapPin size={10} className="inline mr-1" />
                        {n.event.address}
                      </p>
                    )}
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{timeAgo(n.created_at)}</p>
                </div>
              </div>
            ) : n.type === 'event_comment' || n.type === 'event_comment_mention' ? (
              <div key={n.id}
                onClick={() => router.push(`/events/view?id=${n.event.id}&wall=1`)}
                className="rounded-2xl border p-4 flex items-start gap-3 cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: 'var(--surface)', borderColor: n.type === 'event_comment_mention' ? 'rgba(57,255,20,0.35)' : 'var(--border)' }}>
                <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(57,255,20,0.12)', border: '1px solid var(--primary)' }}>
                  <MessageCircle size={18} style={{ color: 'var(--primary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--primary)' }}>
                    {n.type === 'event_comment_mention' ? 'You were mentioned in Event Wall' : 'New Event Wall activity'}
                  </p>
                  <p className="text-sm font-semibold truncate">{n.event.title}</p>
                  <div className="flex flex-col gap-0.5 mt-1">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Calendar size={10} className="inline mr-1" />
                      {formatEventDateTime(n.event.start_at, n.event.timezone)}
                    </p>
                    {n.event.address && (
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                        <MapPin size={10} className="inline mr-1" />
                        {n.event.address}
                      </p>
                    )}
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{timeAgo(n.created_at)}</p>
                </div>
              </div>
            ) : n.type === 'friend_request' ? (
              <div key={n.id}
                className="rounded-2xl border p-4 flex items-start gap-3"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="relative">
                  <PersonAvatar person={n.sender} />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--primary)' }}>
                    <UserPlus size={11} color="#000" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{n.sender.name}</p>
                  {(n.sender.home.city || n.sender.home.country) && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {[n.sender.home.city, n.sender.home.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Sent you a friend request · {timeAgo(n.created_at)}
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handle(n.id, 'accept')}
                      disabled={acting === n.id}
                      className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                      style={{ background: 'var(--primary)', color: '#000' }}
                    >
                      <Check size={13} /> Accept
                    </button>
                    <button
                      onClick={() => handle(n.id, 'decline')}
                      disabled={acting === n.id}
                      className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-medium border transition-colors hover:bg-[--border] disabled:opacity-50"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    >
                      <X size={13} /> Decline
                    </button>
                  </div>
                </div>
              </div>
            ) : n.type === 'friend_accepted' ? (
              <div key={n.id}
                className="rounded-2xl border p-4 flex items-start gap-3"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="relative">
                  <PersonAvatar person={n.friend} />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: '#22c55e' }}>
                    <UserCheck size={11} color="#fff" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{n.friend.name}</p>
                  {(n.friend.home.city || n.friend.home.country) && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {[n.friend.home.city, n.friend.home.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <p className="text-xs mt-1" style={{ color: '#22c55e', fontWeight: 600 }}>
                    Accepted your friend request · {timeAgo(n.created_at)}
                  </p>
                </div>
              </div>
              ) : null
            ))}
          </div>

        </div>
      </main>
    </>
  )
}
