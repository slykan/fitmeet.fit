'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, Loader2 } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

function CheckInContent() {
  const params = useSearchParams()
  const router = useRouter()
  const token = useAuthStore((state) => state.token)
  const hasHydrated = useAuthStore((state) => state.hasHydrated)
  const id = params.get('id')
  const [message, setMessage] = useState('Opening check-in...')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!hasHydrated || !id) return

    if (!token) {
      router.replace(`/login?redirect=${encodeURIComponent(`/events/check-in?id=${id}`)}`)
      return
    }

    api.post(`/events/${id}/check-in`)
      .then(() => {
        setDone(true)
        setMessage('Checked in.')
        window.setTimeout(() => router.replace(`/events/view?id=${id}`), 900)
      })
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        setMessage(msg ?? 'Open the event to check in.')
        window.setTimeout(() => router.replace(`/events/view?id=${id}`), 1200)
      })
  }, [hasHydrated, id, router, token])

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar />
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: done ? 'rgba(57,255,20,0.12)' : 'rgba(255,255,255,0.06)' }}
        >
          {done ? <CheckCircle2 size={28} color="var(--primary)" /> : <Loader2 size={26} className="animate-spin" />}
        </div>
        <h1 className="mb-2 text-xl font-black">Event check-in</h1>
        <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>{message}</p>
        {id && (
          <Link href={`/events/view?id=${id}`}>
            <Button variant="ghost">Open event</Button>
          </Link>
        )}
      </div>
    </main>
  )
}

export default function EventCheckInPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <Navbar />
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 text-center">
          <Loader2 size={26} className="animate-spin" />
        </div>
      </main>
    }>
      <CheckInContent />
    </Suspense>
  )
}
