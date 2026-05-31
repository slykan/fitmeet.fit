'use client'

import { useMemo, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Calendar, ChevronLeft, ChevronRight, MapPin, MessageCircle, Users, Zap } from 'lucide-react'

import { formatEventDateParts } from '@/lib/event-time'
import { shortAddress } from '@/lib/format-address'
import { CATEGORY_EMOJI } from '@/lib/categories'

type LatestEvent = {
  id: number
  title: string
  image_url: string | null
  category: { value: string; label: string }
  location: { address: string | null }
  schedule: { start_at: string; timezone: string; duration_minutes: number | null }
  activity: { distance_km: number | null; elevation_gain: number | null }
  participants_count: number
  views_count: number
  comments_count: number
  status: string
  organizer: { id: number; name: string } | null
}

function formatDate(iso: string, timezone?: string | null) {
  return formatEventDateParts(iso, timezone)
}

function isPastEvent(startAt: string, durationMinutes: number | null) {
  const start = new Date(startAt).getTime()
  const end = start + (durationMinutes ?? 60) * 60_000
  return Date.now() >= end
}

export function LatestEventsCarousel({ events }: { events: LatestEvent[] }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)

  const cards = useMemo(
    () =>
      events.map((event) => {
        const timing = formatDate(event.schedule.start_at, event.schedule.timezone)
        const past = isPastEvent(event.schedule.start_at, event.schedule.duration_minutes)
        const href = `/login?redirect=${encodeURIComponent(`/events/share/${event.id}`)}`

        return (
          <Link
            key={event.id}
            href={href}
            className="group snap-start shrink-0 w-[19rem] sm:w-[21rem] rounded-2xl border overflow-hidden transition-transform hover:-translate-y-0.5"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            {event.image_url ? (
              <Image
                src={event.image_url}
                alt={event.title}
                width={640}
                height={360}
                className="w-full h-44 object-cover"
              />
            ) : (
              <div
                className="w-full h-44 flex items-center justify-center text-5xl"
                style={{ background: 'var(--background)' }}
              >
                {CATEGORY_EMOJI[event.category.value] ?? '•'}
              </div>
            )}

            <div className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full border font-medium"
                      style={{
                        borderColor: 'var(--primary)',
                        color: 'var(--primary)',
                        background: 'rgba(57,255,20,0.08)',
                      }}
                    >
                      {CATEGORY_EMOJI[event.category.value] ?? ''} {event.category.label}
                    </span>
                    {past && (
                      <span className="text-[11px] font-medium" style={{ color: 'var(--secondary)' }}>
                        Past
                      </span>
                    )}
                  </div>
                  <p className="font-semibold leading-snug line-clamp-2 group-hover:opacity-80">{event.title}</p>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} className="shrink-0 mt-0.5" />
              </div>

              <div className="space-y-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                <div className="flex items-start gap-2">
                  <Calendar size={14} className="shrink-0 mt-0.5" />
                  <div>
                    <div>{timing.day}</div>
                    <div>
                      {timing.time}
                      {event.schedule.duration_minutes ? ` · ${event.schedule.duration_minutes} min` : ''}
                    </div>
                  </div>
                </div>

                {event.location.address && (
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="shrink-0" />
                    <span className="truncate">{shortAddress(event.location.address)}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="inline-flex items-center gap-1.5">
                    <Users size={14} />
                    {event.participants_count} joined
                  </span>
                  <span>👁 {event.views_count ?? 0}</span>
                  <span className="inline-flex items-center gap-1.5">
                    <MessageCircle size={14} />
                    {event.comments_count ?? 0}
                  </span>
                </div>

                {(event.activity.distance_km || event.activity.elevation_gain) && (
                  <div className="flex items-center gap-2">
                    <Zap size={14} style={{ color: 'var(--primary)' }} className="shrink-0" />
                    <span>
                      {[
                        event.activity.distance_km && `${event.activity.distance_km} km`,
                        event.activity.elevation_gain && `↑${event.activity.elevation_gain} m`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                )}

                {event.organizer?.name && (
                  <div className="pt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    by <span style={{ color: 'var(--text-primary)' }}>{event.organizer.name}</span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        )
      }),
    [events],
  )

  function scrollByAmount(direction: 'left' | 'right') {
    const scroller = scrollerRef.current
    if (!scroller) return

    const amount = Math.round(scroller.clientWidth * 0.9)
    scroller.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    })
  }

  if (events.length === 0) return null

  return (
    <section className="py-12 md:py-14 border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--primary)' }}>
              Latest events
            </p>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">A real look at what people are posting.</h2>
            <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              The latest ten public events, newest first. Jump in, browse the vibe, then sign in to join or create your own.
            </p>
          </div>

          <div className="hidden md:flex items-center gap-2 shrink-0">
            <button
              type="button"
              aria-label="Scroll left"
              onClick={() => scrollByAmount('left')}
              className="w-10 h-10 rounded-full border flex items-center justify-center transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Scroll right"
              onClick={() => scrollByAmount('right')}
              className="w-10 h-10 rounded-full border flex items-center justify-center transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div
          ref={scrollerRef}
          className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide"
        >
          {cards}
        </div>
      </div>
    </section>
  )
}
