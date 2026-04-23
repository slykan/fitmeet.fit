'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuthStore } from '@/store/auth'
import { Navbar } from '@/components/navbar'
import { Button } from '@/components/ui/button'
import { Bell, Calendar, Mail, MapPin, Phone, Globe, Navigation, Pencil, UserPlus } from 'lucide-react'

const RADIUS_LABELS: Record<string, string> = {
  nearby: 'Nearby (50 km)',
  city: 'City (200 km)',
  region: 'Region (500 km)',
  unlimited: 'Unlimited',
}

export default function ProfilePage() {
  const { token, user } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!token) router.replace('/login')
  }, [token, router])

  if (!user) return null

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

        {/* Email notifications */}
        <div
          className="rounded-2xl border p-6 mb-5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <h2 className="font-bold text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
            <Mail size={14} style={{ color: 'var(--primary)' }} /> Email notifications
          </h2>
          <div className="space-y-3">
            <PreferenceRow
              icon={<UserPlus size={14} />}
              label="Friend activity"
              enabled={user.email_preferences?.friend_requests ?? true}
            />
            <PreferenceRow
              icon={<Calendar size={14} />}
              label="New events near you"
              enabled={user.email_preferences?.new_events ?? true}
            />
            <PreferenceRow
              icon={<Bell size={14} />}
              label="Event reminders"
              enabled={user.email_preferences?.event_reminders ?? true}
            />
          </div>
        </div>

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
  enabled,
}: {
  icon: React.ReactNode
  label: string
  enabled: boolean
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span style={{ color: enabled ? 'var(--primary)' : 'var(--text-muted)' }}>{icon}</span>
      <span className="flex-1">{label}</span>
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full"
        style={{
          color: enabled ? 'var(--primary)' : 'var(--text-muted)',
          background: enabled ? 'rgba(57,255,20,0.08)' : 'var(--background)',
          border: '1px solid var(--border)',
        }}
      >
        {enabled ? 'On' : 'Off'}
      </span>
    </div>
  )
}
