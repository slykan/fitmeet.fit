import Link from 'next/link'
import { ArrowRight, Calculator } from 'lucide-react'
import type { Metadata } from 'next'

import { AdSense } from '@/components/adsense'
import { Navbar } from '@/components/navbar'
import { tools } from '@/lib/tools'

export const metadata: Metadata = {
  title: 'Free Training Calculators — BMR, Heart Rate Zones, Running Pace | FitMeet',
  description: 'Free calculators for active people: BMR and daily calories, heart-rate training zones, running pace and race-time predictions. Runs in your browser, no sign-up.',
  alternates: { canonical: 'https://fitmeet.fit/tools/' },
}

export default function ToolsPage() {
  return (
    <>
      <Navbar />
      <AdSense />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-14 md:py-20">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--primary)' }}><Calculator size={16} /> Tools</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Free training calculators.</h1>
          <p className="text-lg max-w-2xl mb-10" style={{ color: 'var(--text-muted)' }}>
            Quick answers to the numbers behind your training. No account needed — everything is calculated in your browser.
          </p>
          <div className="grid gap-5 md:grid-cols-3">
            {tools.map(t => (
              <Link key={t.slug} href={`/tools/${t.slug}`} className="rounded-2xl border p-6 flex flex-col gap-3 transition-opacity hover:opacity-85" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <h2 className="text-lg font-bold">{t.title}</h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.short}</p>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--primary)' }}>Open <ArrowRight size={14} /></span>
              </Link>
            ))}
          </div>
          <p className="mt-12 text-sm" style={{ color: 'var(--text-muted)' }}>
            Want the background? Read our <Link href="/guides" className="underline" style={{ color: 'var(--primary)' }}>training guides</Link> on heart-rate zones, calories, FTP and running paces.
          </p>
        </div>
      </main>
    </>
  )
}
