'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { ShareButton } from '@/components/share-button'
import { useAuthStore } from '@/store/auth'
import api from '@/lib/api'

interface AlibiStats {
  events_created: number
  events_joined:  number
  check_ins:      number
  comments:       number
  moments:        number
  beers:          number
}

const ROWS: { key: keyof AlibiStats; label: string; emoji: string; color: string; desc: string }[] = [
  { key: 'events_created', label: 'Events created', emoji: '🗓',  color: '#39ff14', desc: 'Times you made something happen' },
  { key: 'events_joined',  label: 'Events joined',  emoji: '🏃',  color: '#00a8ff', desc: 'Times you showed up for someone else\'s event' },
  { key: 'check_ins',      label: 'Check-ins',      emoji: '✅',  color: '#fbbf24', desc: 'Times you actually arrived, not just confirmed' },
  { key: 'comments',       label: 'Comments',        emoji: '💬',  color: '#a78bfa', desc: 'Things said in the group wall' },
  { key: 'moments',        label: 'Moments posted',  emoji: '📸',  color: '#fb923c', desc: 'Event photos you uploaded as organizer' },
  { key: 'beers',          label: 'Beers bought',   emoji: '🍺',  color: '#f59e0b', desc: 'Times you supported FitMeet with a cold one' },
]

export default function AlibiPage() {
  const { token, user } = useAuthStore()
  const router = useRouter()
  const [stats,   setStats]   = useState<AlibiStats | null>(null)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    if (!token) { router.replace('/login'); return }
    api.get('/me/stats').then(({ data }) => {
      setStats(data)
      requestAnimationFrame(() => setTimeout(() => setAnimate(true), 80))
    }).catch(() => {})
  }, [token, router])

  const maxVal = stats ? Math.max(1, ...Object.values(stats)) : 1
  const total  = stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 0

  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10">

        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-sm mb-8 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={14} /> Back to Profile
        </Link>

        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-4xl">🕵️</span>
              <h1 className="text-3xl font-bold">Your Alibi</h1>
            </div>
            <p style={{ color: 'var(--text-muted)' }}>
              {user?.name ? `${user.name}'s` : 'Your'} proof of activity on FitMeet.
            </p>
          </div>
          <ShareButton
            title="My FitMeet Alibi"
            text={`I've joined ${stats?.events_joined ?? 0} events and checked in ${stats?.check_ins ?? 0} times on FitMeet. Here's my alibi 👇`}
            url="https://fitmeet.fit/alibi"
          />
        </div>

        {/* Total badge */}
        <div
          className="rounded-2xl border p-5 mb-6 flex items-center justify-between"
          style={{ background: 'var(--surface)', borderColor: 'rgba(57,255,20,0.2)' }}
        >
          <div>
            <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-muted)' }}>Total activity score</p>
            <p className="text-4xl font-black" style={{ color: 'var(--primary)' }}>{total}</p>
          </div>
          <div className="text-right">
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Verdict</p>
            <p className="text-sm font-bold">
              {total === 0 ? '😴 Still warming up'
                : total < 10 ? '🚶 Getting started'
                : total < 30 ? '🏃 Picking up pace'
                : total < 60 ? '💪 Solid presence'
                : total < 100 ? '🔥 Highly active'
                : '⚡ Local legend'}
            </p>
          </div>
        </div>

        {/* Bars */}
        <div
          className="rounded-2xl border p-5 sm:p-7 space-y-6"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {ROWS.map(({ key, label, emoji, color, desc }) => {
            const val = stats?.[key] ?? 0
            const pct = (val / maxVal) * 100
            return (
              <div key={key}>
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div>
                    <p className="font-semibold flex items-center gap-2">
                      <span>{emoji}</span> {label}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                  </div>
                  <span className="text-2xl font-black tabular-nums shrink-0" style={{ color }}>{val}</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: animate ? `${Math.max(pct, val > 0 ? 4 : 0)}%` : '0%',
                      backgroundColor: color,
                      transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                      boxShadow: `0 0 8px ${color}55`,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-center text-xs mt-8" style={{ color: 'var(--text-muted)' }}>
          All-time stats · updated in real time
        </p>
      </main>
    </>
  )
}
