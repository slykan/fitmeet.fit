'use client'

import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { PaymentTiers } from '@/components/payment-tiers'

type Donor = { name: string; beer_score: number; beer_top_tier: string; last_donation_at: string }

const BEER_TIER_EMOJI: Record<string, string> = {
  beer_small: '🍺',
  beer_medium: '🍺🍺🍺',
  beer_large: '📦📦📦',
}

function MedalIcons({ productId, ticker = false }: { productId: string; ticker?: boolean }) {
  if (ticker) {
    return <span style={{ fontSize: 13, lineHeight: '13px', display: 'block', width: 14, textAlign: 'center' }}>🍺</span>
  }
  return <span>{BEER_TIER_EMOJI[productId] ?? '🍺'}</span>
}

function SupportersModal({ onClose, donors, onPurchased }: {
  onClose: () => void
  donors: Donor[]
  onPurchased: () => void
}) {
  const { token } = useAuthStore()

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border overflow-hidden flex flex-col max-h-[85vh]"
        style={{ background: '#0c0a14', borderColor: 'rgba(246,198,91,0.25)' }}
      >
        <div className="w-10 h-1 rounded-full mx-auto mt-3 sm:hidden" style={{ background: 'rgba(255,255,255,0.15)' }} />

        <div
          className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">🍺</span>
            <h2 className="font-black text-lg">Beer supporters</h2>
          </div>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-3">
          <a
            href="/supporters"
            onClick={onClose}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border font-bold text-sm transition-opacity hover:opacity-80"
            style={{ borderColor: 'rgba(246,198,91,0.2)', background: 'rgba(246,198,91,0.05)', color: '#f6c65b' }}
          >
            <span>🏆</span>
            See all supporters
            <span className="opacity-50">→</span>
          </a>

          {donors.length > 0 && (
            <>
              <p className="text-xs font-black uppercase tracking-widest" style={{ color: 'rgba(246,198,91,0.55)' }}>
                Recent supporters
              </p>
              {donors.map((d, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl border"
                  style={{ background: 'rgba(246,198,91,0.04)', borderColor: 'rgba(246,198,91,0.15)' }}>
                  <MedalIcons productId={d.beer_top_tier} />
                  <span className="font-bold text-sm flex-1 truncate">{d.name}</span>
                </div>
              ))}
            </>
          )}

          <p className="text-xs font-bold uppercase tracking-widest mt-1" style={{ color: 'rgba(246,198,91,0.6)' }}>
            Join the wall of fame
          </p>
          <PaymentTiers onSuccess={onPurchased} loggedIn={!!token} />
        </div>
      </div>
    </div>
  )
}

function BeerTickerInner() {
  const [donors, setDonors] = useState<Donor[]>([])
  const [open, setOpen] = useState(false)

  function load() {
    api.get('/beer-donations?sort=recent&limit=10').then(r => setDonors(r.data)).catch(() => {})
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (donors.length > 0) {
      root.style.setProperty('--beer-ticker-h', '30px')
    } else {
      root.style.removeProperty('--beer-ticker-h')
    }
    return () => { root.style.removeProperty('--beer-ticker-h') }
  }, [donors.length])

  if (!donors.length) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center overflow-hidden cursor-pointer group"
        style={{
          height: 30,
          background: 'rgba(12,10,5,0.95)',
          borderTop: '1px solid rgba(246,198,91,0.35)',
          borderBottom: '1px solid rgba(246,198,91,0.35)',
        }}
      >
        {/* Label */}
        <div
          className="flex items-center gap-1.5 px-3 shrink-0 h-full border-r"
          style={{ background: 'rgba(246,198,91,0.07)', borderColor: 'rgba(246,198,91,0.25)' }}
        >
          <span className="text-xs">🍺</span>
          <span
            className="text-[11px] font-black tracking-wide whitespace-nowrap"
            style={{ color: '#f6c65b' }}
          >
            Thanks:
          </span>
        </div>

        {/* Scrolling content */}
        <div className="flex-1 overflow-hidden h-full flex items-center">
          <div className="beer-ticker flex items-center gap-0">
            {[...donors, ...donors].map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 px-4" style={{ height: 30 }}>
                <MedalIcons productId={d.beer_top_tier} ticker />
                <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1 }}>
                  {d.name}
                </span>
                <span className="text-[12px] ml-1" style={{ color: 'rgba(246,198,91,0.45)', lineHeight: 1 }}>·</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chevron hint */}
        <div className="px-2 opacity-50 group-hover:opacity-100 transition-opacity shrink-0">
          <span className="text-[10px]" style={{ color: '#f6c65b' }}>▲</span>
        </div>
      </button>

      {open && (
        <SupportersModal
          donors={donors}
          onClose={() => setOpen(false)}
          onPurchased={() => { setOpen(false); load() }}
        />
      )}
    </>
  )
}

export function BeerTicker() {
  return <BeerTickerInner />
}
