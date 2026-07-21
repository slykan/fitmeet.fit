'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Check, Link2, Loader2 } from 'lucide-react'

import api from '@/lib/api'

interface Connection {
  provider: string
  priority: number
  connected_at: string | null
  last_synced_at: string | null
}

const PROVIDERS = [
  { key: 'strava', label: 'Strava', color: '#FC4C02', available: true },
  { key: 'garmin', label: 'Garmin', color: '#00799B', available: false },
  { key: 'huawei', label: 'Huawei Health', color: '#C7000B', available: false },
] as const

function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function ConnectedAppsCard() {
  return (
    <Suspense fallback={null}>
      <ConnectedAppsCardInner />
    </Suspense>
  )
}

function ConnectedAppsCardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [busyProvider, setBusyProvider] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function load() {
    api.get('/connections')
      .then(({ data }) => setConnections(data.data ?? []))
      .catch(() => setConnections([]))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  useEffect(() => {
    if (searchParams.get('strava_connected')) {
      setNotice('Strava connected — syncing your recent training history.')
      router.replace('/profile')
      load()
    } else if (searchParams.get('strava_error')) {
      setNotice('Could not connect Strava. Please try again.')
      router.replace('/profile')
    }
  }, [searchParams, router])

  function connectStrava() {
    setBusyProvider('strava')
    const redirectUri = encodeURIComponent('https://fitmeet.fit/strava-callback')
    window.location.href =
      `https://www.strava.com/oauth/authorize?client_id=234864` +
      `&redirect_uri=${redirectUri}&response_type=code&approval_prompt=auto` +
      `&scope=read,activity:read_all&state=web-connect`
  }

  async function disconnectStrava() {
    setBusyProvider('strava')
    try {
      await api.delete('/strava/connect')
      setConnections(prev => prev.filter(c => c.provider !== 'strava'))
    } catch {
      setNotice('Could not disconnect Strava. Please try again.')
    } finally {
      setBusyProvider(null)
    }
  }

  return (
    <div
      className="rounded-2xl border p-4 sm:p-6 mb-5"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <h2 className="font-bold text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
        <Link2 size={14} style={{ color: 'var(--primary)' }} /> Connected apps
      </h2>
      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        Sync your training history automatically into the Trainings tab under Meet.
      </p>

      {notice && (
        <p className="text-xs mb-4" style={{ color: 'var(--primary)' }}>{notice}</p>
      )}

      <div className="space-y-3">
        {PROVIDERS.map(p => {
          const connection = connections.find(c => c.provider === p.key)
          const isBusy = busyProvider === p.key

          return (
            <div key={p.key} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${p.color}1a` }}
                >
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{p.label}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {!p.available
                      ? 'Coming soon'
                      : connection
                        ? `Connected · last synced ${timeAgo(connection.last_synced_at)}`
                        : 'Not connected'}
                  </p>
                </div>
              </div>

              {p.available && !loading && (
                connection ? (
                  <button
                    onClick={disconnectStrava}
                    disabled={isBusy}
                    className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                  >
                    {isBusy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} style={{ color: p.color }} />}
                    Disconnect
                  </button>
                ) : (
                  <button
                    onClick={connectStrava}
                    disabled={isBusy}
                    className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{ background: p.color, color: '#fff' }}
                  >
                    {isBusy && <Loader2 size={12} className="animate-spin" />}
                    Connect
                  </button>
                )
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
