'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Star } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { useAuthStore } from '@/store/auth'
import api from '@/lib/api'

interface UserProfile {
  id: number
  name: string
  avatar: string | null
  home: { city: string | null; country: string | null }
  categories: string[]
  skill_level: string | null
  member_since: string | null
  is_self: boolean
  friendship_status: 'friends' | 'pending_sent' | 'pending_received' | null
  beer_score: number
  stats: {
    events_created: number
    events_joined:  number
    check_ins:      number
    comments:       number
    moments:        number
    beers:          number
  }
}

const STAT_ROWS: { key: keyof UserProfile['stats']; label: string; emoji: string; color: string }[] = [
  { key: 'events_created', label: 'Events created', emoji: '🗓',  color: '#39ff14' },
  { key: 'events_joined',  label: 'Events joined',  emoji: '🏃',  color: '#00a8ff' },
  { key: 'check_ins',      label: 'Check-ins',      emoji: '✅',  color: '#fbbf24' },
  { key: 'comments',       label: 'Comments',        emoji: '💬',  color: '#a78bfa' },
  { key: 'moments',        label: 'Moments',         emoji: '📸',  color: '#fb923c' },
  { key: 'beers',          label: 'Beers bought',   emoji: '🍺',  color: '#f59e0b' },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function UserProfileContent() {
  const searchParams = useSearchParams()
  const userId = searchParams.get('id')
  const router   = useRouter()
  const { token } = useAuthStore()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [animate, setAnimate] = useState(false)
  const [zoom,    setZoom]    = useState(false)
  const [acting,  setActing]  = useState(false)

  useEffect(() => {
    if (!token) { router.replace('/login'); return }
    if (!userId) { router.replace('/meet'); return }
    api.get(`/users/${userId}`).then(({ data }) => {
      setProfile(data)
      requestAnimationFrame(() => setTimeout(() => setAnimate(true), 80))
    }).catch(() => router.replace('/meet'))
  }, [token, userId, router])

  async function handleFriendAction() {
    if (!profile || acting) return
    setActing(true)
    try {
      if (profile.friendship_status === null) {
        await api.post(`/friends/request/${profile.id}`)
        setProfile(p => p ? { ...p, friendship_status: 'pending_sent' } : p)
      } else if (profile.friendship_status === 'pending_received') {
        const fr = await api.get('/notifications').then(({ data }) =>
          data.data?.find((n: { type: string; friend_request_id: number }) => n.type === 'friend_request')
        ).catch(() => null)
        if (fr?.friend_request_id) {
          await api.post(`/friends/accept/${fr.friend_request_id}`)
          setProfile(p => p ? { ...p, friendship_status: 'friends' } : p)
        }
      } else if (profile.friendship_status === 'friends') {
        await api.delete(`/friends/${profile.id}`)
        setProfile(p => p ? { ...p, friendship_status: null } : p)
      }
    } catch {}
    setActing(false)
  }

  if (!profile) {
    return (
      <>
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center" style={{ color: 'var(--text-muted)' }}>
          Loading…
        </div>
      </>
    )
  }

  const maxVal = Math.max(1, ...Object.values(profile.stats))
  const total  = Object.values(profile.stats).reduce((a, b) => a + b, 0)

  const friendBtnLabel =
    profile.friendship_status === 'friends'        ? '✓ Friends'         :
    profile.friendship_status === 'pending_sent'   ? 'Request sent'      :
    profile.friendship_status === 'pending_received'? 'Accept request'    : 'Add friend'

  return (
    <>
      <Navbar />

      {/* Avatar lightbox */}
      {zoom && profile.avatar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-zoom-out"
          onClick={() => setZoom(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={profile.avatar} alt={profile.name} className="max-w-[90vw] max-h-[90vh] rounded-2xl object-contain" />
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/meet" className="inline-flex items-center gap-2 text-sm mb-8 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={14} /> Back
        </Link>

        {/* Avatar + name */}
        <div className="flex items-start gap-5 mb-8">
          <button
            onClick={() => profile.avatar && setZoom(true)}
            className="shrink-0 rounded-2xl overflow-hidden"
            style={{ cursor: profile.avatar ? 'zoom-in' : 'default' }}
          >
            {profile.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar} alt={profile.name} width={96} height={96} className="w-24 h-24 object-cover" />
            ) : (
              <div className="w-24 h-24 flex items-center justify-center text-3xl font-black text-black" style={{ background: 'var(--primary)' }}>
                {profile.name.charAt(0).toUpperCase()}
              </div>
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl font-bold">{profile.name}</h1>
              {profile.beer_score > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                  🍺 ×{profile.beer_score}
                </span>
              )}
            </div>
            {(profile.home.city || profile.home.country) && (
              <p className="text-sm flex items-center gap-1.5 mb-1" style={{ color: 'var(--text-muted)' }}>
                <MapPin size={12} /> {[profile.home.city, profile.home.country].filter(Boolean).join(', ')}
              </p>
            )}
            {profile.skill_level && (
              <p className="text-sm flex items-center gap-1.5 mb-2" style={{ color: 'var(--text-muted)' }}>
                <Star size={12} /> {profile.skill_level}
              </p>
            )}
            {profile.member_since && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Member since {formatDate(profile.member_since)}</p>
            )}
          </div>

          {!profile.is_self && (
            <button
              onClick={handleFriendAction}
              disabled={acting || profile.friendship_status === 'pending_sent'}
              className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold border transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                background: profile.friendship_status === 'friends' ? 'rgba(57,255,20,0.1)' : 'var(--surface)',
                borderColor: profile.friendship_status === 'friends' ? 'rgba(57,255,20,0.3)' : 'var(--border)',
                color: profile.friendship_status === 'friends' ? 'var(--primary)' : 'var(--text-primary)',
              }}
            >
              {friendBtnLabel}
            </button>
          )}
        </div>

        {/* Categories */}
        {profile.categories.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            {profile.categories.map(cat => (
              <span key={cat} className="px-3 py-1 rounded-full text-xs font-semibold border"
                style={{ borderColor: 'rgba(57,255,20,0.3)', color: 'var(--primary)', background: 'rgba(57,255,20,0.07)' }}>
                {cat.replace('_', ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Total + verdict */}
        <div className="rounded-2xl border p-5 mb-5 flex items-center justify-between"
          style={{ background: 'var(--surface)', borderColor: 'rgba(57,255,20,0.2)' }}>
          <div>
            <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>Activity score</p>
            <p className="text-4xl font-black" style={{ color: 'var(--primary)' }}>{total}</p>
          </div>
          <p className="text-sm font-bold">
            {total === 0 ? '😴 Just joined'
              : total < 10 ? '🚶 Getting started'
              : total < 30 ? '🏃 Picking up pace'
              : total < 60 ? '💪 Solid presence'
              : total < 100 ? '🔥 Highly active'
              : '⚡ Local legend'}
          </p>
        </div>

        {/* Alibi bars */}
        <div className="rounded-2xl border p-5 sm:p-7 space-y-5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h2 className="font-bold text-base flex items-center gap-2">🕵️ Alibi</h2>
          {STAT_ROWS.map(({ key, label, emoji, color }) => {
            const val = profile.stats[key]
            const pct = (val / maxVal) * 100
            return (
              <div key={key}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{emoji} {label}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color }}>{val}</span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full" style={{
                    width: animate ? `${Math.max(pct, val > 0 ? 3 : 0)}%` : '0%',
                    backgroundColor: color,
                    transition: 'width 0.75s cubic-bezier(0.4,0,0.2,1)',
                    boxShadow: `0 0 6px ${color}55`,
                  }} />
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </>
  )
}

export default function UserProfilePage() {
  return (
    <Suspense>
      <UserProfileContent />
    </Suspense>
  )
}
