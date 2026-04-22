'use client'

import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, MessageSquare, Plus, X, Send, Trash2 } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

interface Person {
  id: number
  name: string
  avatar: string | null
}

interface Conversation {
  partner: Person
  last_message: { body: string; is_mine: boolean; created_at: string }
  unread_count: number
}

interface Msg {
  id: number
  body: string
  is_mine: boolean
  created_at: string
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function Avatar({ person, size = 44 }: { person: Person; size?: number }) {
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

// ─── Thread view ──────────────────────────────────────────────────────────────

function ThreadView({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [partner,  setPartner]  = useState<Person | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading,  setLoading]  = useState(true)
  const [body,     setBody]     = useState('')
  const [sending,  setSending]  = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    api.get(`/messages/${userId}`)
      .then(({ data }) => { setPartner(data.partner); setMessages(data.data ?? []) })
      .finally(() => setLoading(false))
  }, [userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = body.trim()
    if (!text || sending) return
    setSending(true)
    setBody('')
    try {
      const { data } = await api.post(`/messages/${userId}`, { body: text })
      setMessages(m => [...m, data.data])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <button onClick={onBack}
          className="p-1.5 rounded-lg transition-colors hover:bg-[--border]"
          style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={20} />
        </button>
        {partner && (
          <>
            <Avatar person={partner} size={36} />
            <p className="font-semibold">{partner.name}</p>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading && <p className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>Loading…</p>}
        {!loading && messages.length === 0 && (
          <p className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>No messages yet. Say hi! 👋</p>
        )}
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.is_mine ? 'justify-end' : 'justify-start'}`}>
            <div style={{
              maxWidth: '75%',
              background: m.is_mine ? 'var(--primary)' : 'var(--surface)',
              color: m.is_mine ? '#000' : 'var(--text-primary)',
              border: m.is_mine ? 'none' : '1px solid var(--border)',
              borderRadius: m.is_mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              padding: '10px 14px',
            }}>
              <p className="text-sm leading-relaxed" style={{ wordBreak: 'break-word' }}>{m.body}</p>
              <p className="text-xs mt-1" style={{
                color: m.is_mine ? 'rgba(0,0,0,0.5)' : 'var(--text-muted)', textAlign: 'right',
              }}>
                {formatTime(m.created_at)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t flex gap-3 items-end"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <textarea
          ref={inputRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Type a message… (Enter to send)"
          rows={1}
          className="flex-1 rounded-2xl border px-4 py-3 text-sm outline-none focus:border-[--primary] resize-none"
          style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)', maxHeight: 120 }}
        />
        <button onClick={handleSend} disabled={!body.trim() || sending}
          className="flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ background: 'var(--primary)', color: '#000' }}>
          <Send size={17} />
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

function MessagesContent() {
  const { token } = useAuthStore()
  const router    = useRouter()
  const params    = useSearchParams()
  const userId    = params.get('user')

  const [convos,    setConvos]    = useState<Conversation[]>([])
  const [loading,   setLoading]   = useState(true)
  const [compose,   setCompose]   = useState(false)
  const [friends,   setFriends]   = useState<Person[]>([])
  const [selected,  setSelected]  = useState<Person | null>(null)
  const [body,      setBody]      = useState('')
  const [sending,   setSending]   = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [deleting,  setDeleting]  = useState<number | null>(null)

  useEffect(() => {
    if (!token) { router.replace('/login'); return }
    if (!userId) {
      api.get('/messages')
        .then(({ data }) => setConvos(data.data ?? []))
        .finally(() => setLoading(false))
    }
  }, [token, router, userId])

  const loadFriends = useCallback(() => {
    api.get('/users', { params: { friends_only: 1 } })
      .then(({ data }) => setFriends(data.data ?? []))
      .catch(() => {})
  }, [])

  async function handleDelete(partnerId: number) {
    setDeleting(partnerId)
    try {
      await api.delete(`/messages/${partnerId}`)
      setConvos(c => c.filter(x => x.partner.id !== partnerId))
    } finally { setDeleting(null) }
  }

  function openCompose() { setCompose(true); setSelected(null); setBody(''); loadFriends() }

  async function handleSend() {
    if (!selected || !body.trim()) return
    setSending(true)
    setSendError(null)
    try {
      await api.post(`/messages/${selected.id}`, { body: body.trim() })
      setCompose(false)
      router.push(`/messages?user=${selected.id}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setSendError(msg ?? 'Failed to send. Try again.')
    } finally { setSending(false) }
  }

  if (!token) return null

  // Thread view
  if (userId) {
    return <ThreadView userId={userId} onBack={() => router.push('/messages')} />
  }

  // Conversation list
  return (
    <main className="min-h-screen px-4 py-8">
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Messages</h1>
          <button onClick={openCompose}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--primary)', color: '#000' }}>
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
                <button onClick={() => setCompose(false)} style={{ color: 'var(--text-muted)' }}><X size={20} /></button>
              </div>
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>To</p>
                <div className="flex flex-wrap gap-2">
                  {friends.length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No friends yet.</p>}
                  {friends.map(f => (
                    <button key={f.id} onClick={() => setSelected(f)}
                      className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border transition-colors"
                      style={{
                        borderColor: selected?.id === f.id ? 'var(--primary)' : 'var(--border)',
                        color:       selected?.id === f.id ? 'var(--primary)' : 'var(--text-primary)',
                        background:  selected?.id === f.id ? 'rgba(57,255,20,0.08)' : 'transparent',
                      }}>
                      <Avatar person={f} size={22} />{f.name}
                    </button>
                  ))}
                </div>
              </div>
              <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write a message…" rows={4}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-[--primary] resize-none"
                style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
              {sendError && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
                  {sendError}
                </p>
              )}
              <button onClick={handleSend} disabled={!selected || !body.trim() || sending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: 'var(--primary)', color: '#000' }}>
                <Send size={15} /> {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        )}

        {loading && <div className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>}
        {!loading && convos.length === 0 && (
          <div className="text-center py-16">
            <MessageSquare size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No messages yet.</p>
          </div>
        )}

        <div className="space-y-2">
          {convos.map(c => (
            <div key={c.partner.id} className="flex items-center gap-2">
              <button onClick={() => router.push(`/messages?user=${c.partner.id}`)}
                className="flex-1 flex items-center gap-3 p-4 rounded-2xl border transition-colors hover:bg-[--border] text-left min-w-0"
                style={{ background: 'var(--surface)', borderColor: c.unread_count > 0 ? 'var(--primary)' : 'var(--border)' }}>
                <Avatar person={c.partner} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{c.partner.name}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.unread_count > 0 && (
                        <span style={{
                          minWidth: 20, height: 20, borderRadius: 999, background: '#ef4444', color: '#fff',
                          fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '0 4px',
                        }}>{c.unread_count}</span>
                      )}
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{timeAgo(c.last_message.created_at)}</span>
                    </div>
                  </div>
                  <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {c.last_message.is_mine ? 'You: ' : ''}{c.last_message.body}
                  </p>
                </div>
              </button>
              <button
                onClick={() => handleDelete(c.partner.id)}
                disabled={deleting === c.partner.id}
                title="Delete conversation"
                className="flex-shrink-0 p-2.5 rounded-xl transition-colors hover:bg-red-500/10 disabled:opacity-40"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                {deleting === c.partner.id ? '…' : <Trash2 size={16} />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}

export default function MessagesPage() {
  return (
    <>
      <Navbar />
      <Suspense>
        <MessagesContent />
      </Suspense>
    </>
  )
}
