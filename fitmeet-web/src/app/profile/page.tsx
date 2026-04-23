'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { Navbar } from '@/components/navbar'
import { Button } from '@/components/ui/button'
import { Bell, Calendar, Mail, MapPin, Phone, Globe, Navigation, Pencil, UserPlus } from 'lucide-react'
import api from '@/lib/api'

const RADIUS_LABELS: Record<string, string> = {
  nearby: 'Nearby (50 km)',
  city: 'City (200 km)',
  region: 'Region (500 km)',
  unlimited: 'Unlimited',
}

type EmailPreferenceField = 'email_friend_requests' | 'email_new_events' | 'email_event_reminders'

export default function ProfilePage() {
  const { token, user, setUser } = useAuthStore()
  const router = useRouter()
  const [savingPreference, setSavingPreference] = useState<EmailPreferenceField | null>(null)
  const [preferenceError, setPreferenceError] = useState<string | null>(null)

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

  const friendEmails = user.email_preferences?.friend_requests ?? true
  const newEventEmails = user.email_preferences?.new_events ?? true
  const reminderEmails = user.email_preferences?.event_reminders ?? true

  return (
    <>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div
          className="rounded-2xl border p-7 flex items-center gap-5 mb-5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {user.avatar ? (
            <Image src={user.avatar} alt={user.name} width={72} height={72} className="rounded-full ring-2 ring-[--border]" />
          ) : (
            <div
              className="w-18 h-18 rounded-full flex items-center justify-center text-black font-bold text-2xl shrink-0"
              style={{ background: 'var(--primary)', width: 72, height: 72 }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{user.name}</h1>
            <p className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
            {user.phone && (
              <p className="text-sm mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                <Phone size={12} /> {user.phone}
              </p>
            )}
          </div>
          <Link href="/onboarding">
            <Button size="sm" variant="ghost">
              <Pencil size={14} className="mr-1.5" /> Edit
            </Button>
          </Link>
        </div>

        {/* Email notifications */}
        <div
          className="rounded-2xl border p-6 mb-5"
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
          </div>
          {preferenceError && (
            <p className="text-xs mt-4 text-red-400">{preferenceError}</p>
          )}
        </div>

        {/* Location */}
        <div
          className="rounded-2xl border p-6 mb-5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <h2 className="font-bold text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
            <MapPin size={14} style={{ color: 'var(--primary)' }} /> Location
          </h2>
          {user.home.city ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Globe size={14} style={{ color: 'var(--text-muted)' }} />
                <span>{user.home.city}{user.home.country ? `, ${user.home.country}` : ''}</span>
              </div>
              {user.home.lat && user.home.lng && (
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  📍 {user.home.lat?.toFixed(4)}, {user.home.lng?.toFixed(4)}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm mt-2">
                <Navigation size={14} style={{ color: 'var(--text-muted)' }} />
                <span>{RADIUS_LABELS[user.radius] ?? user.radius}</span>
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
            className="rounded-2xl border p-6 mb-5"
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
    <div className="flex items-center gap-3 text-sm">
      <span style={{ color: enabled ? 'var(--primary)' : 'var(--text-muted)' }}>{icon}</span>
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
        className="relative h-7 w-12 rounded-full border transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
