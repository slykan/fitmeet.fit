'use client'

import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useRef, useState } from 'react'
import api from '@/lib/api'

const PAYPAL_CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? ''

const TIERS = [
  {
    id: 'beer_small',
    label: 'Small beer',
    emoji: '🍺',
    paypal_amount: '3.00',
    revolut_amount: '2.50',
    revolut_url: 'https://checkout.revolut.com/pay/bf8526e8-b664-4e6b-9d63-3d0162a91ca4',
  },
  {
    id: 'beer_medium',
    label: 'Round for team',
    emoji: '🍺🍺🍺',
    paypal_amount: '6.00',
    revolut_amount: '6.00',
    revolut_url: 'https://checkout.revolut.com/pay/c6c22444-d9d9-4697-873f-5cbb83b293c9',
  },
  {
    id: 'beer_large',
    label: 'Full crate',
    emoji: '📦📦📦',
    paypal_amount: '12.00',
    revolut_amount: '12.00',
    revolut_url: 'https://checkout.revolut.com/pay/8a79dbe9-5017-48fc-ba53-87ecfdd0fe42',
  },
]

function PayPalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M26 9.5c0 5-4 8-9 8H13l-2 12H7l3.5-21h8c4 0 7.5 1 7.5 1z" fill="#009CDE"/>
      <path d="M27.5 7c0 5-4 8-9 8H14.5l-2 12H9l3.5-21h8C24.5 6 27.5 6.5 27.5 7z" fill="#003087"/>
    </svg>
  )
}

function RevolutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="5" fill="#191C1F"/>
      <path d="M7.5 5.5h6a2.75 2.75 0 0 1 0 5.5H7.5V5.5zm0 5.5h3.5l4 7h-2.5l-5-7z" fill="white"/>
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

function RevolutTiers({ onSuccess, loggedIn }: { onSuccess: () => void; loggedIn: boolean }) {
  const [openedTier, setOpenedTier] = useState<(typeof TIERS)[number] | null>(null)
  const [recording, setRecording] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function rememberTier(tier: (typeof TIERS)[number]) {
    setOpenedTier(tier)
    setMessage(null)
    setError(null)
  }

  async function recordDonation() {
    if (!openedTier || recording) return
    setRecording(true)
    setError(null)

    try {
      await api.post('/beer-donations', { product_id: openedTier.id })
      setMessage('Thanks! Your name is on the beer wall.')
      onSuccess()
    } catch {
      setError('Could not add your name. Make sure you are logged in.')
    } finally {
      setRecording(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {TIERS.map(tier => (
        <a
          key={tier.id}
          href={tier.revolut_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => rememberTier(tier)}
          className="rounded-xl border flex items-center justify-between px-4 py-3 transition-opacity hover:opacity-80"
          style={{ borderColor: 'rgba(246,198,91,0.18)', background: 'rgba(246,198,91,0.05)' }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">{tier.emoji}</span>
            <p className="font-bold text-sm">{tier.label}</p>
          </div>
          <span className="font-black text-sm" style={{ color: '#f6c65b' }}>€{tier.revolut_amount}</span>
        </a>
      ))}

      {openedTier && (
        <div className="rounded-xl border px-3 py-3" style={{ borderColor: 'rgba(130,80,255,0.24)', background: 'rgba(130,80,255,0.08)' }}>
          {loggedIn ? (
            <>
              <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.62)' }}>
                After Revolut confirms the payment, add your name to the beer wall.
              </p>
              <button
                type="button"
                onClick={recordDonation}
                disabled={recording}
                className="w-full rounded-lg px-3 py-2 text-sm font-bold transition-opacity disabled:opacity-50"
                style={{ background: '#f6c65b', color: '#18110a' }}
              >
                {recording ? 'Adding...' : 'I completed payment'}
              </button>
            </>
          ) : (
            <p className="text-xs text-center" style={{ color: 'rgba(246,198,91,0.78)' }}>
              <a href="/login" style={{ fontWeight: 800, color: '#f6c65b' }}>Log in</a> before confirming if you want your name on the beer wall.
            </p>
          )}
          {message && <p className="text-xs mt-2" style={{ color: '#39ff14' }}>{message}</p>}
          {error && <p className="text-xs mt-2" style={{ color: '#f87171' }}>{error}</p>}
        </div>
      )}
    </div>
  )
}

type Method = 'paypal' | 'revolut' | null

export function PaymentTiers({ onSuccess, loggedIn = true }: { onSuccess: () => void; loggedIn?: boolean }) {
  const [open, setOpen] = useState<Method>(null)

  function toggle(method: Method) {
    setOpen(prev => prev === method ? null : method)
  }

  return (
    <div className="flex flex-col gap-2">
      {/* PayPal */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: open === 'paypal' ? 'rgba(0,150,210,0.45)' : 'rgba(255,255,255,0.1)' }}
      >
        <button
          type="button"
          onClick={() => toggle('paypal')}
          className="w-full flex items-center justify-between px-4 py-3 transition-opacity hover:opacity-80"
          style={{ background: open === 'paypal' ? 'rgba(0,150,210,0.1)' : 'rgba(255,255,255,0.04)' }}
        >
          <div className="flex items-center gap-2.5">
            <PayPalIcon />
            <span className="font-bold text-sm">PayPal</span>
            {!loggedIn && <span className="text-xs opacity-40">(login required)</span>}
          </div>
          {open === 'paypal'
            ? <ChevronUp size={15} className="opacity-40 shrink-0" />
            : <ChevronDown size={15} className="opacity-40 shrink-0" />}
        </button>
        {open === 'paypal' && (
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
        )}
      </div>

      {/* Revolut */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: open === 'revolut' ? 'rgba(130,80,255,0.45)' : 'rgba(255,255,255,0.1)' }}
      >
        <button
          type="button"
          onClick={() => toggle('revolut')}
          className="w-full flex items-center justify-between px-4 py-3 transition-opacity hover:opacity-80"
          style={{ background: open === 'revolut' ? 'rgba(130,80,255,0.08)' : 'rgba(255,255,255,0.04)' }}
        >
          <div className="flex items-center gap-2.5">
            <RevolutIcon />
            <span className="font-bold text-sm">Revolut</span>
          </div>
          {open === 'revolut'
            ? <ChevronUp size={15} className="opacity-40 shrink-0" />
            : <ChevronDown size={15} className="opacity-40 shrink-0" />}
        </button>
        {open === 'revolut' && (
          <div className="px-3 pb-3 pt-1" style={{ background: 'rgba(0,0,0,0.18)' }}>
            <RevolutTiers onSuccess={onSuccess} loggedIn={loggedIn} />
          </div>
        )}
      </div>
    </div>
  )
}
