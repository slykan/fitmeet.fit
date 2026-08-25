'use client'

import { useEffect, useRef, useState } from 'react'

interface CityResult {
  key: string
  name: string
  region: string | null
}

interface Props {
  value: string
  onChange: (city: string) => void
  countryCode: string | null
  placeholder?: string
  className?: string
}

function cityNameFromAddress(address: Record<string, string> | undefined, fallback: string): string {
  return address?.city ?? address?.town ?? address?.village ?? address?.municipality ?? address?.county ?? fallback
}

export function CityAutocomplete({ value, onChange, countryCode, placeholder, className }: Props) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<CityResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const requestId = useRef(0)

  useEffect(() => setQuery(value), [value])

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!open || q.length < 2 || !countryCode) {
      setResults([])
      return
    }
    const id = ++requestId.current
    setLoading(true)
    const timer = setTimeout(() => {
      fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=${countryCode.toLowerCase()}&format=json&addressdetails=1&limit=8`,
        { headers: { 'Accept-Language': 'en' } }
      )
        .then(res => res.json())
        .then((data: { place_id: number; display_name: string; address?: Record<string, string> }[]) => {
          if (id !== requestId.current) return
          const seen = new Set<string>()
          const cities: CityResult[] = []
          for (const r of data) {
            const name = cityNameFromAddress(r.address, r.display_name.split(',')[0].trim())
            if (seen.has(name)) continue
            seen.add(name)
            cities.push({ key: String(r.place_id), name, region: r.address?.state ?? null })
          }
          setResults(cities)
        })
        .catch(() => { if (id === requestId.current) setResults([]) })
        .finally(() => { if (id === requestId.current) setLoading(false) })
    }, 350)
    return () => clearTimeout(timer)
  }, [query, countryCode, open])

  return (
    <div className="relative" ref={ref}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={countryCode ? (placeholder ?? 'Search cities...') : 'Pick a country first'}
        disabled={!countryCode}
        autoComplete="off"
        className={className}
      />
      {open && countryCode && query.trim().length >= 2 && (
        <div
          className="absolute left-0 right-0 mt-1 rounded-xl border shadow-xl overflow-y-auto z-50"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', maxHeight: 260 }}
        >
          {loading && (
            <div className="px-4 py-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>Searching...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-4 py-2.5 text-sm" style={{ color: 'var(--text-muted)' }}>No cities found.</div>
          )}
          {!loading && results.map(r => (
            <button
              key={r.key}
              type="button"
              onClick={() => { onChange(r.name); setQuery(r.name); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[--border]"
              style={{ color: 'var(--text-primary)' }}
            >
              {r.name}
              {r.region && <span className="ml-1.5" style={{ color: 'var(--text-muted)' }}>· {r.region}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
