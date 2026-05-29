'use client'

import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js'
import { useRef, useState } from 'react'
import api from '@/lib/api'

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? ''

const TIERS = [
  { id: 'beer_small',  label: 'Small beer',     emoji: '🍺',       paypal_amount: '3.00' },
  { id: 'beer_medium', label: 'Round for team',  emoji: '🍺🍺🍺',   paypal_amount: '6.00' },
  { id: 'beer_large',  label: 'Full crate',      emoji: '📦📦📦',   paypal_amount: '12.00' },
]

function PayPalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M26 9.5c0 5-4 8-9 8H13l-2 12H7l3.5-21h8c4 0 7.5 1 7.5 1z" fill="#009CDE"/>
      <path d="M27.5 7c0 5-4 8-9 8H14.5l-2 12H9l3.5-21h8C24.5 6 27.5 6.5 27.5 7z" fill="#003087"/>
    </svg>
  )
}

function PayPalTiers({ onSuccess }: { onSuccess: () => void }) {
  const payingRef = useRef(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>{error}</p>
      )}
      {TIERS.map(tier => (
        <div key={tier.id} className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(246,198,91,0.18)' }}>
          <div className="px-4 py-2.5 flex items-center justify-between" style={{ background: 'rgba(246,198,91,0.05)' }}>
            <div className="flex items-center gap-2">
              <span className="text-sm">{tier.emoji}</span>
              <p className="font-bold text-sm">{tier.label}</p>
            </div>
            <span className="font-black text-sm" style={{ color: '#f6c65b' }}>€{tier.paypal_amount}</span>
          </div>
          <div className="px-3 py-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
            <PayPalButtons
              style={{ layout: 'horizontal', height: 35, tagline: false, label: 'pay' }}
              createOrder={() => {
                payingRef.current = true
                setError(null)
                return api.post('/paypal/create-order', { product_id: tier.id })
                  .then(r => r.data.order_id)
                  .catch(() => { payingRef.current = false; setError('Could not start payment. Are you logged in?'); throw new Error() })
              }}
              onApprove={(data) =>
                api.post('/paypal/capture-order', { order_id: data.orderID, product_id: tier.id })
                  .then(() => { payingRef.current = false; onSuccess() })
                  .catch(() => { payingRef.current = false; setError('Payment failed. Please try again.') })
              }
              onCancel={() => { payingRef.current = false }}
              onError={() => { payingRef.current = false; if (!error) setError('PayPal error. Please try again.') }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function PaymentTiers({ onSuccess, loggedIn = true }: { onSuccess: () => void; loggedIn?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(0,150,210,0.3)' }}>
        <div className="px-4 py-3 flex items-center gap-2.5" style={{ background: 'rgba(0,150,210,0.08)' }}>
          <PayPalIcon />
          <span className="font-bold text-sm">PayPal</span>
          {!loggedIn && <span className="text-xs opacity-40">(login required)</span>}
        </div>
        <div className="px-3 pb-3 pt-1" style={{ background: 'rgba(0,0,0,0.18)' }}>
          {!loggedIn ? (
            <p className="text-xs text-center py-2" style={{ color: 'rgba(246,198,91,0.7)' }}>
              <a href="/login" style={{ fontWeight: 700, color: '#f6c65b' }}>Log in</a> to pay with PayPal.
            </p>
          ) : PAYPAL_CLIENT_ID ? (
            <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: 'EUR', intent: 'capture' }}>
              <PayPalTiers onSuccess={onSuccess} />
            </PayPalScriptProvider>
          ) : null}
        </div>
      </div>
    </div>
  )
}
