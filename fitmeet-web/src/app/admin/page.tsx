'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Megaphone, Send, Clock, Globe, Smartphone, Monitor } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

interface Broadcast {
  id: number
  title: string
  body: string
  target_platform: string | null
  target_country: string | null
  sent_by: string
  created_at: string
}

const PLATFORMS = [
  { value: '',        label: 'All platforms',  icon: Globe },
  { value: 'android', label: 'Android only',   icon: Smartphone },
  { value: 'ios',     label: 'iOS only',        icon: Smartphone },
  { value: 'web',     label: 'Web only',        icon: Monitor },
]

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function AdminPage() {
  const { token, user } = useAuthStore()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  const [title,    setTitle]    = useState('')
  const [body,     setBody]     = useState('')
  const [link,     setLink]     = useState('')
  const [platform, setPlatform] = useState('')
  const [country,  setCountry]  = useState('')
  const [countries, setCountries] = useState<string[]>([])

  const [sending,   setSending]   = useState(false)
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted) return
    if (!token) { router.replace('/login?redirect=/admin'); return }
    if (user && !user.is_admin) { router.replace('/'); return }

    Promise.all([
      api.get('/admin/broadcasts'),
      api.get('/admin/countries'),
    ]).then(([bRes, cRes]) => {
      setBroadcasts(bRes.data)
      setCountries(cRes.data)
    }).finally(() => setLoading(false))
  }, [mounted, token, user, router])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setSending(true)
    setError('')
    setSuccess('')
    try {
      await api.post('/admin/broadcast', {
        title: title.trim(),
        body:  body.trim(),
        data:  link.trim() ? { url: link.trim() } : undefined,
        target_platform: platform || null,
        target_country:  country  || null,
      })
      setSuccess('Broadcast sent!')
      setTitle('')
      setBody('')
      setLink('')
      const { data } = await api.get('/admin/broadcasts')
      setBroadcasts(data)
    } catch {
      setError('Failed to send broadcast.')
    } finally {
      setSending(false)
    }
  }

  if (!mounted || loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen flex items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 py-8">
        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(57,255,20,0.12)', border: '1px solid rgba(57,255,20,0.3)' }}>
              <Megaphone size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold">Broadcast</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Send push notification + in-app alert</p>
            </div>
          </div>

          {/* Compose form */}
          <form onSubmit={handleSend}
            className="rounded-2xl border p-6 mb-8 space-y-4"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                TITLE
              </label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={120}
                placeholder="Short headline…"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                MESSAGE
              </label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="What do you want to tell users…"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
              <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-muted)' }}>{body.length}/500</p>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                LINK (OPTIONAL)
              </label>
              <input
                value={link}
                onChange={e => setLink(e.target.value)}
                placeholder="https://…"
                type="url"
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  PLATFORM
                </label>
                <select
                  value={platform}
                  onChange={e => setPlatform(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  {PLATFORMS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  COUNTRY
                </label>
                <select
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  <option value="">All countries</option>
                  {countries.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {error   && <p className="text-sm text-red-400">{error}</p>}
            {success && <p className="text-sm" style={{ color: 'var(--primary)' }}>{success}</p>}

            <button
              type="submit"
              disabled={sending || !title.trim() || !body.trim()}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: 'var(--primary)', color: '#000' }}>
              <Send size={15} />
              {sending ? 'Sending…' : 'Send broadcast'}
            </button>
          </form>

          {/* History */}
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>SENT BROADCASTS</h2>

          {broadcasts.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No broadcasts yet.</p>
          )}

          <div className="space-y-3">
            {broadcasts.map(b => (
              <div key={b.id}
                className="rounded-2xl border p-4"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{b.title}</p>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{b.body}</p>
                  </div>
                  <p className="text-xs flex-shrink-0 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <Clock size={11} /> {timeAgo(b.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  {b.target_platform ? (
                    <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                      style={{ background: 'rgba(57,255,20,0.1)', color: 'var(--primary)' }}>
                      {b.target_platform}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                      style={{ background: 'rgba(136,136,170,0.1)', color: 'var(--text-muted)' }}>
                      all platforms
                    </span>
                  )}
                  {b.target_country ? (
                    <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                      style={{ background: 'rgba(57,255,20,0.1)', color: 'var(--primary)' }}>
                      {b.target_country}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                      style={{ background: 'rgba(136,136,170,0.1)', color: 'var(--text-muted)' }}>
                      all countries
                    </span>
                  )}
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>by {b.sent_by}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </main>
    </>
  )
}
