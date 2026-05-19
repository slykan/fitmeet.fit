'use client'

import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js'
import { useRef, useState } from 'react'
import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? ''

const TIERS: Record<string, { label: string; note: string; amount: string; emoji: string }> = {
  beer_small:  { label: 'Small beer',    note: 'A small thank-you',        amount: '3.00',  emoji: '🍺' },
  beer_medium: { label: 'Round for team',note: 'Helps a lot',              amount: '6.00',  emoji: '🍺🍺🍺' },
  beer_large:  { label: 'Full crate',    note: 'Fuel for future features', amount: '12.00', emoji: '📦📦📦' },
}

function TierButton({ productId, onSuccess, loggedIn }: { productId: string; onSuccess: () => void; loggedIn: boolean }) {
  const tier = TIERS[productId]
  const payingRef = useRef(false)
  const [error, setError] = useState<string | null>(null)

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
            setError(null)
            return api.post('/paypal/create-order', { product_id: productId })
              .then(r => r.data.order_id)
              .catch((err: { response?: { status?: number } }) => {
                payingRef.current = false
                if (err?.response?.status === 401) setError('Please log in first to donate.')
                else setError('Could not start payment. Try again.')
                throw err
              })
          }}
          onApprove={(data) =>
            api.post('/paypal/capture-order', { order_id: data.orderID, product_id: productId })
              .then(() => { payingRef.current = false; onSuccess() })
              .catch(() => {
                payingRef.current = false
                setError(loggedIn ? 'Payment failed. Please try again or contact support.' : 'Please log in first to donate.')
              })
          }
          onCancel={() => { payingRef.current = false }}
          onError={() => { payingRef.current = false; if (!error) setError('PayPal error. Please try again.') }}
        />
        {error && (
          <p className="text-xs mt-2 text-center" style={{ color: '#f87171' }}>{error}</p>
        )}
      </div>
    </div>
  )
}

export function BuySection({ onPurchased }: { onPurchased: () => void }) {
  const { token } = useAuthStore()

  if (!PAYPAL_CLIENT_ID) return null

  return (
    <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: 'EUR', intent: 'capture' }}>
      <div className="flex flex-col gap-3">
        {!token && (
          <div className="rounded-xl px-4 py-3 text-sm text-center border"
            style={{ background: 'rgba(246,198,91,0.05)', borderColor: 'rgba(246,198,91,0.2)', color: 'rgba(246,198,91,0.8)' }}>
            <a href="/login" style={{ fontWeight: 700, color: '#f6c65b' }}>Log in</a>
            {' '}to get your name on the Wall of Fame after donating.
          </div>
        )}
        {Object.keys(TIERS).map(id => (
          <TierButton key={id} productId={id} onSuccess={onPurchased} loggedIn={!!token} />
        ))}
      </div>
    </PayPalScriptProvider>
  )
}
