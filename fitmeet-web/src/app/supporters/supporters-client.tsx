'use client'

import { useState } from 'react'
import { BuySection } from './buy-section'

type Donor = { name: string; product_id: string }

const MEDAL_LABEL: Record<string, string> = {
  beer_small:  '🍺 Small beer',
  beer_medium: '🍺🍺🍺 3 beers',
  beer_large:  '📦📦📦 Full crate',
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
          {MEDAL_LABEL[donor.product_id] ?? donor.product_id}
        </p>
      </div>
    </div>
  )
}

export function SupportersClient({ initialDonors }: { initialDonors: Donor[] }) {
  const [donors, setDonors] = useState<Donor[]>(initialDonors)
  const [purchased, setPurchased] = useState(false)

  function handlePurchased() {
    setPurchased(true)
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'https://api.fitmeet.fit/api'}/beer-donations?limit=200`)
      .then(r => r.json())
      .then(setDonors)
      .catch(() => {})
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="text-5xl mb-4">🍺</div>
        <h1 className="text-3xl font-black mb-2">Beer Wall of Fame</h1>
        <p className="opacity-60 text-sm max-w-xs mx-auto">
          These people keep FitMeet free. Buy a beer and get your name on every screen.
        </p>
      </div>

      {/* Donors list */}
      {donors.length > 0 ? (
        <div className="flex flex-col gap-3 mb-10">
          {donors.map((d, i) => (
            <DonorRow key={i} donor={d} rank={i + 1} />
          ))}
        </div>
      ) : (
        <p className="text-center opacity-40 mb-10">Još nema supportera. Budi prvi! 🍺</p>
      )}

      {/* Divider */}
      <div className="border-t mb-8" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      {/* Buy section */}
      {purchased ? (
        <div className="text-center py-8">
          <p className="text-3xl mb-3">🙏</p>
          <p className="font-bold text-xl mb-1">Hvala ti!</p>
          <p className="opacity-60 text-sm">Tvoje ime se uskoro pojavljuje na svakom screenu.</p>
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
