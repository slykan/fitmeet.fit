'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  Search, Phone, UserPlus, UserCheck, UserMinus, Calendar, MapPin, Users, Zap, ChevronRight, ChevronDown,
} from 'lucide-react'

import { Navbar } from '@/components/navbar'
import api from '@/lib/api'
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
}

interface EventItem {
  id: number
  title: string
  category: { value: string; label: string }
  location: { address: string | null }
  schedule: { start_at: string; duration_minutes: number | null }
  activity: { distance_km: number | null; elevation_gain: number | null }
  participants_count: number
  max_participants: number | null
  is_full: boolean
  skill_level: string | null
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
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
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
              </div>
              {u.friendship_status === 'friends' ? (
                <button
                  onClick={() => handleRemove(u.id)}
                  disabled={acting === u.id}
                  title="Remove friend"
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors hover:border-red-400 hover:text-red-400 disabled:opacity-50"
                  style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(57,255,20,0.08)' }}
                >
                  {acting === u.id ? '…' : <><UserCheck size={13} /> Friends</>}
                </button>
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

const FEATURED_CATS = [
  { value: '', label: 'All' },
  ...CATEGORIES.filter(c => FILTER_FEATURED.includes(c.value)),
]
const MORE_CATS = CATEGORIES.filter(c => !FILTER_FEATURED.includes(c.value))

function CategoryFilter({ category, setCategory }: { category: string; setCategory: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const selectedMore = MORE_CATS.find(c => c.value === category)

  function pill(value: string, label: string, emoji?: string) {
    const active = category === value
    return (
      <button
        key={value}
        onClick={() => setCategory(value)}
        className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors"
        style={{
          borderColor: active ? 'var(--primary)' : 'var(--border)',
          color:       active ? 'var(--primary)' : 'var(--text-muted)',
          background:  active ? 'rgba(57,255,20,0.08)' : 'transparent',
        }}
      >
        {emoji ? `${emoji} ${label}` : label}
      </button>
    )
  }

  return (
    <div className="flex gap-2 items-center flex-wrap">
      {FEATURED_CATS.map(c => pill(c.value, c.label, c.value ? CATEGORY_EMOJI[c.value] : undefined))}

      {/* Show selected "more" category as an active pill */}
      {selectedMore && pill(selectedMore.value, selectedMore.label, CATEGORY_EMOJI[selectedMore.value])}

      {/* More... dropdown */}
      <div className="relative flex-shrink-0" ref={ref}>
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors"
          style={{
            borderColor: (selectedMore && !open) ? 'var(--primary)' : 'var(--border)',
            color:       (selectedMore && !open) ? 'var(--primary)' : 'var(--text-muted)',
            background:  (selectedMore && !open) ? 'rgba(57,255,20,0.08)' : 'transparent',
          }}
        >
          More <ChevronDown size={11} />
        </button>
        {open && (
          <div
            className="absolute left-0 mt-1 rounded-xl border shadow-xl overflow-y-auto z-50"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', minWidth: 160, maxHeight: 280 }}
          >
            {MORE_CATS.map(c => (
              <button
                key={c.value}
                onClick={() => { setCategory(c.value); setOpen(false) }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-[--border] text-left"
                style={{ color: category === c.value ? 'var(--primary)' : 'var(--text-primary)' }}
              >
                <span>{CATEGORY_EMOJI[c.value] ?? '📌'}</span> {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EventsTab() {
  const { user }      = useAuthStore()
  const [events,   setEvents]   = useState<EventItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [category, setCategory] = useState('')
  const [radiusKm, setRadiusKm] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    const params: Record<string, unknown> = {}
    if (category) params.category = category
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
      .then(({ data }) => setEvents(data.data ?? []))
      .finally(() => setLoading(false))
  }, [category, radiusKm, user])

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

      {loading && (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
      )}

      {!loading && events.length === 0 && (
        <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>No events found.</div>
      )}

      {!loading && events.map(ev => (
        <Link key={ev.id} href={`/events/view?id=${ev.id}`}
          className="rounded-2xl border p-4 flex items-start justify-between gap-3 transition-opacity hover:opacity-80 block"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs px-2 py-0.5 rounded-full border font-medium"
                style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(57,255,20,0.08)' }}>
                {CATEGORY_EMOJI[ev.category.value] ?? ''} {ev.category.label}
              </span>
              {ev.is_full && <span className="text-xs text-red-400 font-medium">Full</span>}
              {ev.skill_level && (
                <span className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{ev.skill_level}</span>
              )}
            </div>
            <p className="font-semibold text-sm truncate mb-1.5">{ev.title}</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Calendar size={11} />
                {formatDate(ev.schedule.start_at)}
                {ev.schedule.duration_minutes && <span>· {ev.schedule.duration_minutes} min</span>}
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
          </div>
          <ChevronRight size={16} className="flex-shrink-0 mt-1" style={{ color: 'var(--text-muted)' }} />
        </Link>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MeetPage() {
  const { token } = useAuthStore()
  const router    = useRouter()
  const [tab, setTab] = useState<'people' | 'events'>('people')

  useEffect(() => {
    if (!token) router.replace('/login')
  }, [token, router])

  if (!token) return null

  return (
    <>
      <Navbar />
      <main className="min-h-screen py-8 px-4">
        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          <h1 className="text-2xl font-bold mb-6">Meet</h1>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            {(['people', 'events'] as const).map(t => (
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
