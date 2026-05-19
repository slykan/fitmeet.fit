'use client'

import { Share2, Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BuySection } from './buy-section'

function ShareButton() {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = 'https://fitmeet.fit/supporters'
    const text = 'FitMeet stays free thanks to these people 🍺 Join the Wall of Fame — buy a beer, appear on every screen!'

    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: 'Beer Wall of Fame — FitMeet', text, url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-sm transition-opacity hover:opacity-80"
      style={{ borderColor: 'rgba(246,198,91,0.25)', background: 'rgba(246,198,91,0.07)', color: '#f6c65b' }}
    >
      {copied ? <Check size={15} /> : <Share2 size={15} />}
      {copied ? 'Copied!' : 'Share'}
    </button>
  )
}

type Donor = { name: string; beer_score: number; beer_top_tier: string; last_donation_at: string }

const MEDAL_LABEL: Record<string, string> = {
  beer_small:  '🍺 Small beer',
  beer_medium: '🍺🍺🍺 3 beers',
  beer_large:  '📦📦📦 Full crate',
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

function isRecent(d: Donor) {
  return Date.now() - new Date(d.last_donation_at).getTime() < THIRTY_DAYS_MS
}

function splitDonors(all: Donor[]) {
  const recent = all.filter(isRecent).slice(0, 5)
  const older  = all.filter(d => !isRecent(d)).slice(0, 5)
  return { recent, older }
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-3xl">🏆</span>
  if (rank === 2) return <span className="text-3xl">🥈</span>
  if (rank === 3) return <span className="text-3xl">🥉</span>
  return (
    <span
      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
      style={{ background: 'rgba(246,198,91,0.1)', color: '#f6c65b' }}
    >
      {rank}
    </span>
  )
}

function DonorRow({ donor, rank }: { donor: Donor; rank: number }) {
  return (
    <div
      className="flex items-center gap-4 px-5 py-4 rounded-2xl border"
      style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}
    >
      <RankBadge rank={rank} />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-base truncate">{donor.name}</p>
        <p className="text-sm" style={{ color: 'rgba(246,198,91,0.7)' }}>
          {MEDAL_LABEL[donor.beer_top_tier] ?? donor.beer_top_tier} · ×{donor.beer_score}
        </p>
      </div>
    </div>
  )
}

function OlderDonorRow({ donor }: { donor: Donor }) {
  const daysAgo = Math.floor((Date.now() - new Date(donor.last_donation_at).getTime()) / (24 * 60 * 60 * 1000))
  return (
    <div
      className="flex items-center gap-4 px-5 py-3 rounded-2xl border"
      style={{ background: 'rgba(255,255,255,0.015)', borderColor: 'rgba(255,255,255,0.05)', opacity: 0.55 }}
    >
      <span className="text-xl shrink-0">🍺</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{donor.name}</p>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{daysAgo}d ago · ×{donor.beer_score}</p>
      </div>
    </div>
  )
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.fitmeet.fit/api'

function fetchDonors() {
  return fetch(`${API_URL}/beer-donations?limit=200`).then(r => r.json())
}

export function SupportersClient({ initialDonors }: { initialDonors: Donor[] }) {
  const [donors, setDonors] = useState<Donor[]>(initialDonors)
  const [purchased, setPurchased] = useState(false)

  useEffect(() => {
    fetchDonors().then(setDonors).catch(() => {})
  }, [])

  function handlePurchased() {
    setPurchased(true)
    fetchDonors().then(setDonors).catch(() => {})
  }

  const { recent, older } = splitDonors(donors)

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="text-5xl mb-4">🍺</div>
        <h1 className="text-3xl font-black mb-2">Beer Wall of Fame</h1>
        <p className="opacity-60 text-sm max-w-xs mx-auto mb-4">
          These people keep FitMeet free. Buy a beer and get your name on every screen.
        </p>
        <div className="flex justify-center">
          <ShareButton />
        </div>
      </div>

      {/* Recent donors — last 30 days */}
      {recent.length > 0 ? (
        <>
          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'rgba(246,198,91,0.55)' }}>
            🔥 Last 30 days
          </p>
          <div className="flex flex-col gap-3 mb-10">
            {recent.map((d, i) => (
              <DonorRow key={i} donor={d} rank={i + 1} />
            ))}
          </div>
        </>
      ) : (
        <p className="text-center opacity-40 mb-10">No supporters this month. Be the first! 🍺</p>
      )}

      {/* Older donors */}
      {older.length > 0 && (
        <>
          <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Past supporters
          </p>
          <div className="flex flex-col gap-2 mb-10">
            {older.map((d, i) => (
              <OlderDonorRow key={i} donor={d} />
            ))}
          </div>
        </>
      )}

      {/* Divider */}
      <div className="border-t mb-8" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      {/* Buy section */}
      {purchased ? (
        <div className="text-center py-8">
          <p className="text-3xl mb-3">🙏</p>
          <p className="font-bold text-xl mb-1">Thank you!</p>
          <p className="opacity-60 text-sm">Your name will appear on every screen shortly.</p>
        </div>
      ) : (
        <>
          <h2 className="font-black text-xl mb-4 text-center">Join the Wall of Fame</h2>
          <BuySection onPurchased={handlePurchased} />
        </>
      )}
    </div>
  )
}
