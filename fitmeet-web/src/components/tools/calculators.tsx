'use client'

import { useMemo, useState } from 'react'

// Client-side calculators for /tools. Nothing is sent anywhere — all maths runs in the browser.

const box = { background: 'var(--surface)', borderColor: 'var(--border)' }
const inputCls = 'w-full h-11 rounded-xl border px-3 bg-transparent outline-none focus:border-[var(--primary)] font-semibold'
const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold">{label}{hint && <span className="font-normal text-xs ml-1" style={{ color: 'var(--text-muted)' }}>{hint}</span>}</span>
      {children}
    </label>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1 p-1 rounded-xl border" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))`, borderColor: 'var(--border)' }}>
      {options.map(o => (
        <button type="button" key={o.value} onClick={() => onChange(o.value)} className="py-2 rounded-lg text-sm font-semibold"
          style={{ background: value === o.value ? 'var(--primary)' : 'transparent', color: value === o.value ? '#000' : 'var(--text-muted)' }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : 0 }

// ── BMR / TDEE ────────────────────────────────────────────────────────────────
const ACTIVITY = [
  { value: '1.2', label: 'Sedentary — desk job, little exercise' },
  { value: '1.375', label: 'Light — exercise 1–3 days a week' },
  { value: '1.55', label: 'Moderate — exercise 3–5 days a week' },
  { value: '1.725', label: 'Very active — hard exercise 6–7 days a week' },
  { value: '1.9', label: 'Extremely active — physical job plus training' },
]

export function BmrCalculator() {
  const [sex, setSex] = useState<'male' | 'female'>('male')
  const [age, setAge] = useState('35')
  const [weight, setWeight] = useState('75')
  const [height, setHeight] = useState('178')
  const [fat, setFat] = useState('')
  const [activity, setActivity] = useState('1.55')

  const r = useMemo(() => {
    const a = num(age), w = num(weight), h = num(height), f = num(fat)
    if (!a || !w || !h) return null
    const mifflin = 10 * w + 6.25 * h - 5 * a + (sex === 'male' ? 5 : -161)
    const katch = f > 3 && f < 70 ? 370 + 21.6 * w * (1 - f / 100) : null
    const bmr = katch ?? mifflin
    const tdee = bmr * parseFloat(activity)
    return { mifflin, katch, bmr, tdee }
  }, [sex, age, weight, height, fat, activity])

  return (
    <div className="rounded-2xl border p-5 md:p-6 grid gap-5 md:grid-cols-2" style={box}>
      <div className="flex flex-col gap-4">
        <Segmented value={sex} onChange={setSex} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Age"><input inputMode="numeric" value={age} onChange={e => setAge(e.target.value)} className={inputCls} style={{ borderColor: 'var(--border)' }} /></Field>
          <Field label="Weight" hint="kg"><input inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} className={inputCls} style={{ borderColor: 'var(--border)' }} /></Field>
          <Field label="Height" hint="cm"><input inputMode="numeric" value={height} onChange={e => setHeight(e.target.value)} className={inputCls} style={{ borderColor: 'var(--border)' }} /></Field>
        </div>
        <Field label="Body fat" hint="% — optional, uses Katch-McArdle"><input inputMode="decimal" value={fat} onChange={e => setFat(e.target.value)} placeholder="e.g. 18" className={inputCls} style={{ borderColor: 'var(--border)' }} /></Field>
        <Field label="Activity level">
          <select value={activity} onChange={e => setActivity(e.target.value)} className={inputCls} style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            {ACTIVITY.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </div>
      <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.25)' }}>
        {r ? (
          <>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Basal metabolic rate</p>
              <p className="text-4xl font-black">{fmt(r.bmr)} <span className="text-base font-semibold" style={{ color: 'var(--text-muted)' }}>kcal/day</span></p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{r.katch ? `Katch-McArdle (Mifflin-St Jeor would give ${fmt(r.mifflin)})` : 'Mifflin-St Jeor'}</p>
            </div>
            <div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Estimated daily burn (TDEE)</p>
              <p className="text-3xl font-black" style={{ color: 'var(--primary)' }}>{fmt(r.tdee)} <span className="text-base font-semibold" style={{ color: 'var(--text-muted)' }}>kcal/day</span></p>
            </div>
            <div className="text-sm grid gap-1" style={{ color: 'var(--text-muted)' }}>
              <p>Gentle fat loss (−400): <b className="text-white">{fmt(r.tdee - 400)} kcal</b></p>
              <p>Maintain: <b className="text-white">{fmt(r.tdee)} kcal</b></p>
              <p>Lean gain (+250): <b className="text-white">{fmt(r.tdee + 250)} kcal</b></p>
            </div>
          </>
        ) : <p style={{ color: 'var(--text-muted)' }}>Enter age, weight and height.</p>}
      </div>
    </div>
  )
}

// ── Heart rate zones ──────────────────────────────────────────────────────────
const ZONES = [
  { name: 'Zone 1 · Recovery', lo: 0.5, hi: 0.6, color: '#8f9bbd' },
  { name: 'Zone 2 · Endurance', lo: 0.6, hi: 0.7, color: '#3399ff' },
  { name: 'Zone 3 · Tempo', lo: 0.7, hi: 0.8, color: '#6cff2f' },
  { name: 'Zone 4 · Threshold', lo: 0.8, hi: 0.9, color: '#ffaa00' },
  { name: 'Zone 5 · Maximum', lo: 0.9, hi: 1.0, color: '#ff3b30' },
]

export function HrZoneCalculator() {
  const [age, setAge] = useState('35')
  const [max, setMax] = useState('')
  const [rest, setRest] = useState('')
  const [method, setMethod] = useState<'max' | 'hrr'>('max')

  const a = num(age), m = num(max), r0 = num(rest)
  const est = a ? Math.round(208 - 0.7 * a) : 0
  const hrMax = m >= 120 && m <= 230 ? m : est
  const useHrr = method === 'hrr' && r0 >= 30 && r0 < hrMax
  const bpm = (share: number) => Math.round(useHrr ? r0 + share * (hrMax - r0) : hrMax * share)

  return (
    <div className="rounded-2xl border p-5 md:p-6 grid gap-5 md:grid-cols-2" style={box}>
      <div className="flex flex-col gap-4">
        <Segmented value={method} onChange={setMethod} options={[{ value: 'max', label: '% of max HR' }, { value: 'hrr', label: 'Heart rate reserve' }]} />
        <Field label="Age" hint="used only if you don't know your max"><input inputMode="numeric" value={age} onChange={e => setAge(e.target.value)} className={inputCls} style={{ borderColor: 'var(--border)' }} /></Field>
        <Field label="Max heart rate" hint="bpm — optional, best from a hard effort"><input inputMode="numeric" value={max} onChange={e => setMax(e.target.value)} placeholder={est ? `estimate: ${est}` : ''} className={inputCls} style={{ borderColor: 'var(--border)' }} /></Field>
        {method === 'hrr' && (
          <Field label="Resting heart rate" hint="bpm — morning, lying down"><input inputMode="numeric" value={rest} onChange={e => setRest(e.target.value)} placeholder="e.g. 55" className={inputCls} style={{ borderColor: 'var(--border)' }} /></Field>
        )}
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {m >= 120 ? `Using your max HR of ${hrMax} bpm.` : est ? `Estimated max HR (208 − 0.7 × age): ${est} bpm. Enter your real max for better zones.` : ''}
          {method === 'hrr' && !useHrr ? ' Enter a resting HR below your max to use heart rate reserve.' : ''}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {hrMax ? ZONES.map(z => (
          <div key={z.name} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
            <span className="w-3 h-3 rounded-full" style={{ background: z.color }} />
            <span className="flex-1 text-sm font-semibold">{z.name}</span>
            <span className="text-sm font-bold">{bpm(z.lo)}–{z.hi === 1 ? hrMax : bpm(z.hi) - 1} bpm</span>
          </div>
        )) : <p style={{ color: 'var(--text-muted)' }}>Enter your age or max heart rate.</p>}
      </div>
    </div>
  )
}

// ── Pace ──────────────────────────────────────────────────────────────────────
const RACES = [
  { label: '5 km', km: 5 },
  { label: '10 km', km: 10 },
  { label: 'Half marathon', km: 21.0975 },
  { label: 'Marathon', km: 42.195 },
]
const hms = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}
const parseTime = (t: string) => {
  const p = t.trim().split(':').map(x => parseFloat(x))
  if (p.some(x => !Number.isFinite(x))) return 0
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 60
}

export function PaceCalculator() {
  const [dist, setDist] = useState('10')
  const [time, setTime] = useState('52:30')
  const km = num(dist), sec = parseTime(time)
  const ok = km > 0 && sec > 0
  const pace = ok ? sec / km : 0

  return (
    <div className="rounded-2xl border p-5 md:p-6 grid gap-5 md:grid-cols-2" style={box}>
      <div className="flex flex-col gap-4">
        <Field label="Distance" hint="km">
          <input inputMode="decimal" value={dist} onChange={e => setDist(e.target.value)} className={inputCls} style={{ borderColor: 'var(--border)' }} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {RACES.map(r => (
            <button key={r.label} type="button" onClick={() => setDist(String(r.km))} className="px-3 h-8 rounded-full text-xs font-semibold border" style={{ borderColor: 'var(--border)' }}>{r.label}</button>
          ))}
        </div>
        <Field label="Time" hint="h:mm:ss or mm:ss">
          <input value={time} onChange={e => setTime(e.target.value)} placeholder="52:30" className={inputCls} style={{ borderColor: 'var(--border)' }} />
        </Field>
      </div>
      <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: 'rgba(57,255,20,0.06)', border: '1px solid rgba(57,255,20,0.25)' }}>
        {ok ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Pace</p><p className="text-3xl font-black">{hms(pace)}<span className="text-base font-semibold" style={{ color: 'var(--text-muted)' }}> /km</span></p></div>
              <div><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Speed</p><p className="text-3xl font-black">{(km / (sec / 3600)).toFixed(1)}<span className="text-base font-semibold" style={{ color: 'var(--text-muted)' }}> km/h</span></p></div>
            </div>
            <div>
              <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>Predicted race times (Riegel)</p>
              <div className="grid gap-1 text-sm">
                {RACES.map(r => (
                  <p key={r.label} className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>{r.label}</span><b>{hms(sec * Math.pow(r.km / km, 1.06))}</b></p>
                ))}
              </div>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Easy runs: about {hms(pace * 1.15)}–{hms(pace * 1.25)} /km if this is a recent 10 km race.</p>
          </>
        ) : <p style={{ color: 'var(--text-muted)' }}>Enter a distance and a time.</p>}
      </div>
    </div>
  )
}
