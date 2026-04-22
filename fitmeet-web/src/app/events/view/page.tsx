'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Calendar, MapPin, Users, Zap, ChevronLeft, Lock, Pencil } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import ElevationChart from '@/components/elevation-chart'
import { shortAddress } from '@/lib/format-address'
import api from '@/lib/api'
import { parseGpx, GpxResult } from '@/lib/parse-gpx'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'

const LocationPickerMap = dynamic(() => import('@/components/location-picker-map'), { ssr: false })

interface Event {
  id: number
  title: string
  description: string | null
  category: { value: string; label: string }
  location: { lat: number; lng: number; address: string | null }
  schedule: { start_at: string; duration_minutes: number | null }
  activity: { distance_km: number | null; elevation_gain: number | null; pace: string | null; max_grade: number | null; max_downgrade: number | null; gpx_url: string | null }
  skill_level: string | null
  max_participants: number | null
  participants_count: number
  is_full: boolean
  is_private: boolean
  status: string
  is_organizer: boolean
  is_joined: boolean
  organizer: { id: number; name: string; avatar: string | null }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function EventContent() {
  const searchParams = useSearchParams()
  const { token }    = useAuthStore()
  const router       = useRouter()
  const id           = searchParams.get('id')

  const [event,    setEvent]    = useState<Event | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [joining,  setJoining]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [gpxResult, setGpxResult] = useState<GpxResult | null>(null)

  useEffect(() => {
    if (!token) { router.replace('/login'); return }
    if (!id)    { router.replace('/');      return }

    api.get(`/events/${id}`)
      .then(({ data }) => {
        setEvent(data.data)
        if (data.data.activity?.gpx_url) {
          api.get(data.data.activity.gpx_url, { responseType: 'text' })
            .then(r => setGpxResult(parseGpx(r.data)))
            .catch(() => {})
        }
      })
      .catch(() => setError('Event not found.'))
      .finally(() => setLoading(false))
  }, [id, token, router])

  async function handleJoin() {
    if (!event) return
    setJoining(true)
    setError(null)
    try {
      await api.post(`/events/${event.id}/join`)
      setEvent(e => e ? { ...e, is_joined: true, participants_count: e.participants_count + 1 } : e)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to join.'
      setError(msg)
    } finally {
      setJoining(false)
    }
  }

  async function handleLeave() {
    if (!event) return
    setJoining(true)
    setError(null)
    try {
      await api.post(`/events/${event.id}/leave`)
      setEvent(e => e ? { ...e, is_joined: false, participants_count: e.participants_count - 1 } : e)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to leave.'
      setError(msg)
    } finally {
      setJoining(false)
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/hub"
        className="inline-flex items-center gap-1.5 text-sm mb-6 transition-opacity hover:opacity-70"
        style={{ color: 'var(--text-muted)' }}
      >
        <ChevronLeft size={16} /> Back
      </Link>

      {loading && (
        <div className="text-center py-20 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      )}

      {error && !event && (
        <div className="text-center py-20">
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{error}</p>
          <Link href="/"><Button variant="ghost">Go home</Button></Link>
        </div>
      )}

      {event && (
        <div className="space-y-5">

          <div className="rounded-2xl border p-7" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-xs px-2.5 py-1 rounded-full font-medium border"
                style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(57,255,20,0.08)' }}>
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

            <h1 className="text-2xl font-bold leading-snug mb-4">{event.title}</h1>

            {event.description && (
              <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>{event.description}</p>
            )}

            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm">
                <Calendar size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span>{formatDate(event.schedule.start_at)}</span>
                {event.schedule.duration_minutes && <span style={{ color: 'var(--text-muted)' }}>· {event.schedule.duration_minutes} min</span>}
              </div>
              {event.location.address && (
                <div className="flex items-start gap-2.5 text-sm">
                  <MapPin size={15} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                  <span style={{ color: 'var(--text-muted)' }}>{shortAddress(event.location.address ?? '')}</span>
                </div>
              )}
              <div className="flex items-center gap-2.5 text-sm">
                <Users size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span>
                  {event.participants_count} joined
                  {event.max_participants ? ` · max ${event.max_participants}` : ''}
                  {event.is_full && <span className="ml-2 text-red-400">· Full</span>}
                </span>
              </div>
              {(event.activity.distance_km || event.activity.pace || event.activity.elevation_gain || event.activity.max_grade || event.activity.max_downgrade) && (
                <div className="flex items-start gap-2.5 text-sm">
                  <Zap size={15} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                  <span style={{ color: 'var(--text-muted)' }}>
                    {[
                      event.activity.distance_km    && `${event.activity.distance_km} km`,
                      event.activity.elevation_gain && `↑${event.activity.elevation_gain} m`,
                      event.activity.max_grade      && `▲ ${event.activity.max_grade}%`,
                      event.activity.max_downgrade  && `▼ ${Math.abs(event.activity.max_downgrade)}%`,
                      event.activity.pace,
                    ].filter(Boolean).join(' · ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {(event.location.lat != null && event.location.lng != null) && (
            <LocationPickerMap
              lat={event.location.lat}
              lng={event.location.lng}
              coloredSegments={gpxResult?.coloredSegments}
              readOnly
              height={400}
            />
          )}

          {gpxResult && gpxResult.elevationProfile.length >= 2 && (
            <div>
              <p className="text-xs font-medium mb-2 px-1" style={{ color: 'var(--text-muted)' }}>Elevation profile</p>
              <ElevationChart profile={gpxResult.elevationProfile} totalKm={gpxResult.distanceKm} />
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          {event.status === 'active' && (
            event.is_joined ? (
              <Button variant="ghost" size="lg" className="w-full border" loading={joining} onClick={handleLeave}>Leave event</Button>
            ) : (
              <Button size="lg" className="w-full" loading={joining} onClick={handleJoin} disabled={event.is_full}>
                {event.is_full ? 'Event is full' : 'Join event'}
              </Button>
            )
          )}

          {event.is_organizer && (
            <Button size="lg" variant="ghost" className="w-full border flex items-center gap-2"
              onClick={() => router.push(`/events/edit?id=${event.id}`)}>
              <Pencil size={15} /> Edit event
            </Button>
          )}

          <div className="rounded-2xl border p-5 flex items-center gap-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>Organized by</div>
            {event.organizer.avatar ? (
              <Image src={event.organizer.avatar} alt={event.organizer.name} width={32} height={32} className="rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-black" style={{ background: 'var(--primary)' }}>
                {event.organizer.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="font-medium text-sm">{event.organizer.name}</span>
          </div>

        </div>
      )}
    </main>
  )
}

export default function EventPage() {
  return (
    <>
      <Navbar />
      <Suspense>
        <EventContent />
      </Suspense>
    </>
  )
}
