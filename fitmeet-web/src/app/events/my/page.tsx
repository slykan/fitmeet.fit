'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Users, Pencil, Plus, XCircle, MapPin } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import api from '@/lib/api'
import { shortAddress } from '@/lib/format-address'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'

interface Event {
  id: number
  title: string
  category: { label: string }
  location: { address: string | null }
  schedule: { start_at: string; duration_minutes: number | null }
  participants_count: number
  max_participants: number | null
  status: string
  is_private: boolean
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  active:    { label: 'Active',     color: 'var(--primary)' },
  cancelled: { label: 'Cancelled',  color: '#f87171' },
  completed: { label: 'Completed',  color: 'var(--text-muted)' },
}

export default function MyEventsPage() {
  const { token }    = useAuthStore()
  const router       = useRouter()
  const [events,   setEvents]   = useState<Event[]>([])
  const [loading,  setLoading]  = useState(true)
  const [cancelling, setCancelling] = useState<number | null>(null)

  useEffect(() => {
    if (!token) { router.replace('/login'); return }
    api.get('/events/my')
      .then(({ data }) => setEvents(data.data))
      .finally(() => setLoading(false))
  }, [token, router])

  async function cancelEvent(id: number) {
    if (!confirm('Cancel this event?')) return
    setCancelling(id)
    try {
      await api.delete(`/events/${id}`)
      setEvents(evs => evs.map(e => e.id === id ? { ...e, status: 'cancelled' } : e))
    } finally {
      setCancelling(null)
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 py-8">
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold mb-1">My events</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Events you&apos;ve created</p>
          </div>
          <Link href="/events/create">
            <Button size="sm">
              <Plus size={15} className="mr-1.5" /> New event
            </Button>
          </Link>
        </div>

        {loading && (
          <div className="text-center py-20 text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</div>
        )}

        {!loading && events.length === 0 && (
          <div
            className="rounded-2xl border p-12 text-center"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="text-4xl mb-4">🏃</div>
            <h2 className="font-semibold mb-2">No events yet</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Create your first event and invite people to join
            </p>
            <Link href="/events/create">
              <Button><Plus size={15} className="mr-1.5" /> Create event</Button>
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {events.map(event => {
            const status = STATUS_STYLE[event.status] ?? STATUS_STYLE.active
            const isCancelled = event.status === 'cancelled'

            return (
              <div
                key={event.id}
                className="rounded-2xl border p-5 transition-opacity"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  opacity: isCancelled ? 0.6 : 1,
                }}
              >
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full border font-medium"
                    style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(57,255,20,0.08)' }}
                  >
                    {event.category.label}
                  </span>
                  <span className="text-xs font-medium" style={{ color: status.color }}>
                    {status.label}
                  </span>
                </div>

                <h2 className="font-semibold text-base mb-2">{event.title}</h2>

                <div className="space-y-1 mb-3">
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Calendar size={12} />
                    {formatDate(event.schedule.start_at)}
                    {event.schedule.duration_minutes && ` · ${event.schedule.duration_minutes} min`}
                  </div>
                  {event.location.address && (
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <MapPin size={12} />
                      <span className="truncate">{shortAddress(event.location.address ?? '')}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Users size={12} />
                    {event.participants_count} joined
                    {event.max_participants ? ` / ${event.max_participants}` : ''}
                  </div>
                </div>

                {!isCancelled && (
                  <div className="flex gap-2">
                    <Link href={`/events/edit?id=${event.id}`} className="flex-1">
                      <Button size="sm" variant="ghost" className="border w-full">
                        <Pencil size={13} className="mr-1" /> Edit
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={cancelling === event.id}
                      onClick={() => cancelEvent(event.id)}
                      className="border text-red-400 hover:text-red-400 flex-1"
                    >
                      <XCircle size={13} className="mr-1" /> Cancel
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>
      </main>
    </>
  )
}
