'use client'

import { useAuthStore } from '@/store/auth'
import { PaymentTiers } from '@/components/payment-tiers'

export function BuySection({ onPurchased }: { onPurchased: () => void }) {
  const { token } = useAuthStore()

  return (
    <div className="flex flex-col gap-3">
      {!token && (
        <div
          className="rounded-xl px-4 py-3 text-sm text-center border"
          style={{ background: 'rgba(246,198,91,0.05)', borderColor: 'rgba(246,198,91,0.2)', color: 'rgba(246,198,91,0.8)' }}
        >
          <a href="/login" style={{ fontWeight: 700, color: '#f6c65b' }}>Log in</a>
          {' '}to get your name on the Wall of Fame after donating.
        </div>
      )}
      <PaymentTiers onSuccess={onPurchased} loggedIn={!!token} />
    </div>
  )
}
