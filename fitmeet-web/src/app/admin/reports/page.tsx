'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Clock } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

interface Report {
  id: number
  reporter: string | null
  type: string
  reason: string
  details: string | null
  preview: string | null
  created_at: string
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function AdminReportsPage() {
  const { token, user } = useAuthStore()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<number | null>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted) return
    if (!token) { router.replace('/login?redirect=/admin/reports'); return }
    if (user && !user.is_admin) { router.replace('/'); return }

    load()
  }, [mounted, token, user, router])

  function load() {
    setLoading(true)
    api.get('/admin/reports')
      .then(({ data }) => setReports(data.data))
      .finally(() => setLoading(false))
  }

  async function resolve(report: Report, action: 'remove' | 'dismiss') {
    if (action === 'remove' && !confirm('This deletes the reported content and suspends the offending account. Continue?')) {
      return
    }
    setActingId(report.id)
    try {
      await api.post(`/admin/reports/${report.id}/resolve`, { action })
      setReports((prev) => prev.filter((r) => r.id !== report.id))
    } catch {
      alert('Could not resolve this report. Please try again.')
    } finally {
      setActingId(null)
    }
  }

  if (!mounted || loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen flex items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 py-8">
        <div style={{ maxWidth: 720, margin: '0 auto' }}>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(57,255,20,0.12)', border: '1px solid rgba(57,255,20,0.3)' }}>
              <ShieldCheck size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h1 className="text-xl font-bold">Reports</h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Pending user reports — review within 24 hours</p>
            </div>
          </div>

          {reports.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No pending reports. 🎉</p>
          )}

          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id}
                className="rounded-2xl border p-4"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                      style={{ background: 'rgba(57,255,20,0.1)', color: 'var(--primary)' }}>
                      {r.type}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                      style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
                      {r.reason}
                    </span>
                  </div>
                  <p className="text-xs flex-shrink-0 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                    <Clock size={11} /> {timeAgo(r.created_at)}
                  </p>
                </div>

                <p className="text-sm font-semibold mt-3">{r.preview ?? '(no preview)'}</p>
                {r.details && <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{r.details}</p>}
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Reported by {r.reporter ?? 'unknown'}</p>

                <div className="flex items-center gap-3 mt-4">
                  <button
                    onClick={() => resolve(r, 'dismiss')}
                    disabled={actingId === r.id}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                    style={{ background: 'var(--background)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    Dismiss
                  </button>
                  <button
                    onClick={() => resolve(r, 'remove')}
                    disabled={actingId === r.id}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                    style={{ background: '#f87171', color: '#000' }}>
                    Remove & eject
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      </main>
    </>
  )
}
