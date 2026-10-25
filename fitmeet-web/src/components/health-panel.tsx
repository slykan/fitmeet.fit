'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bed, ChevronLeft, ChevronRight, Dumbbell, Flame, Footprints, HeartPulse, Loader2, Pencil, UtensilsCrossed } from 'lucide-react'

import { FoodLog, type Meal, type MealTemplate, type QuickDrink } from '@/components/food-log'
import { HrZonesCard } from '@/components/hr-zones-card'
import api from '@/lib/api'

// Health (own profile only): first visit — or "Edit health data" — shows the form, fields we
// already have (birth date from the profile) prefilled; after saving, the energy gauge.
// Same panel in Feed › Health and at /health (Profile › Health settings).

type Sex = 'male' | 'female' | 'na'
type Goal = 'lose' | 'maintain' | 'gain'

export interface EnergyDay {
  bmr: number; steps: number; training: number; food: number; total: number; trainings: number; estimated: boolean
  intake?: number; protein_g?: number; carbs_g?: number; fat_g?: number; water_ml?: number; logged_days?: number
}

const shiftDay = (iso: string, by: number) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + by)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const dayLabel = (iso: string, isToday: boolean) => {
  if (isToday) return 'Today'
  const d = new Date(iso + 'T12:00:00')
  const y = new Date(); y.setDate(y.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

interface HealthPayload {
  complete: boolean
  missing: string[]
  profile: {
    sex: Sex | null; birth_date: string | null; age: number | null
    weight_kg: number | null; height_cm: number | null; body_fat_pct: number | null
    avg_daily_steps: number | null; ftp_w: number | null; goal: Goal | null; target_weight_kg: number | null
  }
  bmr: { kcal: number; formula: 'katch_mcardle' | 'mifflin_st_jeor' } | null
  today: EnergyDay | null
  week: EnergyDay | null
  w_per_kg?: number | null
  date: string
  is_today: boolean
  meals: Meal[]
  recent: MealTemplate[]
  quick_drinks: QuickDrink[]
  estimates_left: number
}

const SEX: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'na', label: 'Prefer not to say' },
]
const GOALS: { value: Goal; label: string }[] = [
  { value: 'lose', label: 'Lose weight' }, { value: 'maintain', label: 'Maintain' }, { value: 'gain', label: 'Gain weight' },
]
const str = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))
const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : null }
const fmt = (n: number) => Math.round(n).toLocaleString('en-US').replace(/,/g, ' ')

const card = { background: 'var(--surface)', borderColor: 'var(--border)' }
const input = 'w-24 h-10 rounded-lg border text-center font-semibold bg-transparent outline-none focus:border-[var(--primary)]'

export function HealthPanel({ startEditing = false }: { startEditing?: boolean }) {
  const [data, setData] = useState<HealthPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(startEditing)
  const [saving, setSaving] = useState(false)
  const [f, setF] = useState({ sex: null as Sex | null, birth: '', weight: '', height: '', fat: '', steps: '', ftp: '', goal: null as Goal | null, target: '' })

  const fill = (p: HealthPayload['profile']) => setF({
    sex: p.sex, birth: p.birth_date ?? '', weight: str(p.weight_kg), height: str(p.height_cm), fat: str(p.body_fat_pct),
    steps: str(p.avg_daily_steps), ftp: str(p.ftp_w), goal: p.goal, target: str(p.target_weight_kg),
  })

  const [date, setDate] = useState<string | null>(null)
  const load = useCallback((d: string | null) => {
    api.get<HealthPayload>('/health', { params: d ? { date: d } : {} })
      .then(({ data }) => { setData(data); fill(data.profile); if (!data.complete) setEditing(true) })
      .catch(() => setError('Could not load your health data.'))
  }, [])
  useEffect(() => load(date), [load, date])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!f.sex) return setError('Choose your sex — it is needed for the calorie formula.')
    if (!f.birth) return setError('Enter your date of birth.')
    if (!num(f.weight) || !num(f.height)) return setError('Enter your weight and height.')
    setSaving(true)
    setError(null)
    try {
      const { data } = await api.put<HealthPayload>('/health', {
        sex: f.sex, birth_date: f.birth, weight_kg: num(f.weight), height_cm: Math.round(num(f.height) ?? 0),
        body_fat_pct: num(f.fat), avg_daily_steps: f.steps.trim() ? Math.round(num(f.steps) ?? 0) : null,
        ftp_w: f.ftp.trim() ? Math.round(num(f.ftp) ?? 0) : null, goal: f.goal, target_weight_kg: num(f.target),
      })
      setData(data)
      fill(data.profile)
      setEditing(false)
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Saving failed. Check the values and try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!data) {
    return <div className="py-16 flex justify-center text-sm" style={{ color: 'var(--text-muted)' }}>{error ?? <Loader2 className="animate-spin" />}</div>
  }

  if (!editing && data.complete && data.today && data.week) {
    const p = data.profile
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setDate(shiftDay(data.date, -1))} aria-label="Previous day" className="w-9 h-9 rounded-xl border flex items-center justify-center" style={card}><ChevronLeft size={17} /></button>
          <button onClick={() => setDate(null)} disabled={data.is_today} className="flex-1 text-center">
            <div className="font-bold">{dayLabel(data.date, data.is_today)}</div>
            {!data.is_today && <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>click for today</div>}
          </button>
          <button onClick={() => setDate(shiftDay(data.date, 1))} disabled={data.is_today} aria-label="Next day" className="w-9 h-9 rounded-xl border flex items-center justify-center disabled:opacity-30" style={card}><ChevronRight size={17} /></button>
        </div>
        <EnergyGauge key={data.date} today={data.today} week={data.week} todayLabel={data.is_today ? 'Today' : 'Day'} avgSteps={data.profile.avg_daily_steps} />
        <FoodLog<HealthPayload> date={data.date} meals={data.meals} recent={data.recent} quickDrinks={data.quick_drinks}
          estimatesLeft={data.estimates_left} onChange={p => setData(p)} />
        <div className="flex flex-wrap gap-2">
          <Fact label="Weight" value={`${p.weight_kg} kg`} />
          <Fact label="Height" value={`${p.height_cm} cm`} />
          {p.body_fat_pct ? <Fact label="Body fat" value={`${p.body_fat_pct} %`} /> : null}
          {p.ftp_w ? <Fact label="FTP" value={`${p.ftp_w} W${data.w_per_kg ? ` · ${data.w_per_kg} W/kg` : ''}`} /> : null}
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          BMR {data.bmr?.kcal} kcal — {data.bmr?.formula === 'katch_mcardle' ? 'Katch-McArdle (uses body fat)' : 'Mifflin-St Jeor'}
          {p.avg_daily_steps ? '' : ' · add your average steps for a better daily estimate'}
        </p>
        <button onClick={() => setEditing(true)} className="flex items-center justify-center gap-2 h-11 rounded-xl font-semibold text-sm"
          style={{ background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.35)', color: 'var(--primary)' }}>
          <Pencil size={15} /> Edit health data
        </button>
        <HrZonesCard />
      </div>
    )
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(s => ({ ...s, [k]: e.target.value }))
  return (
    <div className="flex flex-col gap-4">
    <form onSubmit={save} className="rounded-2xl border p-4 sm:p-6 flex flex-col gap-4" style={{ ...card, borderColor: 'rgba(255,59,48,0.3)' }}>
      <div className="flex items-start gap-3">
        <HeartPulse size={20} style={{ color: '#ff3b30' }} />
        <div>
          <h2 className="font-bold">Health data</h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>For your BMR, daily calories and a smarter AI coach. Only you can see it.</p>
        </div>
      </div>

      <Segmented label={<>Sex <span className="text-red-400">*</span> <span className="font-normal text-xs" style={{ color: 'var(--text-muted)' }}>(for the calorie formula)</span></>}
        options={SEX} value={f.sex} onChange={v => setF(s => ({ ...s, sex: v }))} />

      <Row label={<>Date of birth <span className="text-red-400">*</span></>}>
        <input type="date" value={f.birth} onChange={set('birth')} className={`${input} w-44 px-2`} style={{ borderColor: 'var(--border)' }} />
      </Row>
      <Row label={<>Weight <span className="text-red-400">*</span></>} unit="kg"><input inputMode="decimal" value={f.weight} onChange={set('weight')} className={input} style={{ borderColor: 'var(--border)' }} /></Row>
      <Row label={<>Height <span className="text-red-400">*</span></>} unit="cm"><input inputMode="numeric" value={f.height} onChange={set('height')} className={input} style={{ borderColor: 'var(--border)' }} /></Row>
      <Row label="Body fat" hint="optional — from a smart scale, roughly is fine" unit="%"><input inputMode="decimal" value={f.fat} onChange={set('fat')} className={input} style={{ borderColor: 'var(--border)' }} /></Row>
      <Row label="Average daily steps" hint="optional — roughly, from your phone or watch"><input inputMode="numeric" value={f.steps} onChange={set('steps')} className={input} style={{ borderColor: 'var(--border)' }} /></Row>
      <Row label="FTP" hint="optional — cycling" unit="W"><input inputMode="numeric" value={f.ftp} onChange={set('ftp')} className={input} style={{ borderColor: 'var(--border)' }} /></Row>

      <Segmented label={<>Goal <span className="font-normal text-xs" style={{ color: 'var(--text-muted)' }}>(optional)</span></>}
        options={GOALS} value={f.goal} onChange={v => setF(s => ({ ...s, goal: s.goal === v ? null : v }))} />
      {f.goal && f.goal !== 'maintain' && (
        <Row label="Target weight" unit="kg"><input inputMode="decimal" value={f.target} onChange={set('target')} className={input} style={{ borderColor: 'var(--border)' }} /></Row>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex justify-end gap-3">
        {data.complete && (
          <button type="button" onClick={() => { fill(data.profile); setEditing(false); setError(null) }} className="h-11 px-4 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Cancel</button>
        )}
        <button type="submit" disabled={saving} className="h-11 min-w-28 px-5 rounded-xl font-bold text-sm text-black disabled:opacity-60 flex items-center justify-center" style={{ background: 'var(--primary)' }}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
        </button>
      </div>
    </form>
    <HrZonesCard />
    </div>
  )
}

function Row({ label, hint, unit, children }: { label: React.ReactNode; hint?: string; unit?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <div className="text-sm font-semibold">{label}</div>
        {hint && <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{hint}</div>}
      </div>
      {children}
      <span className="w-6 text-xs" style={{ color: 'var(--text-muted)' }}>{unit}</span>
    </div>
  )
}

function Segmented<T extends string>({ label, options, value, onChange }: { label: React.ReactNode; options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-semibold">{label}</div>
      <div className="grid gap-1 p-1 rounded-xl" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, background: 'var(--surface-2, rgba(255,255,255,0.04))', border: '1px solid var(--border)' }}>
        {options.map(o => (
          <button type="button" key={o.value} onClick={() => onChange(o.value)} className="py-2 text-xs sm:text-sm font-semibold rounded-lg truncate"
            style={{ background: value === o.value ? 'var(--primary)' : 'transparent', color: value === o.value ? '#000' : 'var(--text-muted)' }}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-3 py-2" style={card}>
      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  )
}

// ── Gauge ─────────────────────────────────────────────────────────────────────
const W = 260, CX = 130, CY = 132, R = 108, STROKE = 18
const point = (share: number, r: number) => { const a = Math.PI * (1 - share); return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) } }
const arc = (from: number, to: number, r: number) => { const a = point(from, r), b = point(to, r); return `M ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y}` }

/** Half-circle gauge: white needle = BMR, green needle = estimated total burn; Today / 7-day average. */
export function EnergyGauge({ today, week, todayLabel = 'Today', avgSteps }: { today: EnergyDay; week: EnergyDay; todayLabel?: string; avgSteps?: number | null }) {
  const [mode, setMode] = useState<'today' | 'week'>('today')
  const d = mode === 'today' ? today : week
  const intake = d.intake ?? 0
  const max = Math.max(Math.ceil((d.bmr * 2.2) / 500) * 500, Math.ceil((Math.max(d.total, intake) * 1.1) / 500) * 500)
  const share = (v: number) => Math.min(1, Math.max(0, v / max))
  const needle = (v: number, color: string, len: number, width: number) => {
    const p = point(share(v), len)
    return <line x1={CX} y1={CY} x2={p.x} y2={p.y} stroke={color} strokeWidth={width} strokeLinecap="round" style={{ transition: 'all .6s ease' }} />
  }
  const t1 = point(share(d.bmr), R - STROKE / 2 - 3), t2 = point(share(d.bmr), R + STROKE / 2 + 3)

  return (
    <div className="rounded-2xl border p-4 flex flex-col gap-3" style={{ background: 'rgba(57,255,20,0.06)', borderColor: 'rgba(57,255,20,0.3)' }}>
      <div className="flex items-center gap-2">
        <Flame size={18} style={{ color: '#ffaa00' }} />
        <span className="font-bold">Energy</span>
        <div className="flex-1" />
        <div className="flex p-0.5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {(['today', 'week'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} className="px-3 h-7 text-xs font-bold rounded-lg"
              style={{ background: mode === m ? 'var(--primary)' : 'transparent', color: mode === m ? '#000' : 'var(--text-muted)' }}>
              {m === 'today' ? todayLabel : '7 days'}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex justify-center">
        <svg width={W} height={150} viewBox={`0 0 ${W} 150`} role="img" aria-label={`Burned ${fmt(d.total)} kcal, BMR ${fmt(d.bmr)} kcal`}>
          <defs>
            <linearGradient id="energy-scale" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#3399ff" /><stop offset="0.38" stopColor="#6cff2f" />
              <stop offset="0.68" stopColor="#ffd60a" /><stop offset="0.86" stopColor="#ffaa00" /><stop offset="1" stopColor="#ff3b30" />
            </linearGradient>
          </defs>
          <path d={arc(0, 1, R)} stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE} fill="none" strokeLinecap="round" />
          <path d={arc(0, share(d.total), R)} stroke="url(#energy-scale)" strokeWidth={STROKE} fill="none" strokeLinecap="round" />
          {intake > 0 && <path d={arc(0, 1, R - 26)} stroke="rgba(255,255,255,0.06)" strokeWidth={6} fill="none" strokeLinecap="round" />}
          {intake > 0 && <path d={arc(0, share(intake), R - 26)} stroke="#ff9f43" strokeWidth={6} fill="none" strokeLinecap="round" />}
          <line x1={t1.x} y1={t1.y} x2={t2.x} y2={t2.y} stroke="#fff" strokeWidth={3} strokeLinecap="round" />
          {needle(d.bmr, 'rgba(255,255,255,0.55)', R - 34, 1.5)}
          {needle(d.total, '#6cff2f', R - 16, 2.2)}
          <circle cx={CX} cy={CY} r={5} fill="#12192d" stroke="#6cff2f" strokeWidth={1.5} />
        </svg>
        <div className="absolute bottom-8 text-center pointer-events-none" style={{ textShadow: '0 0 10px #050816, 0 0 4px #050816, 0 0 2px #050816' }}>
          <div className="text-3xl font-black tracking-tight">{fmt(d.total)}</div>
          <div className="text-[11px] -mt-1" style={{ color: 'var(--text-muted)' }}>kcal {mode === 'today' ? 'today' : 'per day'}</div>
        </div>
      </div>

      <div className="flex justify-center gap-5 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-white" /> BMR <b className="text-white">{fmt(d.bmr)}</b></span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: '#6cff2f' }} /> Burned <b className="text-white">{fmt(d.total)}</b></span>
        {intake > 0
          ? <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: '#ff9f43' }} /> Eaten <b className="text-white">{fmt(intake)}</b></span>
          : <span><b style={{ color: '#6cff2f' }}>+{fmt(d.total - d.bmr)}</b> above BMR</span>}
      </div>
      {intake > 0 && (
        <p className="text-sm font-bold text-center" style={{ color: intake > d.total ? '#ff9f43' : '#6cff2f' }}>
          {intake > d.total ? `+${fmt(intake - d.total)} kcal surplus` : `−${fmt(d.total - intake)} kcal deficit`}
          {mode === 'week' && d.logged_days ? ` · avg of ${d.logged_days} logged day${d.logged_days === 1 ? '' : 's'}` : ''}
        </p>
      )}

      <div className="grid grid-cols-2 gap-y-2 gap-x-4 pt-3 text-sm" style={{ borderTop: '1px solid rgba(57,255,20,0.18)' }}>
        <Part icon={<Bed size={14} />} label="Basal" value={d.bmr} />
        <Part icon={<Footprints size={14} />} label={avgSteps ? `Steps (${fmt(avgSteps)}/day)` : 'Steps (not set)'} value={d.steps} />
        <Part icon={<Dumbbell size={14} />} label={mode === 'today' ? `Training${d.trainings === 1 ? '' : 's'} (${d.trainings})` : 'Training'} value={d.training} />
        <Part icon={<UtensilsCrossed size={14} />} label="Digestion" value={d.food} />
      </div>
      {d.estimated && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Some trainings had no calories — estimated from heart rate or duration.</p>}
    </div>
  )
}

function Part({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
      {icon}<span className="flex-1 truncate">{label}</span><b className="text-white">{fmt(value)} <span className="text-[10px] font-semibold" style={{ color: 'var(--text-muted)' }}>kcal</span></b>
    </div>
  )
}
