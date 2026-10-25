'use client'

import { useCallback, useEffect, useState } from 'react'
import { HeartPulse, Loader2, Pencil } from 'lucide-react'

import api from '@/lib/api'

// Personal heart-rate zones (own profile) — used by the training charts, reports and the AI coach.
// Same logic as the app's HrZonesCard: Max HR (50–90 %), heart-rate reserve (Karvonen) or manual.

interface Zones { bounds: number[] | null; max: number | null; rest: number | null; source: string | null; highest_recorded?: number | null }

const ZONES = [
  { name: 'Z1', label: 'Recovery', color: '#8f9bbd' },
  { name: 'Z2', label: 'Endurance', color: '#3399ff' },
  { name: 'Z3', label: 'Tempo', color: '#6cff2f' },
  { name: 'Z4', label: 'Threshold', color: '#ffaa00' },
  { name: 'Z5', label: 'Max', color: '#ff3b30' },
]
const SHARES = [0.5, 0.6, 0.7, 0.8, 0.9]
const fromMax = (max: number) => SHARES.map(s => Math.round(max * s))
const fromHrr = (max: number, rest: number) => SHARES.map(s => Math.round(rest + s * (max - rest)))

type Mode = 'max' | 'hrr' | 'manual'
const MODE_LABEL: Record<Mode, string> = { max: 'Max HR', hrr: 'HRR', manual: 'Manual' }
const SOURCE_TEXT: Record<string, string> = {
  manual: 'Your own zones',
  hrr: 'Heart rate reserve (Karvonen)',
  max: 'From your max HR',
  age: 'Estimated from age (220 − age) — set your max HR for accurate zones',
  observed: 'Estimated from your highest recorded HR — set your max HR',
}
const input = 'w-24 h-10 rounded-lg border text-center font-semibold bg-transparent outline-none focus:border-[var(--primary)]'

export function HrZonesCard() {
  const [zones, setZones] = useState<Zones | null>(null)
  const [editing, setEditing] = useState(false)
  const [mode, setMode] = useState<Mode>('max')
  const [max, setMax] = useState('')
  const [rest, setRest] = useState('')
  const [bounds, setBounds] = useState<string[]>(['', '', '', '', ''])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    api.get('/me').then(({ data }) => setZones(data.data?.hr_zones ?? null)).catch(() => {})
  }, [])
  useEffect(load, [load])

  useEffect(() => {
    setMode(zones?.source === 'manual' ? 'manual' : zones?.source === 'hrr' ? 'hrr' : 'max')
    setMax(zones?.max ? String(zones.max) : '')
    setRest(zones?.rest ? String(zones.rest) : '')
    setBounds((zones?.bounds ?? []).map(String).concat(['', '', '', '', '']).slice(0, 5))
    setError(null)
  }, [zones, editing])

  const m = Number(max), r = Number(rest)
  const preview = mode === 'max' && m >= 120 ? fromMax(m)
    : mode === 'hrr' && m >= 120 && r >= 30 && r < m ? fromHrr(m, r)
    : mode === 'manual' ? bounds.map(Number) : [0, 0, 0, 0, 0]

  async function save(payload: Record<string, unknown>) {
    setSaving(true)
    setError(null)
    try {
      const { data } = await api.patch('/me', payload)
      setZones(data.data?.hr_zones ?? null)
      if (!data.data?.hr_zones) load()
      setEditing(false)
    } catch (e: unknown) {
      setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Please check the values and try again.')
    } finally {
      setSaving(false)
    }
  }

  function onSave() {
    if (mode !== 'manual' && (!m || m < 120 || m > 230)) return setError('Enter a max heart rate between 120 and 230 bpm.')
    if (mode === 'max') return save({ hr_max: m, hr_zones: null, hr_zone_method: 'max' })
    if (mode === 'hrr') {
      if (!r || r < 30 || r > 110 || r >= m) return setError('Enter your resting heart rate (30–110 bpm, below your max).')
      return save({ hr_max: m, hr_rest: r, hr_zones: fromHrr(m, r), hr_zone_method: 'hrr' })
    }
    const b = bounds.map(Number)
    if (b.some(v => !v) || b.some((v, i) => i > 0 && v <= b[i - 1])) return setError('Enter all five zones, each starting higher than the one before.')
    save({ hr_zones: b, hr_max: m || null, hr_zone_method: 'manual' })
  }

  const shown = zones?.bounds ?? null
  return (
    <div className="rounded-2xl border p-4 sm:p-5 flex flex-col gap-4" style={{ background: 'var(--surface)', borderColor: 'rgba(255,59,48,0.3)' }}>
      <div className="flex items-center gap-3">
        <HeartPulse size={20} style={{ color: '#ff3b30' }} />
        <div className="flex-1">
          <div className="font-bold">Heart rate zones</div>
          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{zones?.source ? SOURCE_TEXT[zones.source] : 'Set your max HR to get your zones'}</div>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: 'rgba(57,255,20,0.08)', color: 'var(--primary)' }}>
            <Pencil size={13} /> Edit
          </button>
        )}
      </div>

      {!editing && shown && (
        <div className="flex flex-col gap-2">
          {ZONES.map((z, i) => (
            <div key={z.name} className="flex items-center gap-2 text-sm">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: z.color }} />
              <span className="flex-1" style={{ color: 'var(--text-muted)' }}>{z.name} {z.label}</span>
              <b>{shown[i]}{i < 4 ? `–${shown[i + 1] - 1}` : '+'} bpm</b>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl" style={{ border: '1px solid var(--border)' }}>
            {(['max', 'hrr', 'manual'] as const).map(k => (
              <button key={k} onClick={() => setMode(k)} className="py-2 text-xs sm:text-sm font-semibold rounded-lg"
                style={{ background: mode === k ? 'var(--primary)' : 'transparent', color: mode === k ? '#000' : 'var(--text-muted)' }}>
                {MODE_LABEL[k]}
              </button>
            ))}
          </div>
          {mode !== 'manual' ? (
            <>
              <label className="flex items-center gap-3 text-sm">
                <span className="flex-1 font-semibold">Max HR</span>
                <input inputMode="numeric" maxLength={3} value={max} onChange={e => setMax(e.target.value)} placeholder="e.g. 185" className={input} style={{ borderColor: 'var(--border)' }} />
                <span className="w-8 text-xs" style={{ color: 'var(--text-muted)' }}>bpm</span>
              </label>
              {zones?.highest_recorded ? (
                <button onClick={() => setMax(String(zones.highest_recorded))} className="text-left text-xs" style={{ color: 'var(--primary)' }}>
                  Highest HR in your trainings: <b>{zones.highest_recorded} bpm</b> — click to use
                </button>
              ) : null}
              {mode === 'hrr' && (
                <>
                  <label className="flex items-center gap-3 text-sm">
                    <span className="flex-1 font-semibold">Resting HR</span>
                    <input inputMode="numeric" maxLength={3} value={rest} onChange={e => setRest(e.target.value)} placeholder="e.g. 50" className={input} style={{ borderColor: 'var(--border)' }} />
                    <span className="w-8 text-xs" style={{ color: 'var(--text-muted)' }}>bpm</span>
                  </label>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Zones = resting + 50/60/70/80/90 % of (max − resting). Measure resting HR in the morning, lying down.</p>
                </>
              )}
            </>
          ) : (
            ZONES.map((z, i) => (
              <label key={z.name} className="flex items-center gap-3 text-sm">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: z.color }} />
                <span className="flex-1 font-semibold">{z.name} from</span>
                <input inputMode="numeric" maxLength={3} value={bounds[i]} onChange={e => setBounds(p => p.map((v, k) => (k === i ? e.target.value : v)))} className={input} style={{ borderColor: 'var(--border)' }} />
                <span className="w-8 text-xs" style={{ color: 'var(--text-muted)' }}>bpm</span>
              </label>
            ))
          )}
          {preview.every(v => v > 0) && (
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{ZONES.map((z, i) => `${z.name} ${preview[i]}`).join(' · ')}</p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-3">
            <button onClick={() => setEditing(false)} className="h-10 px-4 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Cancel</button>
            <button onClick={onSave} disabled={saving} className="h-10 min-w-24 px-5 rounded-xl font-bold text-sm text-black disabled:opacity-60 flex items-center justify-center" style={{ background: 'var(--primary)' }}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
