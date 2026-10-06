'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

// Renewed consent: when the Terms of Service / Privacy Policy change (User::TERMS_VERSION
// on the API), a signed-in user must accept them again before using FitMeet. Declining
// signs the user out — access is denied without consent (Huawei privacy checklist).
export function TermsConsentGate() {
  const { token, setUser, logout } = useAuthStore()
  const router = useRouter()
  const [needed, setNeeded] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) { setNeeded(false); return }
    api.get('/me')
      .then(({ data }) => {
        if (data?.data) setUser(data.data)
        setNeeded(Boolean(data?.data?.needs_terms_consent))
      })
      .catch(() => {})
  }, [token, setUser])

  if (!needed) return null

  async function accept() {
    setBusy(true)
    try {
      const { data } = await api.post('/me/accept-terms')
      if (data?.data) setUser(data.data)
      setNeeded(false)
    } finally {
      setBusy(false)
    }
  }

  function decline() {
    logout()
    setNeeded(false)
    router.replace('/')
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-md rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h2 className="text-lg font-bold mb-2">We&apos;ve updated our terms</h2>
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          Our <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--primary)' }}>Terms of Service</a> and{' '}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--primary)' }}>Privacy Policy</a>{' '}
          have changed — including how we handle data from connected apps such as HUAWEI Health and Strava,
          where your data is stored, how long we keep it, and how you can export or delete it.
        </p>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
          Please review and accept them to continue using FitMeet.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={accept} disabled={busy}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--primary)', color: '#000' }}>
            {busy ? 'Saving…' : 'I accept'}
          </button>
          <button onClick={decline} disabled={busy}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            Decline and sign out
          </button>
        </div>
      </div>
    </div>
  )
}
