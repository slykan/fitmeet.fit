'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Download, Lock, MapPin } from 'lucide-react'
import { CATEGORY_EMOJI } from '@/lib/categories'
import { useAuthStore } from '@/store/auth'
import api from '@/lib/api'

interface LatestRoute {
  id: number
  title: string
  category: { value: string; label: string }
  stats: { distance_km: number | null; elevation_gain: number | null }
  location: { area_label: string | null }
}

export function LatestRoutesSection() {
  const { token } = useAuthStore()
  const [routes, setRoutes] = useState<LatestRoute[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!token) { setLoaded(true); return }
    api.get('/routes', { params: { per_page: 4, sort: 'new' } })
      .then(({ data }) => setRoutes(data.data ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [token])

  if (!loaded) return null

  return (
    <section className="py-14 md:py-16 border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--primary)' }}>
              Public route library
            </p>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Create, download and share routes — free.
            </h2>
            <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Draw routes click-by-click with road snapping. Export as GPX, send to your watch or bike computer, and share with friends.
            </p>
          </div>
          {token && (
            <Link
              href="/meet?tab=routes"
              className="inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80 whitespace-nowrap"
              style={{ color: 'var(--primary)' }}
            >
              Browse all routes <ArrowRight size={14} />
            </Link>
          )}
        </div>

        {token ? (
          <>
            {routes.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                {routes.map((route) => {
                  const emoji = CATEGORY_EMOJI[route.category.value] ?? '📍'
                  return (
                    <Link
                      key={route.id}
                      href={`/routes/view?id=${route.id}`}
                      className="rounded-2xl border p-4 flex flex-col gap-3 transition-opacity hover:opacity-80"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                          style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
                        >
                          {emoji}
                        </div>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full border font-medium"
                          style={{ borderColor: 'var(--primary)', color: 'var(--primary)', background: 'rgba(57,255,20,0.08)' }}
                        >
                          {route.category.label}
                        </span>
                      </div>
                      <p className="font-bold text-sm leading-snug">{route.title}</p>
                      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {route.stats.distance_km != null && <span>{route.stats.distance_km} km</span>}
                        {route.stats.elevation_gain != null && <span>↑ {route.stats.elevation_gain} m</span>}
                      </div>
                      {route.location.area_label && (
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <MapPin size={11} />
                          <span className="truncate">{route.location.area_label}</span>
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}

            <div
              className="rounded-2xl border px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4"
              style={{ borderColor: 'rgba(57,255,20,0.22)', background: 'rgba(57,255,20,0.04)' }}
            >
              <div className="flex items-center gap-3">
                <Download size={17} style={{ color: 'var(--primary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  <strong className="font-semibold" style={{ color: 'var(--text-primary)' }}>Download GPX</strong>{' '}
                  — works with Garmin, Wahoo, Komoot, AllTrails and any GPS device.
                </p>
              </div>
              <Link
                href="/meet?tab=routes"
                className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm whitespace-nowrap"
              >
                Open routes <ArrowRight size={14} />
              </Link>
            </div>
          </>
        ) : (
          <div
            className="rounded-2xl border px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-6"
            style={{ borderColor: 'rgba(57,255,20,0.2)', background: 'rgba(57,255,20,0.04)' }}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(57,255,20,0.1)' }}
              >
                <Lock size={20} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <p className="font-bold mb-1">Sign in to access routes</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Browse public GPX routes, download for your device and share with friends — free with an account.
                </p>
              </div>
            </div>
            <Link
              href="/login"
              className="btn-primary inline-flex items-center gap-2 px-7 py-3 rounded-xl font-bold whitespace-nowrap"
            >
              Sign in free <ArrowRight size={15} />
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
