'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  Search, Phone, UserPlus, UserCheck, UserMinus, Calendar, MapPin, Users, Zap, ChevronRight,
  Bell, Check, X, ArrowUpDown, ChevronUp, ChevronDown, Share2, Images,
} from 'lucide-react'

import { Navbar } from '@/components/navbar'
import { WeatherBadge } from '@/components/WeatherBadge'
import { EventCommentsPreview } from '@/components/event-comments-preview'
import api from '@/lib/api'
import { formatEventDateParts } from '@/lib/event-time'
import { useAuthStore } from '@/store/auth'
import { shortAddress } from '@/lib/format-address'
import { CATEGORIES, CATEGORY_EMOJI, FILTER_FEATURED } from '@/lib/categories'
import { sortEventsBySchedule } from '@/lib/event-order'

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
  created_at?: string | null
  beer_score?: number
  beer_top_tier?: string | null
}

type PeopleSort = 'latest' | 'name' | 'beer' | 'events'
const PEOPLE_SORT_OPTIONS: { key: PeopleSort; label: string }[] = [
  { key: 'latest', label: 'New' },
  { key: 'name',   label: 'Name' },
  { key: 'beer',   label: 'Beer' },
  { key: 'events', label: 'Events' },
]
const PEOPLE_SORT_DEFAULT_DIR: Record<PeopleSort, 'asc' | 'desc'> = { latest: 'desc', name: 'asc', beer: 'desc', events: 'desc' }

interface EventItem {
  id: number
  title: string
  image_url: string | null
  category: { value: string; label: string }
  location: { lat: number | null; lng: number | null; address: string | null }
  schedule: { start_at: string; timezone: string; duration_minutes: number | null }
  activity: { distance_km: number | null; elevation_gain: number | null }
  participants_count: number
  views_count: number
  comments_count: number
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

function formatDate(iso: string, timezone?: string | null) {
  return {
    date: formatEventDateParts(iso, timezone).day,
    time: formatEventDateParts(iso, timezone).time,
  }
}

function eventTiming(ev: EventItem) {
  const start = new Date(ev.schedule.start_at).getTime()
  const end = start + (ev.schedule.duration_minutes ?? 60) * 60_000
  const now = Date.now()
  return {
    inProgress: start <= now && now < end,
    past: now >= end,
  }
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

// ─── Calendar Modal ────────────────────────────────────────────────────────────

const CAT_EMOJI: Record<string, string> = {
  running:'🏃', cycling:'🚴', hiking:'🥾', swimming:'🏊', football:'⚽',
  basketball:'🏀', tennis:'🎾', volleyball:'🏐', yoga:'🧘', fitness:'💪',
  martial_arts:'🥊', climbing:'🧗', skiing:'⛷️', skating:'⛸️', surfing:'🏄',
  golf:'⛳', rugby:'🏉', baseball:'⚾', rowing:'🚣', dance:'💃',
  social:'🎉', other:'📅',
}
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WEEKDAYS = ['Mo','Tu','We','Th','Fr','Sa','Su']

interface CalEvent { id: number; title: string; category: { value: string }; schedule: { start_at: string } }

function buildGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const days = new Date(year, month + 1, 0).getDate()
  const grid: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= days; d++) grid.push(d)
  while (grid.length % 7 !== 0) grid.push(null)
  return grid
}

function dateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

function CalendarModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [events, setEvents] = useState<CalEvent[]>([])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    api.get('/events/joined').then(r => setEvents(r.data.data ?? [])).catch(() => {})
  }, [])

  const byDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {}
    events.forEach(ev => {
      const k = ev.schedule.start_at.slice(0, 10)
      if (!map[k]) map[k] = []
      map[k].push(ev)
    })
    return map
  }, [events])

  const grid = useMemo(() => buildGrid(year, month), [year, month])

  function prevMonth() { if (month === 0) { setYear(y => y-1); setMonth(11) } else setMonth(m => m-1); setSelected(null) }
  function nextMonth() { if (month === 11) { setYear(y => y+1); setMonth(0) } else setMonth(m => m+1); setSelected(null) }

  function handleDay(day: number) {
    const k = dateKey(year, month, day)
    const evs = byDate[k]
    if (evs?.length === 1) { onClose(); router.push(`/events/view?id=${evs[0].id}`) }
    else if (evs?.length > 1) setSelected(selected === k ? null : k)
    else { onClose(); router.push('/events/create') }
  }

  const isToday = (d: number) => today.getFullYear()===year && today.getMonth()===month && today.getDate()===d

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border overflow-hidden flex flex-col max-h-[85vh]"
        style={{ background: '#0c0a14', borderColor: 'rgba(255,255,255,0.08)' }}>

        {/* Handle */}
        <div className="w-10 h-1 rounded-full mx-auto mt-3 sm:hidden" style={{ background: 'rgba(255,255,255,0.15)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div>
            <p className="font-black text-lg">My Schedule</p>
            <p className="text-xs opacity-50">Tap a day to view or create events</p>
          </div>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-4">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:opacity-70 transition-opacity" style={{ background: 'var(--surface)' }}>
              <ChevronUp size={16} className="rotate-[-90deg]" />
            </button>
            <span className="font-black text-base">{MONTHS[month]} {year}</span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:opacity-70 transition-opacity" style={{ background: 'var(--surface)' }}>
              <ChevronUp size={16} className="rotate-90" />
            </button>
          </div>

          {/* Weekdays */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(d => <div key={d} className="text-center text-[11px] font-bold opacity-40 py-1">{d}</div>)}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {grid.map((day, i) => {
              if (!day) return <div key={i} />
              const k = dateKey(year, month, day)
              const evs = byDate[k] ?? []
              const hasEv = evs.length > 0
              const isSel = selected === k
              const isTod = isToday(day)
              return (
                <button key={i} onClick={() => handleDay(day)}
                  className="flex flex-col items-center justify-center rounded-xl py-1.5 min-h-[48px] transition-all hover:opacity-80"
                  style={{
                    background: isSel ? 'rgba(57,255,20,0.2)' : hasEv ? 'rgba(57,255,20,0.07)' : 'transparent',
                    border: hasEv ? '1px solid rgba(57,255,20,0.25)' : isTod ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                  }}
                >
                  <span className="text-xs font-bold" style={{ color: isTod ? 'var(--primary)' : hasEv ? '#fff' : 'var(--text-muted)' }}>{day}</span>
                  {hasEv && <span className="text-sm leading-none">{CAT_EMOJI[evs[0].category.value] ?? '📅'}</span>}
                  {hasEv && evs.length > 1 && <span className="text-[9px] font-black" style={{ color: 'var(--primary)' }}>+{evs.length-1}</span>}
                  {!hasEv && <div className="w-1 h-1 rounded-full mt-0.5 opacity-20" style={{ background: 'var(--text-muted)' }} />}
                </button>
              )
            })}
          </div>

          {/* Selected events */}
          {selected && (byDate[selected] ?? []).length > 1 && (
            <div className="mt-4 rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <p className="text-xs font-black px-4 py-2.5" style={{ color: 'var(--primary)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {new Date(`${selected}T12:00:00`).toLocaleDateString('en', { weekday:'long', month:'long', day:'numeric' })}
              </p>
              {(byDate[selected] ?? []).map(ev => (
                <button key={ev.id} onClick={() => { onClose(); router.push(`/events/view?id=${ev.id}`) }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:opacity-70 transition-opacity text-left border-t"
                  style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  <span className="text-lg">{CAT_EMOJI[ev.category.value] ?? '📅'}</span>
                  <span className="flex-1 text-sm font-semibold truncate">{ev.title}</span>
                  <ChevronRight size={14} className="opacity-40" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── People Tab ───────────────────────────────────────────────────────────────

function PeopleTab() {
  const [users,    setUsers]    = useState<UserItem[]>([])
  const [search,   setSearch]   = useState('')
  const [loading,  setLoading]  = useState(true)
  const [acting,   setActing]   = useState<number | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [sort,        setSort]        = useState<PeopleSort>('latest')
  const [direction,   setDirection]   = useState<'asc' | 'desc'>('desc')
  const [showSort,    setShowSort]    = useState(false)
  const [friendsOnly, setFriendsOnly] = useState(false)

  const load = useCallback((q: string, s: PeopleSort, d: 'asc' | 'desc', fo: boolean) => {
    setLoading(true)
    const params: Record<string, string> = { sort: s, direction: d }
    if (q) params.search = q
    if (fo) params.friends_only = '1'
    api.get('/users', { params })
      .then(({ data }) => setUsers(data.data ?? []))
      .finally(() => setLoading(false))
  }, [])

  function handleSortSelect(key: PeopleSort) {
    if (key === sort) {
      setDirection(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSort(key)
      setDirection(PEOPLE_SORT_DEFAULT_DIR[key])
    }
    setShowSort(false)
  }

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
    finally {
      setActing(null)
      setConfirmRemoveId(current => current === userId ? null : current)
    }
  }

  useEffect(() => { load('', sort, direction, friendsOnly) }, [load])

  useEffect(() => {
    const t = setTimeout(() => load(search, sort, direction, friendsOnly), 350)
    return () => clearTimeout(t)
  }, [search, sort, direction, friendsOnly, load])

  async function handleInvite() {
    api.post('/me/invite-tap').catch(() => {})
    const text = 'Join me on FitMeet — find sports events and active people near you! 💪'
    const url  = 'https://fitmeet.fit'
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: 'FitMeet', text, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(`${text} ${url}`).catch(() => {})
    }
  }

  const activeSortLabel = PEOPLE_SORT_OPTIONS.find(o => o.key === sort)?.label ?? 'New'

  return (
    <div className="space-y-3">
      {/* Invite */}
      <button
        onClick={handleInvite}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-sm transition-opacity hover:opacity-80"
        style={{ borderColor: 'rgba(57,255,20,0.25)', background: 'rgba(57,255,20,0.06)', color: 'var(--primary)' }}
      >
        <UserPlus size={15} />
        Invite friends to FitMeet
        <Share2 size={14} />
      </button>

      {/* Search + Sort */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="w-full rounded-xl border pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[--primary] transition-colors"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
        </div>
        <button
          onClick={() => setFriendsOnly(v => !v)}
          className="px-3 rounded-xl border flex items-center gap-1.5 text-sm font-bold whitespace-nowrap transition-colors"
          style={{
            background: friendsOnly ? 'var(--primary)' : 'var(--surface)',
            borderColor: friendsOnly ? 'var(--primary)' : 'var(--border)',
            color: friendsOnly ? '#000' : 'var(--text-primary)',
          }}
        >
          <Users size={13} /> Friends
        </button>
        <div className="relative">
          <button
            onClick={() => setShowSort(v => !v)}
            className="h-full px-3 rounded-xl border flex items-center gap-1.5 text-sm font-bold whitespace-nowrap"
            style={{ background: showSort ? 'var(--primary)' : 'var(--surface)', borderColor: showSort ? 'var(--primary)' : 'var(--border)', color: showSort ? '#000' : 'var(--text-primary)' }}
          >
            <ArrowUpDown size={13} />
            {activeSortLabel}
            {direction === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
          {showSort && (
            <div className="absolute right-0 top-full mt-1 w-32 rounded-xl border z-10 overflow-hidden shadow-lg"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              {PEOPLE_SORT_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => handleSortSelect(opt.key)}
                  className="w-full px-4 py-2.5 text-left text-sm font-semibold flex items-center justify-between hover:opacity-70 transition-opacity"
                  style={{ color: sort === opt.key ? 'var(--primary)' : 'var(--text-primary)' }}
                >
                  {opt.label}
                  {sort === opt.key && (direction === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
                </button>
              ))}
            </div>
          )}
        </div>
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

      {!loading && users.map((u, index) => (
        <div key={u.id} className="rounded-2xl border p-4 flex items-start gap-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <Avatar user={u} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`/users/view?id=${u.id}`} className="font-semibold text-sm truncate hover:underline underline-offset-2">{u.name}</a>
                  {(u.beer_score ?? 0) > 0 && (
                    <span
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border text-[10px] font-black"
                      style={{ borderColor: 'rgba(246,198,91,0.3)', background: 'rgba(246,198,91,0.08)', color: '#f6c65b' }}
                    >
                      🍺 ×{u.beer_score}
                    </span>
                  )}
                  {index === 0 && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full border font-black uppercase tracking-wide"
                      style={{ borderColor: 'rgba(57,255,20,0.35)', color: 'var(--primary)', background: 'rgba(57,255,20,0.08)' }}
                    >
                      Just landed
                    </span>
                  )}
                </div>
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
                confirmRemoveId === u.id ? (
                  <div className="flex-shrink-0 flex items-center gap-1.5">
                    <button
                      onClick={() => handleRemove(u.id)}
                      disabled={acting === u.id}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-50"
                      style={{
                        borderColor: '#f87171',
                        color: '#f87171',
                        background: 'rgba(248,113,113,0.08)',
                      }}
                    >
                      {acting === u.id ? '…' : <><UserMinus size={13} /> Delete</>}
                    </button>
                    <button
                      onClick={() => setConfirmRemoveId(null)}
                      disabled={acting === u.id}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-50"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <FriendButton
                    acting={acting === u.id}
                    onRemove={() => setConfirmRemoveId(u.id)}
                  />
                )
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
        .then(({ data }) => setEvents(sortEventsBySchedule(applyFriendsFilter(data.data ?? []), pastOnly)))
        .catch(() => setEvents([]))
        .finally(() => setLoading(false))
      return
    }
    if (myOnly) {
      api.get('/events/my', { params: pastOnly ? { past: 1 } : {} })
        .then(({ data }) => setEvents(sortEventsBySchedule(applyFriendsFilter(data.data ?? []), pastOnly)))
        .catch(() => setEvents([]))
        .finally(() => setLoading(false))
      return
    }
    const params: Record<string, unknown> = {}
    params.per_page = 100
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
      .then(({ data }) => setEvents(sortEventsBySchedule(applyFriendsFilter(data.data ?? []), pastOnly)))
      .finally(() => setLoading(false))
  }, [category, radiusKm, goingOnly, friendsOnly, myOnly, pastOnly, friendIds, user])

  async function handleSetReminders() {
    if (!reminderEvent) { setReminderEvent(null); return }
    setSettingReminders(true)
    try {
      const offsets = Array.from(selectedOffsets)
      await api.post(`/events/${reminderEvent.id}/remind`, { offsets })
      const id = reminderEvent.id
      setReminderOffsets(prev => {
        const next = new Map(prev)
        if (offsets.length === 0) next.delete(id)
        else next.set(id, offsets)
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
        const { past: pastEvent, inProgress } = eventTiming(ev)
        const mutedEvent = ev.status === 'cancelled' || pastEvent

        return (
        <div key={ev.id}
          onClick={() => router.push(`/events/view?id=${ev.id}`)}
          className="rounded-2xl border p-3 sm:p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 transition-opacity hover:opacity-80 cursor-pointer"
          style={{
            background: 'var(--surface)',
            borderColor: ev.status === 'cancelled' ? 'rgba(248,113,113,0.35)' : 'var(--border)',
            opacity: mutedEvent ? 0.68 : 1,
          }}>
          {ev.image_url ? (
            <Image
              src={ev.image_url}
              alt={ev.title}
              width={640}
              height={360}
              className="w-full h-44 sm:w-24 sm:h-24 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-full h-32 sm:w-24 sm:h-24 rounded-xl flex-shrink-0 flex items-center justify-center text-3xl"
                style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
              {CATEGORY_EMOJI[ev.category.value] ?? '•'}
            </div>
          )}
          <div className="w-full flex-1 min-w-0 py-1">
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-xs px-2 py-0.5 rounded-full border font-medium"
                    style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(57,255,20,0.08)' }}>
                    {CATEGORY_EMOJI[ev.category.value] ?? ''} {ev.category.label}
                  </span>
                  {inProgress && <span className="text-xs font-medium" style={{ color: 'var(--primary)' }}>In progress</span>}
                  {pastEvent && !inProgress && <span className="text-xs font-medium" style={{ color: 'var(--secondary)' }}>Past</span>}
                  {ev.status === 'cancelled' && <span className="text-xs text-red-400 font-medium">Cancelled</span>}
                  {ev.is_full && <span className="text-xs text-red-400 font-medium">Full</span>}
                  {ev.skill_level && (
                    <span className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{ev.skill_level}</span>
                  )}
                </div>
                <p className="font-semibold text-sm truncate">{ev.title}</p>
              </div>
              {ev.is_joined && (
                <button
                  onClick={e => openReminder(e, ev)}
                  title="Set reminder"
                  disabled={ev.status === 'cancelled' || pastEvent}
                  className="mt-0.5 p-1.5 rounded-lg transition-colors hover:bg-[--border] flex-shrink-0"
                  style={{ color: (reminderOffsets.get(ev.id)?.length ?? 0) > 0 ? 'var(--primary)' : '#fff' }}
                >
                  <Bell size={15} fill={(reminderOffsets.get(ev.id)?.length ?? 0) > 0 ? 'var(--primary)' : 'none'} />
                </button>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Calendar size={11} style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div>{formatDate(ev.schedule.start_at, ev.schedule.timezone).date}</div>
                  <div>
                    {formatDate(ev.schedule.start_at, ev.schedule.timezone).time}
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
                {(ev.views_count ?? 0) > 0 && <span>· 👁 {ev.views_count} seen</span>}
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
                timezone={ev.schedule.timezone}
              />
            )}
            <EventCommentsPreview eventId={ev.id} count={ev.comments_count ?? 0} />
          </div>
          <div className="w-full sm:w-auto flex items-center justify-end gap-2 flex-shrink-0 mt-0.5 pt-1 sm:pt-0">
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
  const [showCalendar, setShowCalendar] = useState(false)

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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCalendar(true)}
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-semibold transition-opacity hover:opacity-80"
                style={{ background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.25)', color: 'var(--primary)' }}
              >
                <Calendar size={15} /> <span className="hidden sm:inline">Schedule</span>
              </button>
              <a
                href="/moments"
                className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-semibold transition-opacity hover:opacity-80"
                style={{ background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.25)', color: 'var(--primary)' }}
              >
                <Images size={15} /> <span className="hidden sm:inline">Moments</span>
              </a>
              <button
                onClick={() => router.push('/events/create')}
                className="flex items-center gap-2 text-sm px-3 py-2 rounded-xl font-semibold transition-opacity hover:opacity-80"
                style={{ background: 'var(--primary)', color: '#000' }}
              >
                <span className="text-base leading-none">+</span> <span className="hidden sm:inline">New Event</span>
              </button>
            </div>
          </div>

          {showCalendar && <CalendarModal onClose={() => setShowCalendar(false)} />}

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
