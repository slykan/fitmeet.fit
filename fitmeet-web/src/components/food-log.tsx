'use client'

import { useState } from 'react'
import { Loader2, Plus, RotateCcw, UtensilsCrossed, X } from 'lucide-react'

import api from '@/lib/api'

// Health › Food for one day: meals and drinks, "+ Meal" (text → AI estimate → check → save),
// quick drink buttons and "repeat" of recent meals (no AI, free). Every change returns the
// whole Health payload, passed up via onChange.

export interface MealItem { name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }
export interface Meal {
  id: number; kind: 'meal' | 'drink'; description: string; items: MealItem[]; kcal: number
  protein_g: number; carbs_g: number; fat_g: number; volume_ml: number | null; source: string; time: string
}
export type MealTemplate = Omit<Meal, 'id' | 'source' | 'time'>
export interface QuickDrink { key: string; label: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; volume_ml: number }
interface Estimate { items: MealItem[]; kind: 'meal' | 'drink'; volume_ml: number; note: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; estimates_left: number }

const browserLanguage = () => (typeof navigator !== 'undefined' && navigator.language?.split('-')[0]) || 'en'
const macros = (p: number, c: number, f: number) => `P ${Math.round(p)} g · C ${Math.round(c)} g · F ${Math.round(f)} g`
const errMsg = (e: unknown, fallback: string) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
const scaled = (e: Estimate, total: number) => {
  const k = e.kcal > 0 ? total / e.kcal : 1
  return { protein_g: Math.round(e.protein_g * k * 10) / 10, carbs_g: Math.round(e.carbs_g * k * 10) / 10, fat_g: Math.round(e.fat_g * k * 10) / 10 }
}

export function FoodLog<T>({ date, meals, recent, quickDrinks, estimatesLeft, onChange }: {
  date: string; meals: Meal[]; recent: MealTemplate[]; quickDrinks: QuickDrink[]; estimatesLeft: number; onChange: (payload: T) => void
}) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [kcal, setKcal] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const eaten = meals.reduce((s, m) => s + m.kcal, 0)
  const fluids = meals.reduce((s, m) => s + (m.volume_ml ?? 0), 0)
  const reset = () => { setAdding(false); setText(''); setEstimate(null); setKcal(''); setError(null) }

  async function post(body: Record<string, unknown>, key: string) {
    setBusy(key)
    setError(null)
    try {
      const { data } = await api.post<T>('/meals', { date, ...body })
      onChange(data)
      return true
    } catch (e) {
      setError(errMsg(e, 'Could not save. Try again.'))
      return false
    } finally {
      setBusy(null)
    }
  }

  async function runEstimate() {
    if (text.trim().length < 2) return
    setBusy('estimate')
    setError(null)
    try {
      const { data } = await api.post<Estimate>('/meals/estimate', { description: text.trim(), language: browserLanguage() })
      if (!data.items.length) { setError('That doesn\'t look like food or a drink — try describing it differently.'); return }
      setEstimate(data)
      setKcal(String(data.kcal))
    } catch (e) {
      setError(errMsg(e, 'Could not estimate right now. You can enter the calories by hand.'))
    } finally {
      setBusy(null)
    }
  }

  async function saveMeal() {
    const total = parseInt(kcal, 10)
    if (!text.trim() || !Number.isFinite(total)) return setError('Describe the meal and enter calories.')
    const ok = await post({
      description: text.trim(), kind: estimate?.kind ?? 'meal', source: estimate ? 'ai' : 'manual', kcal: total,
      ...(estimate ? scaled(estimate, total) : { protein_g: 0, carbs_g: 0, fat_g: 0 }),
      volume_ml: estimate?.volume_ml || null, items: estimate?.items ?? null,
    }, 'save')
    if (ok) reset()
  }

  async function remove(m: Meal) {
    if (!confirm(`Remove "${m.description}"?`)) return
    setBusy(`del${m.id}`)
    try { const { data } = await api.delete<T>(`/meals/${m.id}`); onChange(data) } catch {}
    finally { setBusy(null) }
  }

  const chip = 'shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold border disabled:opacity-50'
  const chipStyle = { background: 'var(--surface)', borderColor: 'var(--border)' }

  return (
    <div className="rounded-2xl border p-4 flex flex-col gap-3" style={{ background: 'var(--surface)', borderColor: 'rgba(255,159,67,0.35)' }}>
      <div className="flex items-center gap-2">
        <UtensilsCrossed size={17} style={{ color: '#ff9f43' }} />
        <span className="font-bold">Food</span>
        <div className="flex-1" />
        {eaten > 0 && <span className="text-sm font-bold" style={{ color: '#ff9f43' }}>{eaten} kcal</span>}
      </div>

      {meals.length > 0 && (
        <div>
          {meals.map(m => (
            <div key={m.id} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="w-10 text-[11px]" style={{ color: 'var(--text-muted)' }}>{m.time}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{m.description}</div>
                {m.kcal > 0 && <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{macros(m.protein_g, m.carbs_g, m.fat_g)}</div>}
              </div>
              <span className="text-sm font-bold">{m.kcal}</span>
              <button onClick={() => remove(m)} disabled={busy === `del${m.id}`} aria-label="Remove" style={{ color: 'var(--text-muted)' }}><X size={15} /></button>
            </div>
          ))}
          <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
            {macros(meals.reduce((s, m) => s + m.protein_g, 0), meals.reduce((s, m) => s + m.carbs_g, 0), meals.reduce((s, m) => s + m.fat_g, 0))}
            {fluids > 0 ? ` · fluids ${(fluids / 1000).toFixed(1)} l` : ''}
          </p>
        </div>
      )}

      {!adding ? (
        <button onClick={() => setAdding(true)} className="flex items-center justify-center gap-1 h-10 rounded-xl font-bold text-sm text-black" style={{ background: 'var(--primary)' }}>
          <Plus size={17} /> Meal
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); if (estimate) { setEstimate(null); setKcal('') } }}
            placeholder="What did you eat or drink? e.g. 2 eggs, toast with butter, coffee with milk"
            maxLength={500}
            rows={3}
            autoFocus
            className="w-full rounded-xl border p-3 text-sm bg-transparent outline-none focus:border-[var(--primary)]"
            style={{ borderColor: 'var(--border)' }}
          />
          {estimate && (
            <div className="rounded-xl p-3 flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
              {estimate.items.map((it, i) => (
                <div key={i} className="flex gap-2 text-xs"><span className="flex-1" style={{ color: 'var(--text-muted)' }}>{it.name}</span><b>{it.kcal}</b></div>
              ))}
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{macros(estimate.protein_g, estimate.carbs_g, estimate.fat_g)}</div>
              {estimate.note && <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{estimate.note}</div>}
            </div>
          )}
          {(estimate || kcal !== '') && (
            <div className="flex items-center justify-end gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              Total <input inputMode="numeric" value={kcal} onChange={e => setKcal(e.target.value)} className="w-24 h-10 rounded-lg border text-center font-bold bg-transparent text-white" style={{ borderColor: 'var(--border)' }} /> kcal
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end items-center gap-3">
            <button onClick={reset} className="h-10 px-3 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>Cancel</button>
            {!estimate && kcal === '' && <button onClick={() => setKcal('0')} className="h-10 px-2 text-sm font-semibold" style={{ color: 'var(--primary)' }}>Enter kcal</button>}
            {!estimate && kcal === '' ? (
              <button onClick={runEstimate} disabled={!!busy || text.trim().length < 2 || estimatesLeft <= 0}
                className="h-10 min-w-24 px-4 rounded-xl font-bold text-sm text-black disabled:opacity-50 flex items-center justify-center" style={{ background: 'var(--primary)' }}>
                {busy === 'estimate' ? <Loader2 size={16} className="animate-spin" /> : 'Estimate'}
              </button>
            ) : (
              <button onClick={saveMeal} disabled={!!busy}
                className="h-10 min-w-24 px-4 rounded-xl font-bold text-sm text-black disabled:opacity-50 flex items-center justify-center" style={{ background: 'var(--primary)' }}>
                {busy === 'save' ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
              </button>
            )}
          </div>
          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{estimatesLeft} AI estimates left this month · repeat and quick drinks are free</p>
        </div>
      )}

      <div className="text-[11px] font-bold uppercase tracking-wider mt-1" style={{ color: 'var(--text-muted)' }}>Quick drinks</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {quickDrinks.map(q => (
          <button key={q.key} className={chip} style={chipStyle} disabled={!!busy}
            onClick={() => post({ description: q.label, kind: 'drink', source: 'quick', kcal: q.kcal, protein_g: q.protein_g, carbs_g: q.carbs_g, fat_g: q.fat_g, volume_ml: q.volume_ml }, q.key)}>
            {q.label} <span style={{ color: '#ff9f43' }}>{q.kcal}</span>
          </button>
        ))}
      </div>

      {recent.length > 0 && (
        <>
          <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Repeat</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recent.map((r, i) => (
              <button key={i} className={`${chip} max-w-60`} style={chipStyle} disabled={!!busy} onClick={() => post({ ...r, source: 'repeat' }, `r${i}`)}>
                <RotateCcw size={12} style={{ color: 'var(--primary)' }} />
                <span className="truncate">{r.description}</span>
                <span style={{ color: '#ff9f43' }}>{r.kcal}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
