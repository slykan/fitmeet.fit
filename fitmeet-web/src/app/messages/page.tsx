'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { MessageSquare, Plus, X, Send } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

interface Partner {
  id: number
  name: string
  avatar: string | null
}

interface Conversation {
  partner: Partner
  last_message: { body: string; is_mine: boolean; created_at: string }
  unread_count: number
}

interface Friend {
  id: number
  name: string
  avatar: string | null
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function Avatar({ person, size = 44 }: { person: Partner; size?: number }) {
  if (person.avatar) {
    return (
      <Image src={person.avatar} alt={person.name} width={size} height={size}
        className="rounded-full object-cover flex-shrink-0" />
    )
  }
  return (
    <div className="flex-shrink-0 rounded-full flex items-center justify-center font-bold text-black"
      style={{ width: size, height: size, fontSize: size * 0.38, background: 'var(--primary)' }}>
      {person.name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function MessagesPage() {
  const { token } = useAuthStore()
  const router    = useRouter()
  const [convos,   setConvos]   = useState<Conversation[]>([])
  const [loading,  setLoading]  = useState(true)
  const [compose,  setCompose]  = useState(false)
  const [friends,  setFriends]  = useState<Friend[]>([])
  const [selected, setSelected] = useState<Friend | null>(null)
  const [body,     setBody]     = useState('')
  const [sending,  setSending]  = useState(false)

  useEffect(() => {
    if (!token) { router.replace('/login'); return }
    api.get('/messages')
      .then(({ data }) => setConvos(data.data ?? []))
      .finally(() => setLoading(false))
  }, [token, router])

  const loadFriends = useCallback(() => {
    api.get('/users', { params: { friends_only: 1 } })
      .then(({ data }) => setFriends(data.data ?? []))
      .catch(() => {})
  }, [])

  function openCompose() {
    setCompose(true)
    setSelected(null)
    setBody('')
    loadFriends()
  }

  async function handleSend() {
    if (!selected || !body.trim()) return
    setSending(true)
    try {
      await api.post(`/messages/${selected.id}`, { body: body.trim() })
      router.push(`/messages/${selected.id}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 py-8">
        <div style={{ maxWidth: 680, margin: '0 auto' }}>

          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Messages</h1>
            <button
              onClick={openCompose}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'var(--primary)', color: '#000' }}
            >
              <Plus size={15} /> New Message
            </button>
          </div>

          {/* Compose modal */}
          {compose && (
            <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.6)' }}
              onClick={e => e.target === e.currentTarget && setCompose(false)}>
              <div className="w-full rounded-2xl border p-6 space-y-4"
                style={{ maxWidth: 440, background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-lg">New Message</h2>
                  <button onClick={() => setCompose(false)} style={{ color: 'var(--text-muted)' }}>
                    <X size={20} />
                  </button>
                </div>

                {/* Friend picker */}
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>To</p>
                  <div className="flex flex-wrap gap-2">
                    {friends.length === 0 && (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No friends yet.</p>
                    )}
                    {friends.map(f => (
                      <button
                        key={f.id}
                        onClick={() => setSelected(f)}
                        className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border transition-colors"
                        style={{
                          borderColor: selected?.id === f.id ? 'var(--primary)' : 'var(--border)',
                          color:       selected?.id === f.id ? 'var(--primary)' : 'var(--text-primary)',
                          background:  selected?.id === f.id ? 'rgba(57,255,20,0.08)' : 'transparent',
                        }}
                      >
                        <Avatar person={f} size={22} />
                        {f.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message input */}
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="Write a message…"
                  rows={4}
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-[--primary] resize-none transition-colors"
                  style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                />

                <button
                  onClick={handleSend}
                  disabled={!selected || !body.trim() || sending}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ background: 'var(--primary)', color: '#000' }}
                >
                  <Send size={15} /> {sending ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          )}

          {!loading && convos.length === 0 && (
            <div className="text-center py-16">
              <MessageSquare size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No messages yet. Start a conversation!</p>
            </div>
          )}

          <div className="space-y-2">
            {convos.map(c => (
              <button
                key={c.partner.id}
                onClick={() => router.push(`/messages/${c.partner.id}`)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border transition-colors hover:bg-[--border] text-left"
                style={{ background: 'var(--surface)', borderColor: c.unread_count > 0 ? 'var(--primary)' : 'var(--border)' }}
              >
                <Avatar person={c.partner} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{c.partner.name}</p>
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {timeAgo(c.last_message.created_at)}
                    </span>
                  </div>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {c.last_message.is_mine ? 'You: ' : ''}{c.last_message.body}
                  </p>
                </div>
                {c.unread_count > 0 && (
                  <span style={{
                    minWidth: 20, height: 20, borderRadius: 999,
                    background: '#ef4444', color: '#fff',
                    fontSize: 11, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 4px', flexShrink: 0,
                  }}>
                    {c.unread_count}
                  </span>
                )}
              </button>
            ))}
          </div>

        </div>
      </main>
    </>
  )
}
