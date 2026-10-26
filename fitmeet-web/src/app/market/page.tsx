import Link from 'next/link'
import { Plus, ShieldCheck, Tag } from 'lucide-react'
import type { Metadata } from 'next'

import { MarketPublicGrid } from '@/components/market-public-grid'
import { Navbar } from '@/components/navbar'
import { getPublicListings } from '@/lib/market-public'

export const metadata: Metadata = {
  title: 'Sports Gear Marketplace — Buy and Sell Used Equipment | FitMeet',
  description: 'Buy and sell used bikes, running gear, SUP boards, fitness equipment and more from people near you. Browse freely; sign in to post or contact a seller.',
  alternates: { canonical: 'https://fitmeet.fit/market/' },
}

export default async function MarketPage() {
  const listings = await getPublicListings(60)

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="py-12 md:py-16 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-6xl mx-auto px-4">
            <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--primary)' }}><Tag size={16} /> Marketplace</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Sports gear from people near you.</h1>
            <p className="text-lg max-w-2xl mb-6" style={{ color: 'var(--text-muted)' }}>
              Bikes, running shoes, SUP boards, fitness equipment and more — buy what you need, sell what you no longer use,
              or post what you are looking for. Browsing is open to everyone; sign in to post a listing or contact a seller.
            </p>
            <Link href="/market/create" className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold">
              <Plus size={15} /> Post a listing
            </Link>
          </div>
        </section>

        <section className="py-10">
          <div className="max-w-6xl mx-auto px-4">
            <MarketPublicGrid initial={listings} builtIds={listings.map(l => l.id)} />
          </div>
        </section>

        <section className="pb-16">
          <div className="max-w-3xl mx-auto px-4">
            <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <h2 className="text-xl font-bold mb-3 flex items-center gap-2"><ShieldCheck size={20} style={{ color: 'var(--primary)' }} /> Buying and selling safely</h2>
              <ul className="space-y-2 text-sm leading-relaxed list-disc pl-5" style={{ color: 'var(--text-muted)' }}>
                <li>Meet in a busy public place, ideally during the day, and bring a friend for expensive items.</li>
                <li>Inspect the gear before you pay: check bike frames for cracks, try shoes and helmets on, test electronics.</li>
                <li>Avoid paying in advance to someone you have never met, and be careful with prices that look too good to be true.</li>
                <li>For used bikes, ask for the purchase receipt or frame number, and check it is not listed as stolen.</li>
                <li>Helmets and other safety gear that have been in a crash should not be resold — ask about their history.</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
