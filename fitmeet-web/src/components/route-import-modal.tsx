'use client'

import { useEffect, useState } from 'react'
import { Route as RouteIcon, Search, X } from 'lucide-react'

import api from '@/lib/api'
import { CATEGORIES, CATEGORY_EMOJI } from '@/lib/categories'

export interface ImportableRoute {
  id: number
  title: string
  category: { value: string; label: string }
  stats: {
    distance_km: number | null
    elevation_gain: number | null
  }
  location: { area_label: string | null }
}

interface Props {
  visible: boolean
  importingId: number | null
  onClose: () => void
  onImport: (route: ImportableRoute) => void
}

export function RouteImportModal({ visible, importingId, onClose, onImport }: Props) {
  const [routes, setRoutes] = useState<ImportableRoute[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')

  useEffect(() => {
    if (!visible) return
    setLoading(true)
    const id = window.setTimeout(() => {
      api.get('/routes', {
        params: {
          per_page: 60,
          sort: 'new',
          q: query.trim() || undefined,
          category: category || undefined,
        },
      })
      .then(({ data }) => setRoutes(data.data ?? []))
      .catch(() => setRoutes([]))
      .finally(() => setLoading(false))
    }, query ? 220 : 0)

    return () => window.clearTimeout(id)
  }, [category, query, visible])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p style={{ color: 'var(--primary)', fontSize: 11, fontWeight: 900, letterSpacing: 0.6 }}>FITMEET</p>
            <p className="font-bold text-lg">Route catalog</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>

        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2"
            style={{ background: 'var(--background)', borderColor: 'var(--border)' }}>
            <Search size={14} style={{ color: 'var(--text-muted)' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search routes"
              className="w-full bg-transparent text-xs outline-none"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {[{ value: '', label: 'All' }, ...CATEGORIES].map(cat => {
              const active = category === cat.value
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className="flex-shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    borderColor: active ? 'var(--primary)' : 'var(--border)',
                    color: active ? 'var(--primary)' : 'var(--text-muted)',
                    background: active ? 'rgba(57,255,20,0.08)' : 'transparent',
                  }}
                >
                  {cat.value ? `${CATEGORY_EMOJI[cat.value] ?? ''} ${cat.label}` : cat.label}
                </button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>Loading routes...</p>
        ) : routes.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>No public routes yet.</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {routes.map(route => (
              <button
                key={route.id}
                onClick={() => onImport(route)}
                disabled={importingId === route.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all hover:opacity-80 disabled:opacity-50"
                style={{ borderColor: 'var(--border)', background: 'var(--background)' }}
              >
                <span className="text-xl">{CATEGORY_EMOJI[route.category.value] ?? <RouteIcon size={18} />}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{route.title}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {[
                      route.stats.distance_km != null && `${route.stats.distance_km} km`,
                      route.stats.elevation_gain != null && `up ${route.stats.elevation_gain} m`,
                      route.location.area_label,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span style={{ color: importingId === route.id ? 'var(--text-muted)' : 'var(--primary)', fontSize: 13, fontWeight: 700 }}>
                  {importingId === route.id ? '...' : 'Use'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
