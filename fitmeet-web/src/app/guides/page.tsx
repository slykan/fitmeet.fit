import Link from 'next/link'
import { ArrowRight, Calculator, Clock } from 'lucide-react'
import type { Metadata } from 'next'

import { AdSense } from '@/components/adsense'
import { Navbar } from '@/components/navbar'
import { guides } from '@/lib/guides'
import { tools } from '@/lib/tools'

export const metadata: Metadata = {
  title: 'Training Guides — Heart Rate Zones, Calories, FTP, Paces | FitMeet',
  description: 'Practical, science-based guides for runners, cyclists and anyone who trains: heart-rate zones, BMR and daily calories, FTP and W/kg, running paces, fuelling and training with others.',
  alternates: { canonical: 'https://fitmeet.fit/guides/' },
}

export default function GuidesPage() {
  return (
    <>
      <Navbar />
      <AdSense />
      <main className="flex-1">
        <section className="py-14 md:py-20 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-6xl mx-auto px-4">
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--primary)' }}>Guides</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Train smarter, not just harder.</h1>
            <p className="text-lg max-w-2xl" style={{ color: 'var(--text-muted)' }}>
              Clear, practical guides on the numbers behind your training — heart-rate zones, calories, power and pace —
              and on the people side of sport: finding partners and riding or running in a group.
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="max-w-6xl mx-auto px-4 grid gap-5 md:grid-cols-2">
            {guides.map((g) => (
              <Link key={g.slug} href={`/guides/${g.slug}`} className="rounded-2xl border p-6 flex flex-col gap-3 transition-opacity hover:opacity-85"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span className="font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(57,255,20,0.1)', color: 'var(--primary)' }}>{g.category}</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {g.readTime} min read</span>
                </div>
                <h2 className="text-xl font-bold leading-snug">{g.title}</h2>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{g.description}</p>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--primary)' }}>Read the guide <ArrowRight size={14} /></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="pb-16">
          <div className="max-w-6xl mx-auto px-4">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2"><Calculator size={22} /> Free calculators</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {tools.map((t) => (
                <Link key={t.slug} href={`/tools/${t.slug}`} className="rounded-2xl border p-5 transition-opacity hover:opacity-85" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <p className="font-bold mb-1">{t.title}</p>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.short}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
