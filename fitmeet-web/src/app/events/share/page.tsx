'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { Calendar, Lock, MapPin, Share2, Users, Zap } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import { Button } from '@/components/ui/button'
import { shortAddress } from '@/lib/format-address'
import { useAuthStore } from '@/store/auth'

const LocationPickerMap = dynamic(() => import('@/components/location-picker-map'), { ssr: false })

interface SharedEvent {
  id: number
  title: string
  description: string | null
  category: { value: string; label: string }
  location: { lat: number; lng: number; address: string | null }
  schedule: { start_at: string; duration_minutes: number | null }
  activity: { distance_km: number | null; elevation_gain: number | null; pace: string | null; max_grade: number | null; max_downgrade: number | null }
  skill_level: string | null
  max_participants: number | null
  participants_count: number
  is_full: boolean
  is_private: boolean
  status: string
  organizer: { id: number; name: string; avatar: string | null } | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function ShareEventContent() {
  const searchParams = useSearchParams()
  const { token } = useAuthStore()
  const id = searchParams.get('id')
  const [event, setEvent] = useState<SharedEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const apiBase = useMemo(
    () => process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api',
    [],
  )

  useEffect(() => {
    if (!id) {
      setError('Event not found.')
      setLoading(false)
      return
    }

    fetch(`${apiBase}/events/public/${id}`, {
      headers: { Accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Event not found.')
        return res.json()
      })
      .then((data) => setEvent(data.data))
      .catch(() => setError('This event is not available for public sharing.'))
      .finally(() => setLoading(false))
  }, [apiBase, id])

  async function handleShare() {
    if (!event || typeof window === 'undefined') return
    const url = `${window.location.origin}/events/share?id=${event.id}`
    try {
      if (navigator.share) {
        await navigator.share({
          title: event.title,
          text: `${event.category.label} on FitMeet`,
          url,
        })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {}
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen py-8 px-4">
        <div className="max-w-3xl mx-auto space-y-5">
          {loading && (
            <div className="text-center py-20 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
          )}

          {!loading && error && (
            <div className="text-center py-20">
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{error}</p>
              <Link href="/">
                <Button variant="ghost">Back home</Button>
              </Link>
            </div>
          )}

          {event && (
            <>
              <section className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="h-[240px] sm:h-[300px]">
                  <LocationPickerMap
                    lat={event.location.lat}
                    lng={event.location.lng}
                    readOnly
                    height={300}
                  />
                </div>
                <div className="p-6 space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium border"
                      style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(57,255,20,0.08)' }}
                    >
                      {event.category.label}
                    </span>
                    {event.is_private && (
                      <span className="text-xs flex items-center gap-1 px-2.5 py-1 rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                        <Lock size={10} /> Private
                      </span>
                    )}
                    {event.skill_level && (
                      <span className="text-xs px-2.5 py-1 rounded-full border capitalize" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                        {event.skill_level}
                      </span>
                    )}
                  </div>

                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{event.title}</h1>
                    {event.description && (
                      <p className="text-sm mt-3 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {event.description}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-2.5">
                      <Calendar size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      <span>{formatDate(event.schedule.start_at)}</span>
                      {event.schedule.duration_minutes && <span style={{ color: 'var(--text-muted)' }}>· {event.schedule.duration_minutes} min</span>}
                    </div>
                    {event.location.address && (
                      <div className="flex items-start gap-2.5">
                        <MapPin size={15} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                        <span style={{ color: 'var(--text-muted)' }}>{shortAddress(event.location.address)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2.5">
                      <Users size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      <span>
                        {event.participants_count} joined
                        {event.max_participants ? ` · max ${event.max_participants}` : ''}
                        {event.is_full && <span className="ml-2 text-red-400">· Full</span>}
                      </span>
                    </div>
                    {(event.activity.distance_km || event.activity.elevation_gain || event.activity.pace) && (
                      <div className="flex items-start gap-2.5">
                        <Zap size={15} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                        <span style={{ color: 'var(--text-muted)' }}>
                          {[
                            event.activity.distance_km && `${event.activity.distance_km} km`,
                            event.activity.elevation_gain && `↑${event.activity.elevation_gain} m`,
                            event.activity.pace,
                          ].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {event.organizer && (
                    <div className="rounded-xl border px-4 py-3 flex items-center gap-3" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
                      {event.organizer.avatar ? (
                        <Image src={event.organizer.avatar} alt={event.organizer.name} width={36} height={36} className="rounded-full" />
                      ) : (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm text-black" style={{ background: 'var(--primary)' }}>
                          {event.organizer.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-xs uppercase font-semibold" style={{ color: 'var(--text-muted)' }}>Organized by</p>
                        <p className="text-sm font-medium">{event.organizer.name}</p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border p-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div>
                  <p className="font-semibold">Open this event in FitMeet</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    {token ? 'You can open the full event view and join from there.' : 'Sign in or create an account to join, message people, and set reminders.'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={handleShare}>
                    <Share2 size={15} className="mr-2" />
                    {copied ? 'Copied' : 'Share'}
                  </Button>
                  <Link href={token ? `/events/view?id=${event.id}` : `/login?redirect=${encodeURIComponent(`/events/view?id=${event.id}`)}`}>
                    <Button>{token ? 'Open Event' : 'Sign In to Join'}</Button>
                  </Link>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </>
  )
}

export default function ShareEventPage() {
  return (
    <Suspense>
      <ShareEventContent />
    </Suspense>
  )
}
