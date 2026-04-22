'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { UserPlus, Check, X } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

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

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function SenderAvatar({ sender }: { sender: FriendRequestNotif['sender'] }) {
  if (sender.avatar) {
    return (
      <Image src={sender.avatar} alt={sender.name} width={44} height={44}
        className="rounded-full object-cover flex-shrink-0" />
    )
  }
  return (
    <div className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center font-bold text-base text-black"
      style={{ background: 'var(--primary)' }}>
      {sender.name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function NotificationsPage() {
  const { token }  = useAuthStore()
  const router     = useRouter()
  const [notifs,   setNotifs]   = useState<FriendRequestNotif[]>([])
  const [loading,  setLoading]  = useState(true)
  const [acting,   setActing]   = useState<number | null>(null)

  useEffect(() => {
    if (!token) { router.replace('/login'); return }
    api.get('/notifications')
      .then(({ data }) => setNotifs(data.data ?? []))
      .finally(() => setLoading(false))
  }, [token, router])

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
              <div key={n.id}
                className="rounded-2xl border p-4 flex items-start gap-3"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>

                <div className="relative">
                  <SenderAvatar sender={n.sender} />
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
                  {n.sender.skill_level && (
                    <p className="text-xs capitalize mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {n.sender.skill_level}
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
            ))}
          </div>

        </div>
      </main>
    </>
  )
}
