'use client'

import { useRouter } from 'next/navigation'
import { type ChangeEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { Navbar } from '@/components/navbar'
import { Button } from '@/components/ui/button'
import { Bell, Calendar, Camera, Mail, MapPin, Phone, Globe, Navigation, Pencil, Trash2, UserPlus } from 'lucide-react'
import api from '@/lib/api'

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

      </main>
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
