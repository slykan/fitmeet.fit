'use client'

import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Send } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

interface Partner {
  id: number
  name: string
  avatar: string | null
}

interface Msg {
  id: number
  body: string
  is_mine: boolean
  created_at: string
  read_at: string | null
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function ThreadPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const { token }  = useAuthStore()
  const router     = useRouter()
  const [partner,  setPartner]  = useState<Partner | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading,  setLoading]  = useState(true)
  const [body,     setBody]     = useState('')
  const [sending,  setSending]  = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!token) { router.replace('/login'); return }
    api.get(`/messages/${userId}`)
      .then(({ data }) => {
        setPartner(data.partner)
        setMessages(data.data ?? [])
      })
      .finally(() => setLoading(false))
  }, [token, router, userId])

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

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      <Navbar />
      <main className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <button onClick={() => router.push('/messages')}
            className="p-1.5 rounded-lg transition-colors hover:bg-[--border]"
            style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft size={20} />
          </button>
          {partner && (
            <>
              {partner.avatar
                ? <Image src={partner.avatar} alt={partner.name} width={36} height={36}
                    className="rounded-full object-cover" />
                : <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-black"
                    style={{ background: 'var(--primary)' }}>
                    {partner.name.charAt(0).toUpperCase()}
                  </div>
              }
              <p className="font-semibold">{partner.name}</p>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading && (
            <p className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>Loading…</p>
          )}
          {!loading && messages.length === 0 && (
            <p className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
              No messages yet. Say hi! 👋
            </p>
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
                  color: m.is_mine ? 'rgba(0,0,0,0.5)' : 'var(--text-muted)',
                  textAlign: 'right',
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
            onKeyDown={handleKey}
            placeholder="Type a message… (Enter to send)"
            rows={1}
            className="flex-1 rounded-2xl border px-4 py-3 text-sm outline-none focus:border-[--primary] resize-none transition-colors"
            style={{
              background: 'var(--background)', borderColor: 'var(--border)',
              color: 'var(--text-primary)', maxHeight: 120, overflowY: 'auto',
            }}
          />
          <button
            onClick={handleSend}
            disabled={!body.trim() || sending}
            className="flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ background: 'var(--primary)', color: '#000' }}
          >
            <Send size={17} />
          </button>
        </div>

      </main>
    </>
  )
}
