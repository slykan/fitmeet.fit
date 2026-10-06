'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, Check, Link2, Loader2, RefreshCw } from 'lucide-react'

import api from '@/lib/api'

interface Connection {
  provider: string
  priority: number
  connected_at: string | null
  last_synced_at: string | null
  // active | revoked | insufficient_scope | unavailable — see ProviderConnection on the API
  status?: string
}

const PROVIDERS = [
  { key: 'strava', label: 'Strava', color: '#FC4C02', available: true, logo: null },
  { key: 'garmin', label: 'Garmin', color: '#00799B', available: false, logo: null },
  // Huawei brand rules: always "HUAWEI Health" (caps), with the official logo.
  { key: 'huawei', label: 'HUAWEI Health', color: '#C7000B', available: true, logo: '/brand/huawei-health.png' },
] as const

// What FitMeet reads from each provider — shown on the card so users see the data
// source and scope before and after authorizing (Huawei App Release Checklist 2.1).
const DATA_READ: Record<string, string> = {
  strava: 'Reads your completed activities',
  huawei: 'Reads your workout records (activity records) only',
}

const HUAWEI_CLIENT_ID = '118410313'
const HUAWEI_REDIRECT_URI = 'https://fitmeet.fit/huawei-callback'
// Scope strings confirmed via the AGC-approved "Activity record"/"Activity" scopes'
// Android SDK constant names (HEALTHKIT_ACTIVITY_RECORD_READ / HEALTHKIT_ACTIVITY_READ)
// following the https://www.huawei.com/healthkit/{name}.{read|write} pattern.
const HUAWEI_SCOPES = [
  'openid',
  'https://www.huawei.com/healthkit/activityrecord.read',
  'https://www.huawei.com/healthkit/activity.read',
].join(' ')

// Why a connection stopped syncing, in the user's terms (checklist 3.3 – 3.5).
const STATUS_MESSAGE: Record<string, string> = {
  revoked: 'Authorization was cancelled in the HUAWEI Health app. Reconnect to resume syncing your trainings.',
  insufficient_scope: 'Not all permissions were granted. Training sync needs both "Activity record" and "Activity" — reconnect and allow both.',
  unavailable: 'HUAWEI Health Kit is turned off or your data can\'t be accessed. Turn on HUAWEI Health Kit in the HUAWEI Health app (Me › Privacy management), then reconnect.',
}

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
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null)

  function load() {
    return api.get('/connections')
      .then(({ data }) => {
        const list: Connection[] = data.data ?? []
        setConnections(list)
        return list
      })
      .catch(() => { setConnections([]); return [] as Connection[] })
      .finally(() => setLoading(false))
  }

  // On open, ask the API to check HUAWEI Health access live — a revocation or a
  // switched-off Health Kit then shows up right away, not after the next poll.
  useEffect(() => {
    load().then(list => {
      if (list.some(c => c.provider === 'huawei')) {
        api.post('/huawei/verify')
          .then(({ data }) => setConnections(prev => prev.map(c => c.provider === 'huawei' ? { ...c, status: data.status } : c)))
          .catch(() => {})
      }
    })
  }, [])

  useEffect(() => {
    if (searchParams.get('strava_connected')) {
      setNotice('Strava connected — syncing your recent training history.')
      router.replace('/profile')
      load()
    } else if (searchParams.get('strava_error')) {
      setNotice('Could not connect Strava. Please try again.')
      router.replace('/profile')
    } else if (searchParams.get('huawei_connected')) {
      const status = searchParams.get('huawei_status')
      setNotice(status && status !== 'active'
        ? STATUS_MESSAGE[status] ?? 'HUAWEI Health connected, but training sync is not available yet.'
        : 'HUAWEI Health connected — syncing your recent training history.')
      router.replace('/profile')
      load()
    } else if (searchParams.get('huawei_error')) {
      setNotice('Could not connect HUAWEI Health. Please try again.')
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

  function connectHuawei() {
    setBusyProvider('huawei')
    const redirectUri = encodeURIComponent(HUAWEI_REDIRECT_URI)
    const scope = encodeURIComponent(HUAWEI_SCOPES)
    window.location.href =
      `https://oauth-login.cloud.huawei.com/oauth2/v3/authorize?` +
      `response_type=code&client_id=${HUAWEI_CLIENT_ID}` +
      `&redirect_uri=${redirectUri}&scope=${scope}&state=web-connect&access_type=offline`
  }

  async function resyncProvider(providerKey: string, label: string) {
    setBusyProvider(`${providerKey}-resync`)
    setNotice(null)
    try {
      const { data } = await api.post(`/${providerKey}/resync`)
      setNotice(`Resynced — refreshed ${data.synced} training(s) with full detail.`)
      load()
    } catch (e: unknown) {
      const status = (e as { response?: { data?: { status?: string } } })?.response?.data?.status
      setNotice(status && STATUS_MESSAGE[status] ? STATUS_MESSAGE[status] : `Could not resync ${label}. Please try again.`)
      load()
    } finally {
      setBusyProvider(null)
    }
  }

  async function disconnectProvider(providerKey: string, label: string, keepTrainings = true) {
    setConfirmDisconnect(null)
    setBusyProvider(providerKey)
    try {
      const { data } = await api.delete(`/${providerKey}/connect`, { data: { keep_trainings: keepTrainings, source: 'web' } })
      setConnections(prev => prev.filter(c => c.provider !== providerKey))
      setNotice(providerKey === 'huawei'
        ? `HUAWEI Health disconnected — FitMeet no longer has access to your HUAWEI Health data.${data?.trainings_deleted ? ` ${data.trainings_deleted} imported training(s) deleted.` : ' Already imported trainings were kept.'}`
        : `${label} disconnected.`)
    } catch {
      setNotice(`Could not disconnect ${label}. Please try again.`)
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

      <div className="space-y-4">
        {PROVIDERS.map(p => {
          const connection = connections.find(c => c.provider === p.key)
          const isBusy = busyProvider === p.key
          const isResyncing = busyProvider === `${p.key}-resync`
          const anyBusy = busyProvider !== null
          const problem = connection && connection.status && connection.status !== 'active' ? connection.status : null

          return (
            <div key={p.key}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {p.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.logo} alt={p.label} width={36} height={36} className="w-9 h-9 rounded-lg shrink-0 object-contain" />
                  ) : (
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${p.color}1a` }}
                    >
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{p.label}</p>
                    <p className="text-xs" style={{ color: problem ? '#f87171' : 'var(--text-muted)' }}>
                      {!p.available
                        ? 'Coming soon'
                        : problem
                          ? 'Sync paused — action needed'
                          : connection
                            ? `Authorized · last synced ${timeAgo(connection.last_synced_at)}`
                            : 'Not connected'}
                    </p>
                    {p.available && DATA_READ[p.key] && (
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{DATA_READ[p.key]}</p>
                    )}
                  </div>
                </div>

                {p.available && !loading && (
                  connection ? (
                    <div className="shrink-0 flex items-center gap-2">
                      {problem ? (
                        <button
                          onClick={p.key === 'huawei' ? connectHuawei : connectStrava}
                          disabled={anyBusy}
                          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                          style={{ background: p.color, color: '#fff' }}
                        >
                          {isBusy && <Loader2 size={12} className="animate-spin" />}
                          Reconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => resyncProvider(p.key, p.label)}
                          disabled={anyBusy}
                          title="Re-fetch full detail (heart rate, power, calories...) for recent activities"
                          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                        >
                          {isResyncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                          Resync
                        </button>
                      )}
                      <button
                        onClick={() => p.key === 'huawei' ? setConfirmDisconnect('huawei') : disconnectProvider(p.key, p.label)}
                        disabled={anyBusy}
                        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                      >
                        {isBusy && !problem ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} style={{ color: p.color }} />}
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={p.key === 'huawei' ? connectHuawei : connectStrava}
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

              {problem && STATUS_MESSAGE[problem] && (
                <div className="mt-2 flex gap-2 items-start rounded-lg p-3 text-xs"
                  style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.35)', color: 'var(--text)' }}>
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: '#f87171' }} />
                  <span>{STATUS_MESSAGE[problem]}</span>
                </div>
              )}

              {confirmDisconnect === p.key && (
                <div className="mt-2 rounded-lg p-3 text-xs space-y-2"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <p className="font-semibold">Disconnect {p.label}?</p>
                  <p style={{ color: 'var(--text-muted)' }}>
                    FitMeet will stop reading your {p.label} data and the authorization will be revoked.
                    Do you want to keep the trainings already imported from {p.label}?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => disconnectProvider(p.key, p.label, true)}
                      className="px-3 py-1.5 rounded-lg font-semibold" style={{ background: 'var(--primary)', color: '#000' }}>
                      Disconnect, keep trainings
                    </button>
                    <button onClick={() => disconnectProvider(p.key, p.label, false)}
                      className="px-3 py-1.5 rounded-lg font-semibold border" style={{ borderColor: 'rgba(248,113,113,0.5)', color: '#f87171' }}>
                      Disconnect and delete trainings
                    </button>
                    <button onClick={() => setConfirmDisconnect(null)}
                      className="px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
