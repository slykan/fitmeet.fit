import Link from 'next/link'
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react'

import { AdSense } from '@/components/adsense'
import { Navbar } from '@/components/navbar'
import { getGuide } from '@/lib/guides'
import { tools } from '@/lib/tools'

// Shared frame for /tools/* pages: title, calculator, explanation text, link to the full guide.
export function ToolPage({ slug, intro, children, explain }: {
  slug: string
  intro: string
  children: React.ReactNode
  explain: { heading: string; paragraphs: string[] }[]
}) {
  const tool = tools.find(t => t.slug === slug)!
  const guide = getGuide(tool.guide)
  const others = tools.filter(t => t.slug !== slug)

  return (
    <>
      <Navbar />
      <AdSense />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 py-12 md:py-16">
          <Link href="/tools" className="inline-flex items-center gap-2 text-sm mb-8 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft size={14} /> All calculators
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-3">{tool.title}</h1>
          <p className="text-base leading-relaxed mb-8 max-w-3xl" style={{ color: 'var(--text-muted)' }}>{intro}</p>

          {children}

          <article className="max-w-3xl mt-12 space-y-8">
            {explain.map((s, i) => (
              <section key={i}>
                <h2 className="text-xl font-bold mb-3">{s.heading}</h2>
                <div className="space-y-3">
                  {s.paragraphs.map((p, j) => <p key={j} className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>{p}</p>)}
                </div>
              </section>
            ))}
          </article>

          {guide && (
            <Link href={`/guides/${guide.slug}`} className="max-w-3xl mt-10 flex items-center gap-3 rounded-2xl border p-4 transition-opacity hover:opacity-85"
              style={{ background: 'rgba(57,255,20,0.06)', borderColor: 'rgba(57,255,20,0.3)' }}>
              <BookOpen size={20} style={{ color: 'var(--primary)' }} />
              <span className="flex-1"><span className="text-xs block" style={{ color: 'var(--text-muted)' }}>Read the full guide</span><span className="font-semibold">{guide.title}</span></span>
              <ArrowRight size={16} style={{ color: 'var(--primary)' }} />
            </Link>
          )}

          <p className="max-w-3xl mt-8 text-xs" style={{ color: 'var(--text-muted)' }}>
            Calculations run in your browser; nothing you type is sent or stored. Results are estimates for healthy adults, not medical advice.
          </p>

          <div className="mt-10 border-t pt-8 grid gap-3 md:grid-cols-2" style={{ borderColor: 'var(--border)' }}>
            {others.map(t => (
              <Link key={t.slug} href={`/tools/${t.slug}`} className="rounded-2xl border p-4 transition-opacity hover:opacity-85" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                <p className="font-semibold">{t.title}</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t.short}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
