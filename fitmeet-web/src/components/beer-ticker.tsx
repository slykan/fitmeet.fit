'use client'

import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js'
import { X } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

type Donor = { name: string; beer_score: number; beer_top_tier: string }

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? ''

const TIERS: Record<string, { label: string; note: string; amount: string; icons: number; crate?: boolean }> = {
  beer_small:  { label: 'Small beer',      note: 'A small thank-you',        amount: '3.00', icons: 1 },
  beer_medium: { label: 'Round for team',  note: 'Helps a lot',              amount: '6.00', icons: 3 },
  beer_large:  { label: 'Full crate',      note: 'Fuel for future features', amount: '12.00', icons: 1, crate: true },
}

function MedalIcons({ productId }: { productId: string }) {
  const tier = TIERS[productId]
  if (!tier) return null
  if (tier.crate) return <span className="text-sm">📦📦📦</span>
  return <span className="text-sm">{'🍺'.repeat(tier.icons)}</span>
}

function PayPalTierButton({ productId, onSuccess, payingRef }: {
  productId: string
  onSuccess: () => void
  payingRef: React.MutableRefObject<boolean>
}) {
  const tier = TIERS[productId]
  if (!tier) return null

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(246,198,91,0.18)' }}>
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: 'rgba(246,198,91,0.05)' }}
      >
        <div className="flex items-center gap-2">
          <MedalIcons productId={productId} />
          <div>
            <p className="font-bold text-sm">{tier.label}</p>
            <p className="text-xs opacity-60">{tier.note}</p>
          </div>
        </div>
        <span className="font-black text-sm" style={{ color: '#f6c65b' }}>€{tier.amount}</span>
      </div>
      <div className="px-3 py-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <PayPalButtons
          style={{ layout: 'horizontal', height: 35, tagline: false, label: 'pay' }}
          createOrder={() => {
            payingRef.current = true
            return api.post('/paypal/create-order', { product_id: productId })
              .then(r => r.data.order_id)
          }}
          onApprove={(data) =>
            api.post('/paypal/capture-order', { order_id: data.orderID, product_id: productId })
              .then(() => { payingRef.current = false; onSuccess() })
          }
          onCancel={() => { payingRef.current = false }}
          onError={() => { payingRef.current = false }}
        />
      </div>
    </div>
  )
}

function SupportersModal({ onClose, donors, onPurchased }: {
  onClose: () => void
  donors: Donor[]
  onPurchased: () => void
}) {
  const { token } = useAuthStore()
  const payingRef = useRef(false)

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => { if (!payingRef.current) onClose() }}
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

          {!token ? (
            <div
              className="rounded-xl p-4 text-center border"
              style={{ background: 'rgba(246,198,91,0.04)', borderColor: 'rgba(246,198,91,0.15)' }}
            >
              <p className="font-bold text-sm mb-1">Want to join the wall of fame?</p>
              <p className="text-xs opacity-60">Log in to buy a beer and get your name on every screen.</p>
            </div>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(246,198,91,0.6)' }}>
                Join the wall of fame
              </p>
              <div className="flex flex-col gap-2">
                {Object.keys(TIERS).map(id => (
                  <PayPalTierButton
                    key={id}
                    productId={id}
                    payingRef={payingRef}
                    onSuccess={onPurchased}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function BeerTickerInner() {
  const [donors, setDonors] = useState<Donor[]>([])
  const [open, setOpen] = useState(false)

  function load() {
    api.get('/beer-donations').then(r => setDonors(r.data)).catch(() => {})
  }

  useEffect(() => {
    load()
  }, [])

  if (!donors.length) return null

  const doubled = [...donors, ...donors]

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
            {doubled.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5 px-4">
                <MedalIcons productId={d.beer_top_tier} />
                <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  {d.name}
                </span>
                <span className="text-[12px] ml-1" style={{ color: 'rgba(246,198,91,0.45)' }}>·</span>
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
  if (!PAYPAL_CLIENT_ID) return <BeerTickerInner />
  return (
    <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: 'EUR', intent: 'capture' }}>
      <BeerTickerInner />
    </PayPalScriptProvider>
  )
}
