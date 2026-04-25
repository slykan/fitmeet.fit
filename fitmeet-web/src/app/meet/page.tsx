'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  Search, Phone, UserPlus, UserCheck, UserMinus, Calendar, MapPin, Users, Zap, ChevronRight,
  Bell, Check, X,
} from 'lucide-react'

import { Navbar } from '@/components/navbar'
import { WeatherBadge } from '@/components/WeatherBadge'
import api from '@/lib/api'
import { formatEventDateParts } from '@/lib/event-time'
import { useAuthStore } from '@/store/auth'
import { shortAddress } from '@/lib/format-address'
import { CATEGORIES, CATEGORY_EMOJI, FILTER_FEATURED } from '@/lib/categories'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserItem {
  id: number
  name: string
  email: string
  avatar: string | null
  phone: string | null
  skill_level: string | null
  categories: string[]
  home: { city: string | null; country: string | null }
  friendship_status: 'friends' | 'pending_sent' | 'pending_received' | null
  events_count: number
}

interface EventItem {
  id: number
  title: string
  category: { value: string; label: string }
  location: { lat: number | null; lng: number | null; address: string | null }
  schedule: { start_at: string; duration_minutes: number | null }
  activity: { distance_km: number | null; elevation_gain: number | null }
  participants_count: number
  max_participants: number | null
  status: string
  is_full: boolean
  is_joined: boolean
  is_organizer: boolean
  skill_level: string | null
  organizer: { id: number; name: string } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RADIUS_OPTIONS = [
  { label: 'All',    km: null },
  { label: '50 km',  km: 50 },
  { label: '100 km', km: 100 },
  { label: '200 km', km: 200 },
  { label: '500 km', km: 500 },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return {
    date: formatEventDateParts(iso).day,
    time: formatEventDateParts(iso).time,
  }
}

function isPastEvent(iso: string) {
  return new Date(iso).getTime() <= Date.now()
}

function Avatar({ user }: { user: UserItem }) {
  if (user.avatar) {
    return (
      <Image
        src={user.avatar} alt={user.name}
        width={44} height={44}
        className="rounded-full object-cover flex-shrink-0"
      />
    )
  }
  return (
    <div className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center font-bold text-base text-black"
      style={{ background: 'var(--primary)' }}>
      {user.name.charAt(0).toUpperCase()}
    </div>
  )
}

function FriendButton({ acting, onRemove }: { acting: boolean; onRemove: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onRemove}
      disabled={acting}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-all disabled:opacity-50"
      style={{
        borderColor: hover ? '#f87171' : 'var(--primary)',
        color:       hover ? '#f87171' : 'var(--primary)',
        background:  hover ? 'rgba(248,113,113,0.08)' : 'rgba(57,255,20,0.08)',
      }}
    >
      {acting ? '…' : hover
        ? <><UserMinus size={13} /> Remove</>
        : <><UserCheck size={13} /> Friends</>
      }
    </button>
  )
}

// ─── People Tab ───────────────────────────────────────────────────────────────

function PeopleTab() {
  const [users,    setUsers]    = useState<UserItem[]>([])
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const [acting,   setActing]   = useState<number | null>(null)
  const [addError, setAddError] = useState<string | null>(null)

  const load = useCallback((q: string) => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (q) params.search = q
    api.get('/users', { params })
      .then(({ data }) => setUsers(data.data ?? []))
      .finally(() => setLoading(false))
  }, [])

  async function handleAdd(userId: number) {
    setActing(userId)
    setAddError(null)
    try {
      await api.post(`/friends/request/${userId}`)
      setUsers(u => u.map(x => x.id === userId ? { ...x, friendship_status: 'pending_sent' } : x))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setAddError(msg ?? 'Could not send request. Try again.')
      setTimeout(() => setAddError(null), 4000)
    }
    finally { setActing(null) }
  }

  async function handleCancel(userId: number) {
    setActing(userId)
    try {
      await api.delete(`/friends/cancel/${userId}`)
      setUsers(u => u.map(x => x.id === userId ? { ...x, friendship_status: null } : x))
    } catch {}
    finally { setActing(null) }
  }

  async function handleRemove(userId: number) {
    setActing(userId)
    try {
      await api.delete(`/friends/${userId}`)
      setUsers(u => u.map(x => x.id === userId ? { ...x, friendship_status: null } : x))
    } catch {}
    finally { setActing(null) }
  }

  useEffect(() => { load('') }, [load])

  useEffect(() => {
    const t = setTimeout(() => load(search), 350)
    return () => clearTimeout(t)
  }, [search, load])

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="w-full rounded-xl border pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[--primary] transition-colors"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        />
      </div>

      {addError && (
        <div className="text-sm px-4 py-2.5 rounded-xl border" style={{ background: 'rgba(248,113,113,0.1)', borderColor: '#f87171', color: '#f87171' }}>
          {addError}
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      )}

      {!loading && users.length === 0 && (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>No people found.</div>
      )}

      {!loading && users.map(u => (
        <div key={u.id} className="rounded-2xl border p-4 flex items-start gap-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <Avatar user={u} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{u.name}</p>
                {(u.home.city || u.home.country) && (
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {[u.home.city, u.home.country].filter(Boolean).join(', ')}
                  </p>
                )}
                {u.events_count > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{u.events_count}</span> event{u.events_count !== 1 ? 's' : ''} created
                  </p>
                )}
              </div>
              {u.friendship_status === 'friends' ? (
                <FriendButton
                  acting={acting === u.id}
                  onRemove={() => handleRemove(u.id)}
                />
              ) : u.friendship_status === 'pending_sent' ? (
                <button
                  onClick={() => handleCancel(u.id)}
                  disabled={acting === u.id}
                  title="Cancel request"
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors hover:border-red-400 hover:text-red-400 disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  {acting === u.id ? '…' : <><UserPlus size={13} /> Sent</>}
                </button>
              ) : u.friendship_status === 'pending_received' ? (
                <button disabled
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium opacity-60 cursor-not-allowed"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  <UserPlus size={13} /> Received
                </button>
              ) : (
                <button
                  onClick={() => handleAdd(u.id)}
                  disabled={acting === u.id}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  <UserPlus size={13} /> {acting === u.id ? '…' : 'Add'}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              {u.skill_level && (
                <span className="text-xs px-2 py-0.5 rounded-full border capitalize"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  {u.skill_level}
                </span>
              )}
              {u.categories.slice(0, 3).map(c => (
                <span key={c} className="text-xs">
                  {CATEGORY_EMOJI[c] ?? '•'} {c}
                </span>
              ))}
            </div>

            {u.phone && (
              <a href={`tel:${u.phone}`}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: 'var(--primary)' }}>
                <Phone size={12} /> {u.phone}
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Events Tab ───────────────────────────────────────────────────────────────

const ALL_CATS = [{ value: '', label: 'All' }, ...CATEGORIES]

function CategoryFilter({ category, setCategory }: { category: string; setCategory: (v: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {ALL_CATS.map(c => {
        const active = category === c.value
        return (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors"
            style={{
              borderColor: active ? 'var(--primary)' : 'var(--border)',
              color:       active ? 'var(--primary)' : 'var(--text-muted)',
              background:  active ? 'rgba(57,255,20,0.08)' : 'transparent',
            }}
          >
            {c.value ? `${CATEGORY_EMOJI[c.value] ?? ''} ${c.label}` : c.label}
          </button>
        )
      })}
    </div>
  )
}

function EventsTab() {
  const { user }      = useAuthStore()
  const router        = useRouter()
  const [events,   setEvents]   = useState<EventItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [category, setCategory] = useState('')
  const [radiusKm, setRadiusKm] = useState<number | null>(null)
  const [goingOnly, setGoingOnly] = useState(false)
  const [friendsOnly, setFriendsOnly] = useState(false)
  const [myOnly, setMyOnly] = useState(false)
  const [pastOnly, setPastOnly] = useState(false)
  const [friendIds, setFriendIds] = useState<Set<number>>(new Set())

  // Reminder modal state
  const [reminderEvent,    setReminderEvent]    = useState<EventItem | null>(null)
  const [selectedOffsets,  setSelectedOffsets]  = useState<Set<string>>(new Set())
  const [settingReminders, setSettingReminders] = useState(false)
  // Map<eventId, string[]> — offsets that are currently active for that event
  const [reminderOffsets, setReminderOffsets]   = useState<Map<number, string[]>>(new Map())

  // Fetch existing reminders once
  useEffect(() => {
    api.get('/events/my-reminders').then(({ data }) => {
      const map = new Map<number, string[]>()
      Object.entries(data.data as Record<string, string[]>).forEach(([id, offsets]) => {
        map.set(Number(id), offsets)
      })
      setReminderOffsets(map)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    api.get('/users', { params: { friends_only: 1 } })
      .then(({ data }) => {
        const ids = (data.data ?? []).map((friend: { id: number }) => friend.id)
        setFriendIds(new Set(ids))
      })
      .catch(() => setFriendIds(new Set()))
  }, [])

  function applyFriendsFilter(items: EventItem[]) {
    return items.filter(ev => {
      if (friendsOnly && (!ev.organizer?.id || !friendIds.has(ev.organizer.id))) return false
      if (myOnly && !ev.is_organizer) return false
      return true
    })
  }

  useEffect(() => {
    setLoading(true)
    if (goingOnly) {
      api.get('/events/joined', { params: pastOnly ? { past: 1 } : {} })
        .then(({ data }) => setEvents(applyFriendsFilter(data.data ?? [])))
        .catch(() => setEvents([]))
        .finally(() => setLoading(false))
      return
    }
    if (myOnly) {
      api.get('/events/my', { params: pastOnly ? { past: 1 } : {} })
        .then(({ data }) => setEvents(applyFriendsFilter(data.data ?? [])))
        .catch(() => setEvents([]))
        .finally(() => setLoading(false))
      return
    }
    const params: Record<string, unknown> = {}
    if (pastOnly) params.past = 1
    if (category) params.category = category
    if (friendsOnly) params.friends_only = 1
    if (radiusKm !== null && user?.location?.lat && user?.location?.lng) {
      params.lat       = user.location.lat
      params.lng       = user.location.lng
      params.radius_km = radiusKm
    } else if (radiusKm !== null && user?.home?.lat && user?.home?.lng) {
      params.lat       = user.home.lat
      params.lng       = user.home.lng
      params.radius_km = radiusKm
    }
    api.get('/events', { params })
      .then(({ data }) => setEvents(applyFriendsFilter(data.data ?? [])))
      .finally(() => setLoading(false))
  }, [category, radiusKm, goingOnly, friendsOnly, myOnly, pastOnly, friendIds, user])

  async function handleSetReminders() {
    if (!reminderEvent) { setReminderEvent(null); return }
    setSettingReminders(true)
    try {
      await api.post(`/events/${reminderEvent.id}/remind`, { offsets: Array.from(selectedOffsets) })
      const id = reminderEvent.id
      setReminderOffsets(prev => {
        const next = new Map(prev)
        next.set(id, Array.from(selectedOffsets))
        return next
      })
    } catch {}
    finally {
      setSettingReminders(false)
      setReminderEvent(null)
    }
  }

  function openReminder(e: React.MouseEvent, ev: EventItem) {
    e.preventDefault()
    e.stopPropagation()
    // Pre-populate with already-set offsets for this event
    setSelectedOffsets(new Set(reminderOffsets.get(ev.id) ?? []))
    setReminderEvent(ev)
  }

  return (
    <div className="space-y-3">
      {/* Category filter */}
      <CategoryFilter category={category} setCategory={setCategory} />

      {/* Radius filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {RADIUS_OPTIONS.map(r => (
          <button
            key={String(r.km)}
            onClick={() => setRadiusKm(r.km)}
            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors"
            style={{
              borderColor: radiusKm === r.km ? 'var(--secondary)' : 'var(--border)',
              color:       radiusKm === r.km ? 'var(--secondary)' : 'var(--text-muted)',
              background:  radiusKm === r.km ? 'rgba(0,168,255,0.08)' : 'transparent',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Event ownership filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setGoingOnly(g => !g)}
          className="flex-shrink-0 text-xs px-4 py-1.5 rounded-full border font-semibold transition-colors"
          style={{
            borderColor: goingOnly ? 'var(--primary)' : 'var(--border)',
            color:       goingOnly ? 'var(--primary)' : 'var(--text-muted)',
            background:  goingOnly ? 'rgba(57,255,20,0.08)' : 'transparent',
          }}
        >
          ✓ Going
        </button>
        <button
          onClick={() => setFriendsOnly(f => !f)}
          className="flex-shrink-0 text-xs px-4 py-1.5 rounded-full border font-semibold transition-colors"
          style={{
            borderColor: friendsOnly ? 'var(--primary)' : 'var(--border)',
            color:       friendsOnly ? 'var(--primary)' : 'var(--text-muted)',
            background:  friendsOnly ? 'rgba(57,255,20,0.08)' : 'transparent',
          }}
        >
          <Users size={13} className="inline mr-1" /> Friends
        </button>
        <button
          onClick={() => setMyOnly(m => !m)}
          className="flex-shrink-0 text-xs px-4 py-1.5 rounded-full border font-semibold transition-colors"
          style={{
            borderColor: myOnly ? 'var(--primary)' : 'var(--border)',
            color:       myOnly ? 'var(--primary)' : 'var(--text-muted)',
            background:  myOnly ? 'rgba(57,255,20,0.08)' : 'transparent',
          }}
        >
          My
        </button>
        <button
          onClick={() => setPastOnly(p => !p)}
          className="flex-shrink-0 text-xs px-4 py-1.5 rounded-full border font-semibold transition-colors"
          style={{
            borderColor: pastOnly ? 'var(--secondary)' : 'var(--border)',
            color:       pastOnly ? 'var(--secondary)' : 'var(--text-muted)',
            background:  pastOnly ? 'rgba(0,168,255,0.08)' : 'transparent',
          }}
        >
          Past
        </button>
      </div>

      {loading && (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      )}

      {!loading && events.length === 0 && (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
          {goingOnly
            ? pastOnly ? "You don't have any past matching joined events." : "You haven't joined any matching events yet."
            : myOnly
              ? pastOnly ? "You don't have any past matching created events." : "You haven't created any matching events yet."
              : pastOnly ? 'No past events found.' : 'No events found.'}
        </div>
      )}

      {!loading && events.map(ev => {
        const pastEvent = isPastEvent(ev.schedule.start_at)
        const mutedEvent = ev.status === 'cancelled' || pastEvent

        return (
        <div key={ev.id}
          onClick={() => router.push(`/events/view?id=${ev.id}`)}
          className="rounded-2xl border p-4 flex items-start justify-between gap-3 transition-opacity hover:opacity-80 cursor-pointer"
          style={{
            background: 'var(--surface)',
            borderColor: ev.status === 'cancelled' ? 'rgba(248,113,113,0.35)' : 'var(--border)',
            opacity: mutedEvent ? 0.68 : 1,
          }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs px-2 py-0.5 rounded-full border font-medium"
                style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(57,255,20,0.08)' }}>
                {CATEGORY_EMOJI[ev.category.value] ?? ''} {ev.category.label}
              </span>
              {pastEvent && <span className="text-xs font-medium" style={{ color: 'var(--secondary)' }}>Past</span>}
              {ev.status === 'cancelled' && <span className="text-xs text-red-400 font-medium">Cancelled</span>}
              {ev.is_full && <span className="text-xs text-red-400 font-medium">Full</span>}
              {ev.skill_level && (
                <span className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{ev.skill_level}</span>
              )}
            </div>
            <p className="font-semibold text-sm truncate mb-1.5">{ev.title}</p>
            <div className="space-y-1">
              <div className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Calendar size={11} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div>{formatDate(ev.schedule.start_at).date}</div>
                  <div>
                    {formatDate(ev.schedule.start_at).time}
                    {ev.schedule.duration_minutes && <span> · {ev.schedule.duration_minutes} min</span>}
                  </div>
                </div>
              </div>
              {ev.location.address && (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <MapPin size={11} />
                  {shortAddress(ev.location.address)}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Users size={11} />
                {ev.participants_count} joined
                {ev.max_participants ? ` · max ${ev.max_participants}` : ''}
              </div>
              {(ev.activity.distance_km || ev.activity.elevation_gain) && (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <Zap size={11} style={{ color: 'var(--primary)' }} />
                  {[
                    ev.activity.distance_km    && `${ev.activity.distance_km} km`,
                    ev.activity.elevation_gain && `↑${ev.activity.elevation_gain} m`,
                  ].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
            {ev.location.lat != null && ev.location.lng != null && (
              <WeatherBadge
                lat={ev.location.lat}
                lng={ev.location.lng}
                startAt={ev.schedule.start_at}
              />
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            {ev.is_joined && (
              <button
                onClick={e => openReminder(e, ev)}
                title="Set reminder"
                disabled={ev.status === 'cancelled' || pastEvent}
                className="p-1.5 rounded-lg transition-colors hover:bg-[--border]"
                style={{ color: (reminderOffsets.get(ev.id)?.length ?? 0) > 0 ? 'var(--primary)' : '#fff' }}
              >
                <Bell size={15} fill={(reminderOffsets.get(ev.id)?.length ?? 0) > 0 ? 'var(--primary)' : 'none'} />
              </button>
            )}
            <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
          </div>
        </div>
        )
      })}

      {/* Reminder modal */}
      {reminderEvent && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={e => e.target === e.currentTarget && setReminderEvent(null)}>
          <div className="w-full rounded-2xl border p-6 space-y-5"
            style={{ maxWidth: 420, background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-base truncate pr-4">{reminderEvent.title}</p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Set a reminder</p>
              </div>
              <button onClick={() => setReminderEvent(null)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['1h', '5h', '1d'] as const).map(offset => {
                const label = offset === '1h' ? '1h before' : offset === '5h' ? '5h before' : '1 day before'
                const active = selectedOffsets.has(offset)
                return (
                  <button key={offset}
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
            <div className="flex gap-2">
              <button onClick={() => setReminderEvent(null)}
                className="flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors hover:bg-[--border]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                Cancel
              </button>
              <button onClick={handleSetReminders}
                disabled={settingReminders}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: 'var(--primary)', color: '#000' }}>
                {settingReminders ? 'Saving…' : selectedOffsets.size === 0 ? 'Clear Reminders' : 'Save Reminders'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MeetPage() {
  const { token } = useAuthStore()
  const router    = useRouter()
  const [tab, setTab] = useState<'people' | 'events'>('events')

  useEffect(() => {
    if (!token) router.replace('/login')
  }, [token, router])

  if (!token) return null

  return (
    <>
      <Navbar />
      <main className="min-h-screen py-8 px-4">
        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Meet</h1>
            <button
              onClick={() => router.push('/events/create')}
              className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'var(--primary)', color: '#000' }}
            >
              <span className="text-base leading-none">+</span> New Event
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {(['events', 'people'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors capitalize"
                style={{
                  background: tab === t ? 'var(--primary)' : 'transparent',
                  color:      tab === t ? '#000' : 'var(--text-muted)',
                }}
              >
                {t === 'people' ? '👥 People' : '📅 Events'}
              </button>
            ))}
          </div>

          {tab === 'people' ? <PeopleTab /> : <EventsTab />}

        </div>
      </main>
    </>
  )
}
