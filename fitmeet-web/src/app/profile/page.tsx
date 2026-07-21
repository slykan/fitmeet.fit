'use client'

import { useRouter } from 'next/navigation'
import { type ChangeEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { Navbar } from '@/components/navbar'
import { Button } from '@/components/ui/button'
import { BadgeGrid } from '@/components/badge-grid'
import { ConnectedAppsCard } from '@/components/connected-apps-card'
import { AlertTriangle, Bell, Calendar, Camera, Mail, MapPin, Phone, Globe, Navigation, Pencil, Trash2, UserPlus } from 'lucide-react'
import api from '@/lib/api'

interface AlibiStats {
  events_created: number
  events_joined:  number
  check_ins:      number
  comments:       number
  moments:        number
  beers:          number
}

const ALIBI_ROWS: { key: keyof AlibiStats; label: string; emoji: string; color: string }[] = [
  { key: 'events_created', label: 'Events created', emoji: '🗓',  color: '#39ff14' },
  { key: 'events_joined',  label: 'Events joined',  emoji: '🏃',  color: '#00a8ff' },
  { key: 'check_ins',      label: 'Check-ins',      emoji: '✅',  color: '#fbbf24' },
  { key: 'comments',       label: 'Comments',        emoji: '💬',  color: '#a78bfa' },
  { key: 'moments',        label: 'Moments',         emoji: '📸',  color: '#fb923c' },
  { key: 'beers',          label: 'Beers bought',   emoji: '🍺',  color: '#f59e0b' },
]

function AlibiCard() {
  const [stats,   setStats]   = useState<AlibiStats | null>(null)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    api.get('/me/stats').then(({ data }) => {
      setStats(data)
      requestAnimationFrame(() => setTimeout(() => setAnimate(true), 80))
    }).catch(() => {})
  }, [])

  const maxVal = stats ? Math.max(1, ...Object.values(stats)) : 1

  return (
    <div
      className="rounded-2xl border p-4 sm:p-6 mb-5"
      style={{ background: 'var(--surface)', borderColor: 'rgba(57,255,20,0.2)' }}
    >
      <div className="flex items-center gap-3 mb-5">
        <span className="text-2xl">🕵️</span>
        <div>
          <h2 className="font-bold text-base">Your Alibi</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Proof you actually went outside</p>
        </div>
      </div>

      <div className="space-y-4">
        {ALIBI_ROWS.map(({ key, label, emoji, color }) => {
          const val = stats?.[key] ?? 0
          const pct = (val / maxVal) * 100
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                  <span>{emoji}</span> {label}
                </span>
                <span className="text-sm font-bold tabular-nums" style={{ color }}>{val}</span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: animate ? `${pct}%` : '0%',
                    backgroundColor: color,
                    transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
                    opacity: 0.9,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const RADIUS_LABELS: Record<string, string> = {
  nearby: 'Nearby (50 km)',
  city: 'City (200 km)',
  region: 'Region (500 km)',
  unlimited: 'Unlimited',
}

type EmailPreferenceField = 'email_friend_requests' | 'email_new_events' | 'email_event_reminders' | 'email_friend_events'

export default function ProfilePage() {
  const { token, user, setUser } = useAuthStore()
  const router = useRouter()
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const [savingPreference, setSavingPreference] = useState<EmailPreferenceField | null>(null)
  const [preferenceError, setPreferenceError] = useState<string | null>(null)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) router.replace('/login')
  }, [token, router])

  if (!user) return null

  async function toggleEmailPreference(field: EmailPreferenceField, current: boolean) {
    setSavingPreference(field)
    setPreferenceError(null)
    try {
      const { data: res } = await api.patch('/me', { [field]: !current })
      setUser(res.data)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
      const msg =
        e?.response?.data?.message ??
        Object.values(e?.response?.data?.errors ?? {})[0]?.[0] ??
        'Could not save email settings.'
      setPreferenceError(msg)
    } finally {
      setSavingPreference(null)
    }
  }

  const friendEmails      = user.email_preferences?.friend_requests ?? true
  const newEventEmails    = user.email_preferences?.new_events ?? true
  const reminderEmails    = user.email_preferences?.event_reminders ?? true
  const friendEventEmails = (user.email_preferences as { friend_events?: boolean })?.friend_events ?? true

  async function uploadAvatar(file: File) {
    const formData = new FormData()
    formData.append('avatar_file', file)

    setAvatarLoading(true)
    setAvatarError(null)
    try {
      const { data: res } = await api.post('/me/avatar', formData)
      setUser(res.data)
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } }; message?: string }
      const msg =
        e?.response?.data?.message ??
        Object.values(e?.response?.data?.errors ?? {})[0]?.[0] ??
        e?.message ??
        'Could not update profile photo.'
      const status = e?.response?.status
      setAvatarError(status ? `${msg} (HTTP ${status})` : msg)
    } finally {
      setAvatarLoading(false)
      if (avatarInputRef.current) {
        avatarInputRef.current.value = ''
      }
    }
  }

  async function removeAvatar() {
    setAvatarLoading(true)
    setAvatarError(null)
    try {
      const { data: res } = await api.post('/me/avatar', { avatar_remove: true })
      setUser(res.data)
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } }; message?: string }
      const msg =
        e?.response?.data?.message ??
        Object.values(e?.response?.data?.errors ?? {})[0]?.[0] ??
        e?.message ??
        'Could not remove profile photo.'
      const status = e?.response?.status
      setAvatarError(status ? `${msg} (HTTP ${status})` : msg)
    } finally {
      setAvatarLoading(false)
    }
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    uploadAvatar(file)
  }

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-10 overflow-x-hidden">

        {/* Header */}
        <div
          className="rounded-2xl border p-4 sm:p-7 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:gap-5 mb-5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {/* Avatar + photo buttons */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            {user.avatar ? (
              <Image src={user.avatar} alt={user.name} width={72} height={72} className="rounded-full ring-2 ring-[--border]" />
            ) : (
              <div
                className="rounded-full flex items-center justify-center text-black font-bold text-2xl"
                style={{ background: 'var(--primary)', width: 72, height: 72 }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <div className="flex flex-wrap items-center justify-center gap-1.5 w-full">
              <Button
                size="sm"
                variant="ghost"
                loading={avatarLoading}
                onClick={() => avatarInputRef.current?.click()}
              >
                <Camera size={13} className="mr-1" />
                {user.avatar ? 'Change' : 'Upload'}
              </Button>
              {user.avatar && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={avatarLoading}
                  onClick={removeAvatar}
                >
                  <Trash2 size={13} className="mr-1" />
                  Remove
                </Button>
              )}
            </div>
            {avatarError && (
              <p className="text-xs text-red-400 text-center">{avatarError}</p>
            )}
          </div>

          {/* User info */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h1 className="text-xl font-bold break-words">{user.name}</h1>
            <p className="text-sm break-all sm:break-normal" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
            {user.phone && (
              <p className="text-sm mt-0.5 flex items-center justify-center sm:justify-start gap-1.5 break-all" style={{ color: 'var(--text-muted)' }}>
                <Phone size={12} /> {user.phone}
              </p>
            )}
          </div>

          <Link href="/onboarding" className="w-full sm:w-auto">
            <Button size="sm" variant="ghost" className="w-full sm:w-auto">
              <Pencil size={14} className="mr-1.5" /> Edit
            </Button>
          </Link>
        </div>

        <AlibiCard />

        <BadgeGrid />

        <ConnectedAppsCard />

        {/* Email notifications */}
        <div
          className="rounded-2xl border p-4 sm:p-6 mb-5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <h2 className="font-bold text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
            <Mail size={14} style={{ color: 'var(--primary)' }} /> Email settings
          </h2>
          <div className="space-y-3">
            <PreferenceRow
              icon={<UserPlus size={14} />}
              label="Friend activity"
              description="Friend requests and accepted requests."
              enabled={friendEmails}
              disabled={savingPreference !== null}
              onToggle={() => toggleEmailPreference('email_friend_requests', friendEmails)}
            />
            <PreferenceRow
              icon={<Calendar size={14} />}
              label="New events near you"
              description="Events that match your interests and radius."
              enabled={newEventEmails}
              disabled={savingPreference !== null}
              onToggle={() => toggleEmailPreference('email_new_events', newEventEmails)}
            />
            <PreferenceRow
              icon={<Bell size={14} />}
              label="Event reminders"
              description="Reminder emails for events you joined."
              enabled={reminderEmails}
              disabled={savingPreference !== null}
              onToggle={() => toggleEmailPreference('email_event_reminders', reminderEmails)}
            />
            <PreferenceRow
              icon={<UserPlus size={14} />}
              label="Friends' new events"
              description="When a friend creates a new event."
              enabled={friendEventEmails}
              disabled={savingPreference !== null}
              onToggle={() => toggleEmailPreference('email_friend_events' as EmailPreferenceField, friendEventEmails)}
            />
          </div>
          {preferenceError && (
            <p className="text-xs mt-4 text-red-400">{preferenceError}</p>
          )}
        </div>

        {/* Location */}
        <div
          className="rounded-2xl border p-4 sm:p-6 mb-5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <h2 className="font-bold text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
            <MapPin size={14} style={{ color: 'var(--primary)' }} /> Location
          </h2>
          {user.home.city ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm min-w-0">
                <Globe size={14} style={{ color: 'var(--text-muted)' }} />
                <span className="break-words">{user.home.city}{user.home.country ? `, ${user.home.country}` : ''}</span>
              </div>
              {user.home.lat && user.home.lng && (
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  📍 {user.home.lat?.toFixed(4)}, {user.home.lng?.toFixed(4)}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm mt-2 min-w-0">
                <Navigation size={14} style={{ color: 'var(--text-muted)' }} />
                <span className="break-words">{RADIUS_LABELS[user.radius] ?? user.radius}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No location set. <Link href="/onboarding" className="underline" style={{ color: 'var(--primary)' }}>Add location</Link>
            </p>
          )}
        </div>

        {/* Interests */}
        {(user.categories?.length > 0 || user.skill_level) && (
          <div
            className="rounded-2xl border p-4 sm:p-6 mb-5"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <h2 className="font-bold text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
              <Navigation size={14} style={{ color: 'var(--primary)' }} /> Interests
            </h2>
            {user.categories?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {user.categories.map(cat => (
                  <span
                    key={cat}
                    className="px-3 py-1 rounded-full text-sm border"
                    style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(57,255,20,0.08)' }}
                  >
                    {cat.replace('_', ' ')}
                  </span>
                ))}
              </div>
            )}
            {user.skill_level && (
              <span className="text-sm capitalize" style={{ color: 'var(--text-muted)' }}>
                Level: <strong style={{ color: 'var(--text-primary)' }}>{user.skill_level}</strong>
              </span>
            )}
          </div>
        )}

        {/* No profile yet */}
        {!user.home.city && !user.categories?.length && (
          <div className="text-center py-8">
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Your profile is not complete yet.</p>
            <Link href="/onboarding">
              <Button>Complete profile</Button>
            </Link>
          </div>
        )}

        <DangerZone />

      </main>
    </>
  )
}

function DangerZone() {
  const { logout } = useAuthStore()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)
    try {
      await api.delete('/me')
      logout()
      router.replace('/')
    } catch {
      setError('Something went wrong. Please try again or contact support.')
      setLoading(false)
    }
  }

  return (
    <>
      <div
        className="rounded-2xl border p-4 sm:p-6 mt-2"
        style={{ borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.04)' }}
      >
        <h2 className="font-bold text-sm uppercase tracking-wide mb-1 flex items-center gap-2" style={{ color: '#ef4444' }}>
          <AlertTriangle size={14} /> Danger zone
        </h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          Irreversible actions that permanently affect your account.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Delete account</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Permanently deletes your account, profile, events you organised, and all associated data.
              This action cannot be undone.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ background: '#ef4444', color: '#fff' }}
          >
            <Trash2 size={14} /> Delete account
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border p-6"
            style={{ background: 'var(--surface)', borderColor: 'rgba(239,68,68,0.4)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(239,68,68,0.12)' }}>
                <AlertTriangle size={18} style={{ color: '#ef4444' }} />
              </div>
              <div>
                <h3 className="font-bold text-base">Delete your account?</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>This cannot be undone.</p>
              </div>
            </div>

            <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
              The following will be permanently deleted:
            </p>
            <ul className="text-sm space-y-1 mb-5 pl-1" style={{ color: 'var(--text-muted)' }}>
              {['Your profile, name, and avatar', 'Events you organised', 'Your comments and check-ins', 'Friend connections and messages'].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <span style={{ color: '#ef4444' }}>×</span> {item}
                </li>
              ))}
            </ul>

            {error && <p className="text-xs text-red-400 mb-4">{error}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-60"
                style={{ background: '#ef4444', color: '#fff' }}
              >
                {loading ? 'Deleting…' : 'Yes, delete account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PreferenceRow({
  icon,
  label,
  description,
  enabled,
  disabled,
  onToggle,
}: {
  icon: ReactNode
  label: string
  description: string
  enabled: boolean
  disabled: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="mt-0.5 shrink-0" style={{ color: enabled ? 'var(--primary)' : 'var(--text-muted)' }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={enabled}
        aria-label={`${label} email notifications`}
        className="relative h-7 w-12 min-w-12 shrink-0 rounded-full border transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        style={{
          background: enabled ? 'var(--primary)' : 'var(--background)',
          borderColor: enabled ? 'var(--primary)' : 'var(--border)',
        }}
      >
        <span
          className="absolute top-1 h-5 w-5 rounded-full bg-black transition-transform"
          style={{ left: 4, transform: enabled ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  )
}
