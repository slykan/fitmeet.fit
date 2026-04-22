'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { CATEGORIES, CATEGORY_EMOJI, FILTER_FEATURED } from '@/lib/categories'

const FEATURED = CATEGORIES.filter(c => FILTER_FEATURED.includes(c.value))
const MORE     = CATEGORIES.filter(c => !FILTER_FEATURED.includes(c.value))

function pillStyle(active: boolean) {
  return active
    ? { borderColor: 'var(--primary)', background: 'rgba(57,255,20,0.08)', color: 'var(--primary)' }
    : { borderColor: 'var(--border)', color: 'var(--text-muted)' }
}

function MoreDropdown({
  selectedValues, onSelect,
}: {
  selectedValues: string[]
  onSelect: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const hasSelectedMore = MORE.some(c => selectedValues.includes(c.value))

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border text-sm transition-all"
        style={{
          borderColor: (hasSelectedMore && !open) ? 'var(--primary)' : 'var(--border)',
          color:       (hasSelectedMore && !open) ? 'var(--primary)' : 'var(--text-muted)',
          background:  (hasSelectedMore && !open) ? 'rgba(57,255,20,0.08)' : 'transparent',
        }}
      >
        More <ChevronDown size={13} />
      </button>

      {open && (
        <div
          className="absolute left-0 mt-1 rounded-xl border shadow-xl overflow-y-auto z-50"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', minWidth: 170, maxHeight: 300 }}
        >
          {MORE.map(cat => (
            <button
              key={cat.value}
              type="button"
              onClick={() => onSelect(cat.value)}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-[--border] text-left"
              style={{ color: selectedValues.includes(cat.value) ? 'var(--primary)' : 'var(--text-primary)' }}
            >
              <span>{CATEGORY_EMOJI[cat.value] ?? '📌'}</span>{cat.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Single-select (create / edit event) ─────────────────────────────────────

interface SingleProps {
  value: string
  onChange: (v: string) => void
}

export default function CategoryPicker({ value, onChange }: SingleProps) {
  const selectedMore = MORE.find(c => c.value === value)

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {FEATURED.map(cat => (
        <button
          key={cat.value}
          type="button"
          onClick={() => onChange(cat.value)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all active:scale-95"
          style={pillStyle(value === cat.value)}
        >
          <span>{cat.emoji}</span>{cat.label}
        </button>
      ))}

      {selectedMore && (
        <button
          type="button"
          onClick={() => onChange(selectedMore.value)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all active:scale-95"
          style={pillStyle(true)}
        >
          <span>{selectedMore.emoji}</span>{selectedMore.label}
        </button>
      )}

      <MoreDropdown
        selectedValues={value ? [value] : []}
        onSelect={v => onChange(v)}
      />
    </div>
  )
}

// ─── Multi-select (onboarding interests) ─────────────────────────────────────

interface MultiProps {
  value: string[]
  onChange: (v: string[]) => void
}

export function CategoryMultiPicker({ value, onChange }: MultiProps) {
  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  }

  const selectedMoreCats = MORE.filter(c => value.includes(c.value))

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {FEATURED.map(cat => (
        <button
          key={cat.value}
          type="button"
          onClick={() => toggle(cat.value)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all active:scale-95"
          style={pillStyle(value.includes(cat.value))}
        >
          <span>{cat.emoji}</span>{cat.label}
        </button>
      ))}

      {selectedMoreCats.map(cat => (
        <button
          key={cat.value}
          type="button"
          onClick={() => toggle(cat.value)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all active:scale-95"
          style={pillStyle(true)}
        >
          <span>{cat.emoji}</span>{cat.label}
        </button>
      ))}

      <MoreDropdown
        selectedValues={value}
        onSelect={toggle}
      />
    </div>
  )
}
