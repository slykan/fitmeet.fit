'use client'

import { useState } from 'react'
import { ArrowUp, CheckCircle2, Lightbulb, Loader2, Sparkles } from 'lucide-react'

import api from '@/lib/api'

// AI coach — training analysis or weekly/monthly report. Owner only; results are
// stored server-side, so reopening costs nothing.

export interface CoachNote {
  headline: string
  summary: string
  tip?: string | null
  plan?: string[]
  questions: string[]
  answers: { question: string; answer: string }[]
  stale?: boolean
}

export interface CoachQuota { analyses_left: number; questions_left: number }

// The coach answers in the browser's language (e.g. "hr-HR" → Croatian).
function browserLanguage(): string {
  return (typeof navigator !== 'undefined' && navigator.language) || 'en'
}

export function CoachPanel({ note, quota, writeUrl, askUrl, onData, extract, intro, cta, nextLabel, askPlaceholder }: {
  note: CoachNote | null
  quota: CoachQuota
  writeUrl: string
  askUrl: string
  /** Receives the full response after a write/ask. */
  onData: (data: unknown) => void
  /** Pulls the error message out of a failed request. */
  extract?: (e: unknown) => string | undefined
  intro: string
  cta: string
  nextLabel?: string
  askPlaceholder: string
}) {
  const [busy, setBusy] = useState<'write' | 'ask' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [question, setQuestion] = useState('')

  async function run(kind: 'write' | 'ask', q?: string) {
    setBusy(kind)
    setError(null)
    try {
      const { data } = kind === 'write'
        ? await api.post(writeUrl, { language: browserLanguage() })
        : await api.post(askUrl, { question: q, language: browserLanguage() })
      onData(data)
      if (kind === 'ask') setQuestion('')
    } catch (e: unknown) {
      setError(extract?.(e) ?? (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'The coach is not reachable right now.')
    } finally {
      setBusy(null)
    }
  }

  const asked = new Set(note?.answers.map(a => a.question.toLowerCase()) ?? [])
  const open = note?.questions.filter(q => !asked.has(q.toLowerCase())) ?? []

  return (
    <div className="rounded-2xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'color-mix(in srgb, var(--primary) 35%, transparent)' }}>
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary)' }}>
          <Sparkles size={15} color="#041109" />
        </span>
        <h2 className="font-bold">Coach</h2>
      </div>

      {!note ? (
        <>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{intro}</p>
          <button
            onClick={() => run('write')}
            disabled={!!busy || quota.analyses_left <= 0}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ background: 'var(--primary)', color: '#041109' }}
          >
            {busy === 'write' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={15} />}
            {quota.analyses_left > 0 ? cta : 'No analyses left this month'}
          </button>
        </>
      ) : (
        <>
          <p className="text-base font-bold leading-snug">{note.headline}</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{note.summary}</p>
          {note.tip && (
            <div className="flex gap-2 p-3 rounded-xl text-sm" style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)' }}>
              <Lightbulb size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
              <span>{note.tip}</span>
            </div>
          )}
          {!!note.plan?.length && (
            <div className="p-3 rounded-xl space-y-2" style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)' }}>
              <p className="text-xs font-bold" style={{ color: 'var(--primary)' }}>{nextLabel}</p>
              {note.plan.map(p => (
                <div key={p} className="flex gap-2 text-sm"><CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} /><span>{p}</span></div>
              ))}
            </div>
          )}
          {note.answers.map(a => (
            <div key={a.question} className="pt-3 border-t space-y-1" style={{ borderColor: 'var(--border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>{a.question}</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{a.answer}</p>
            </div>
          ))}
          {open.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {open.map(q => (
                <button key={q} onClick={() => run('ask', q)} disabled={!!busy || quota.questions_left <= 0}
                  className="text-sm text-left px-3 py-2 rounded-xl border transition-opacity hover:opacity-80 disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
                  {q}
                </button>
              ))}
            </div>
          )}
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (question.trim()) run('ask', question.trim()) }}>
            <input value={question} onChange={e => setQuestion(e.target.value)} maxLength={300}
              disabled={!!busy || quota.questions_left <= 0} placeholder={askPlaceholder}
              className="flex-1 text-sm px-3 py-2.5 rounded-xl border outline-none"
              style={{ borderColor: 'var(--border)', background: 'var(--background)', color: 'var(--text-primary)' }} />
            <button type="submit" disabled={!question.trim() || !!busy}
              className="w-11 rounded-xl flex items-center justify-center disabled:opacity-50" style={{ background: 'var(--primary)' }}>
              {busy === 'ask' ? <Loader2 size={16} className="animate-spin" color="#041109" /> : <ArrowUp size={18} color="#041109" />}
            </button>
          </form>
          {note.stale && (
            <button onClick={() => run('write')} disabled={!!busy || quota.analyses_left <= 0}
              className="w-full text-sm font-semibold py-2.5 rounded-xl border disabled:opacity-50"
              style={{ borderColor: 'color-mix(in srgb, var(--primary) 45%, transparent)', color: 'var(--primary)' }}>
              {busy === 'write' ? 'Writing…' : 'New trainings since — refresh the report'}
            </button>
          )}
        </>
      )}
      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
        {quota.analyses_left} analyses · {quota.questions_left} questions left this month · Not medical advice
      </p>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
