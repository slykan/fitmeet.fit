'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Calendar, MapPin, Users, Zap, ChevronLeft, Lock, Pencil, ChevronDown, ChevronUp, Bell, Check, X, Share2, XCircle, Download, Wind, Cloud } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import { WeatherBadge } from '@/components/WeatherBadge'
import ElevationChart from '@/components/elevation-chart'
import { shortAddress } from '@/lib/format-address'
import { formatEventDateTime } from '@/lib/event-time'
import { fetchEventWeather, weatherSlot, type EventWeather } from '@/lib/weather'
import api from '@/lib/api'
import { parseGpx, GpxResult } from '@/lib/parse-gpx'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'

const LocationPickerMap = dynamic(() => import('@/components/location-picker-map'), { ssr: false })

interface Participant {
  id: number
  name: string
  avatar: string | null
}

interface Event {
  id: number
  title: string
  description: string | null
  image_url: string | null
  category: { value: string; label: string }
  location: { lat: number; lng: number; address: string | null }
  schedule: { start_at: string; timezone: string; duration_minutes: number | null }
  activity: { distance_km: number | null; elevation_gain: number | null; pace: string | null; max_grade: number | null; max_downgrade: number | null; gpx_url: string | null }
  skill_level: string | null
  max_participants: number | null
  participants_count: number
  participants: Participant[]
  is_full: boolean
  is_private: boolean
  status: string
  is_organizer: boolean
  is_joined: boolean
  organizer: { id: number; name: string; avatar: string | null }
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
  const [showParticipants, setShowParticipants] = useState(false)
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [selectedOffsets,  setSelectedOffsets]  = useState<Set<string>>(new Set())
  const [settingReminders, setSettingReminders] = useState(false)
  const [activeOffsets,    setActiveOffsets]    = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [weather, setWeather] = useState<EventWeather | null>(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [showWindOverlay, setShowWindOverlay] = useState(true)
  const [showCloudOverlay, setShowCloudOverlay] = useState(true)
  const [isMapInteracting, setIsMapInteracting] = useState(false)
  const [weatherCenter, setWeatherCenter] = useState<{ lat: number; lng: number } | null>(null)

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

    // Load existing reminders for this event
    api.get('/events/my-reminders').then(({ data }) => {
      const offsets = (data.data as Record<string, string[]>)[id] ?? []
      setActiveOffsets(offsets)
    }).catch(() => {})
  }, [id, token, router])

  useEffect(() => {
    if (!event?.location || event.location.lat == null || event.location.lng == null) return
    setWeatherCenter({ lat: event.location.lat, lng: event.location.lng })
  }, [event?.id, event?.location?.lat, event?.location?.lng])

  useEffect(() => {
    if (!event?.location || event.location.lat == null || event.location.lng == null) return
    if (!weatherCenter) return
    const { isoDate, hour } = weatherSlot(event.schedule.start_at, event.schedule.timezone)
    fetchEventWeather(weatherCenter.lat, weatherCenter.lng, isoDate, hour)
      .then(setWeather)
      .catch(() => setWeather(null))
  }, [event?.id, event?.schedule?.start_at, event?.schedule?.timezone, weatherCenter])

  async function handleJoin() {
    if (!event) return
    setJoining(true)
    setError(null)
    try {
      await api.post(`/events/${event.id}/join`)
      setEvent(e => e ? { ...e, is_joined: true, participants_count: e.participants_count + 1 } : e)
      setActiveOffsets([])
      setSelectedOffsets(new Set())
      setShowReminderModal(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to join.'
      setError(msg)
    } finally {
      setJoining(false)
    }
  }

  async function handleSetReminders() {
    if (!event) { setShowReminderModal(false); return }
    setSettingReminders(true)
    try {
      const offsets = Array.from(selectedOffsets)
      await api.post(`/events/${event.id}/remind`, { offsets })
      setActiveOffsets(offsets)
    } catch {}
    finally {
      setSettingReminders(false)
      setShowReminderModal(false)
    }
  }

  function openReminderModal() {
    setSelectedOffsets(new Set(activeOffsets))
    setShowReminderModal(true)
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

  async function handleShare() {
    if (!event || typeof window === 'undefined') return
    const version = encodeURIComponent(`${event.schedule.start_at}-${event.schedule.timezone}`)
    const url = `${window.location.origin}/events/share?id=${event.id}&v=${version}`
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

  async function handleCancelEvent() {
    if (!event) return
    if (!confirm('Cancel this event? Joined users will be notified.')) return

    setCancelling(true)
    setError(null)
    try {
      await api.delete(`/events/${event.id}`)
      setEvent(current => current ? { ...current, status: 'cancelled' } : current)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to cancel event.'
      setError(msg)
    } finally {
      setCancelling(false)
    }
  }

  return (
    <>
    <main className="min-h-screen py-8 px-4">
    <div style={{ maxWidth: 1024, margin: '0 auto' }}>
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
              {event.status === 'cancelled' && (
                <span className="text-xs px-2.5 py-1 rounded-full border font-medium"
                  style={{ borderColor: '#f87171', color: '#f87171', background: 'rgba(248,113,113,0.08)' }}>
                  Cancelled
                </span>
              )}
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
              <button
                type="button"
                onClick={handleShare}
                className="text-xs flex items-center gap-1 px-2.5 py-1 rounded-full border transition-colors hover:bg-[--border]"
                style={{ borderColor: 'var(--border)', color: copied ? 'var(--primary)' : 'var(--text-muted)' }}
              >
                <Share2 size={10} /> {copied ? 'Copied' : 'Share'}
              </button>
            </div>

            <h1 className="text-2xl font-bold leading-snug mb-4">{event.title}</h1>

            {event.image_url && (
              <button
                type="button"
                onClick={() => setShowImageModal(true)}
                className="mb-5 block w-full overflow-hidden rounded-2xl border text-left transition-opacity hover:opacity-95"
                style={{ borderColor: 'var(--border)' }}
              >
                <img
                  src={event.image_url}
                  alt={event.title}
                  className="block w-full object-cover"
                  style={{ aspectRatio: '16 / 9' }}
                />
              </button>
            )}

            {event.description && (
              <p className="text-sm leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>{event.description}</p>
            )}

            {event.status === 'cancelled' && (
              <div className="mb-5 rounded-xl border px-4 py-3 text-sm"
                style={{ borderColor: 'rgba(248,113,113,0.35)', background: 'rgba(248,113,113,0.08)', color: '#fca5a5' }}>
                This event has been cancelled. Joined participants were notified.
              </div>
            )}

            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm">
                <Calendar size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span>{formatEventDateTime(event.schedule.start_at, event.schedule.timezone)}</span>
                {event.schedule.duration_minutes && <span style={{ color: 'var(--text-muted)' }}>· {event.schedule.duration_minutes} min</span>}
              </div>
              {event.location.address && (
                <div className="flex items-start gap-2.5 text-sm">
                  <MapPin size={15} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                  <span style={{ color: 'var(--text-muted)' }}>{shortAddress(event.location.address ?? '')}</span>
                </div>
              )}
              <div className="text-sm">
                <div className="flex items-center gap-2.5">
                  <Users size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span>
                    {event.participants_count} joined
                    {event.max_participants ? ` · max ${event.max_participants}` : ''}
                    {event.is_full && <span className="ml-2 text-red-400">· Full</span>}
                  </span>
                  {event.participants_count > 0 && (
                    <button
                      onClick={() => setShowParticipants(s => !s)}
                      className="flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full border transition-colors hover:bg-[--border]"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    >
                      {showParticipants ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}
                </div>
                {showParticipants && event.participants?.length > 0 && (
                  <div className="mt-2 ml-6 flex flex-wrap gap-2">
                    {event.participants.map(p => (
                      <div key={p.id} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border"
                        style={{ borderColor: 'var(--border)', background: 'var(--background)', color: 'var(--text-primary)' }}>
                        {p.avatar ? (
                          <Image src={p.avatar} alt={p.name} width={18} height={18} className="rounded-full object-cover" />
                        ) : (
                          <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center font-bold text-[9px] text-black flex-shrink-0"
                            style={{ background: 'var(--primary)' }}>
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {p.name}
                      </div>
                    ))}
                  </div>
                )}
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
              {event.location.lat != null && event.location.lng != null && (
                <WeatherBadge
                  lat={event.location.lat}
                  lng={event.location.lng}
                  startAt={event.schedule.start_at}
                  timezone={event.schedule.timezone}
                  weather={weather}
                />
              )}
              {event.activity.gpx_url && (
                <div className="flex items-start gap-2.5 text-sm">
                  <Download size={15} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                  <a
                    href={event.activity.gpx_url}
                    download={`fitmeet-event-${event.id}.gpx`}
                    className="inline-flex items-center gap-2 font-medium transition-opacity hover:opacity-75"
                    style={{ color: 'var(--primary)' }}
                  >
                    Download GPX
                  </a>
                </div>
              )}
            </div>
          </div>

          {(event.location.lat != null && event.location.lng != null) && (
            <div className="relative">
              <LocationPickerMap
                lat={event.location.lat}
                lng={event.location.lng}
                onViewChange={(lat, lng) => setWeatherCenter({ lat, lng })}
                onInteractionChange={setIsMapInteracting}
                coloredSegments={gpxResult?.coloredSegments}
                weather={weather}
                weatherVariant="hub"
                showWindOverlay={showWindOverlay && !isMapInteracting}
                showCloudOverlay={showCloudOverlay && !isMapInteracting}
                readOnly
                height={400}
              />
              <div
                className="absolute inset-x-0 bottom-0 z-[700] flex items-center justify-between gap-3 border-t px-3 py-2 sm:px-4"
                style={{
                  background: 'rgba(7,11,24,0.7)',
                  borderColor: 'rgba(255,255,255,0.1)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowWindOverlay(v => !v)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors sm:text-xs"
                    style={{
                      borderColor: showWindOverlay ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                      color: showWindOverlay ? 'var(--primary)' : 'var(--text-muted)',
                      background: showWindOverlay ? 'rgba(57,255,20,0.1)' : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <Wind size={13} />
                    <span>Wind</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCloudOverlay(v => !v)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors sm:text-xs"
                    style={{
                      borderColor: showCloudOverlay ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                      color: showCloudOverlay ? 'var(--primary)' : 'var(--text-muted)',
                      background: showCloudOverlay ? 'rgba(57,255,20,0.1)' : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <Cloud size={13} />
                    <span>Clouds</span>
                  </button>
                </div>
                {weather && (
                  <div
                    className="hidden items-center gap-2 text-xs font-semibold sm:inline-flex"
                    style={{ color: '#d7dfef' }}
                  >
                    <span>{weather.tempCurrent ?? weather.tempMax}°</span>
                    <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.16)', display: 'inline-block' }} />
                    <span
                      style={{
                        display: 'inline-block',
                        transform: `rotate(${weather.windDir + 90}deg)`,
                        color: '#58beff',
                        lineHeight: 1,
                        fontSize: 14,
                      }}
                    >
                      {'\u2192'}
                    </span>
                    <span>{weather.windSpeed} km/h</span>
                  </div>
                )}
              </div>
            </div>
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
              <div className="flex gap-2">
                <Button variant="ghost" size="lg" className="flex-1 border" loading={joining} onClick={handleLeave}>Leave event</Button>
                <button
                  onClick={openReminderModal}
                  title="Reminders"
                  className="flex-shrink-0 px-4 rounded-xl border transition-colors hover:bg-[--border]"
                  style={{
                    borderColor: activeOffsets.length > 0 ? 'var(--primary)' : 'var(--border)',
                    color:       activeOffsets.length > 0 ? 'var(--primary)' : 'var(--text-muted)',
                  }}
                >
                  <Bell size={18} fill={activeOffsets.length > 0 ? 'var(--primary)' : 'none'} />
                </button>
              </div>
            ) : (
              <Button size="lg" className="w-full" loading={joining} onClick={handleJoin} disabled={event.is_full}>
                {event.is_full ? 'Event is full' : 'Join event'}
              </Button>
            )
          )}

          {event.is_organizer && event.status === 'active' && (
            <div className="flex gap-2">
              <Button size="lg" variant="ghost" className="flex-1 border flex items-center gap-2"
                onClick={() => router.push(`/events/edit?id=${event.id}`)}>
                <Pencil size={15} /> Edit event
              </Button>
              <Button size="lg" variant="ghost" loading={cancelling} className="flex-1 border text-red-400 hover:text-red-400 flex items-center gap-2"
                onClick={handleCancelEvent}>
                <XCircle size={15} /> Cancel event
              </Button>
            </div>
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
    </div>
    </main>

    {showImageModal && event?.image_url && (
      <div
        className="fixed inset-0 z-[1900] flex items-center justify-center p-4"
        style={{ background: 'rgba(5,8,22,0.88)' }}
        onClick={() => setShowImageModal(false)}
      >
        <button
          type="button"
          onClick={() => setShowImageModal(false)}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border"
          style={{ borderColor: 'rgba(255,255,255,0.18)', color: '#fff', background: 'rgba(255,255,255,0.06)' }}
        >
          <X size={18} />
        </button>
        <img
          src={event.image_url}
          alt={event.title}
          className="max-h-[90vh] max-w-[92vw] rounded-2xl object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}

    {/* Reminder modal */}
    {showReminderModal && event && (
      <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.7)' }}>
        <div className="w-full rounded-2xl border p-6 space-y-5"
          style={{ maxWidth: 420, background: 'var(--surface)', borderColor: 'var(--border)' }}>

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="text-2xl mb-1">🎉</div>
              <h2 className="font-bold text-lg">Successfully joined!</h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Want a reminder before it starts?
              </p>
            </div>
            <button onClick={() => setShowReminderModal(false)} style={{ color: 'var(--text-muted)' }}>
              <X size={20} />
            </button>
          </div>

          {/* Offset toggles */}
          <div className="flex gap-2 flex-wrap">
            {(['1h', '5h', '1d'] as const).map(offset => {
              const label = offset === '1h' ? '1h before' : offset === '5h' ? '5h before' : '1 day before'
              const active = selectedOffsets.has(offset)
              return (
                <button
                  key={offset}
                  onClick={() => setSelectedOffsets(prev => {
                    const next = new Set(prev)
                    next.has(offset) ? next.delete(offset) : next.add(offset)
                    return next
                  })}
                  className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl border font-medium transition-all"
                  style={{
                    borderColor: active ? 'var(--primary)' : 'var(--border)',
                    color:       active ? 'var(--primary)' : 'var(--text-muted)',
                    background:  active ? 'rgba(57,255,20,0.08)' : 'transparent',
                  }}
                >
                  {active && <Check size={13} />}
                  <Bell size={13} />
                  {label}
                </button>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowReminderModal(false)}
              className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:bg-[--border]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              Skip
            </button>
            <button
              onClick={handleSetReminders}
              disabled={settingReminders}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ background: 'var(--primary)', color: '#000' }}
            >
              {settingReminders ? 'Saving…' : selectedOffsets.size === 0 ? 'Clear Reminders' : 'Save Reminders'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
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
