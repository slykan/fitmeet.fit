'use client'

import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js'
import { useRef } from 'react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? ''

const TIERS: Record<string, { label: string; note: string; amount: string; emoji: string }> = {
  beer_small:  { label: 'Small beer',    note: 'A small thank-you',        amount: '3.00',  emoji: '🍺' },
  beer_medium: { label: 'Round for team',note: 'Helps a lot',              amount: '6.00',  emoji: '🍺🍺🍺' },
  beer_large:  { label: 'Full crate',    note: 'Fuel for future features', amount: '12.00', emoji: '📦📦📦' },
}

function TierButton({ productId, onSuccess }: { productId: string; onSuccess: () => void }) {
  const tier = TIERS[productId]
  const payingRef = useRef(false)

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'rgba(246,198,91,0.2)' }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'rgba(246,198,91,0.04)' }}>
        <div className="flex items-center gap-3">
          <span className="text-xl">{tier.emoji}</span>
          <div>
            <p className="font-bold">{tier.label}</p>
            <p className="text-sm opacity-60">{tier.note}</p>
          </div>
        </div>
        <span className="font-black text-lg" style={{ color: '#f6c65b' }}>€{tier.amount}</span>
      </div>
      <div className="px-4 py-3" style={{ background: 'rgba(0,0,0,0.15)' }}>
        <PayPalButtons
          style={{ layout: 'horizontal', height: 40, tagline: false, label: 'pay' }}
          createOrder={() => {
            payingRef.current = true
            return api.post('/paypal/create-order', { product_id: productId }).then(r => r.data.order_id)
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

export function BuySection({ onPurchased }: { onPurchased: () => void }) {
  const { token } = useAuthStore()

  if (!token) {
    return (
      <div className="rounded-2xl border p-6 text-center" style={{ borderColor: 'rgba(246,198,91,0.2)', background: 'rgba(246,198,91,0.03)' }}>
        <p className="text-2xl mb-2">🍺</p>
        <p className="font-bold text-lg mb-1">Join the Wall of Fame</p>
        <p className="text-sm opacity-60 mb-4">Log in to buy a beer and get your name on every screen.</p>
        <a href="/login" className="inline-block px-6 py-2.5 rounded-xl font-bold text-sm" style={{ background: '#f6c65b', color: '#000' }}>
          Log in
        </a>
      </div>
    )
  }

  if (!PAYPAL_CLIENT_ID) return null

  return (
    <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: 'EUR', intent: 'capture' }}>
      <div className="flex flex-col gap-3">
        {Object.keys(TIERS).map(id => (
          <TierButton key={id} productId={id} onSuccess={onPurchased} />
        ))}
      </div>
    </PayPalScriptProvider>
  )
}
