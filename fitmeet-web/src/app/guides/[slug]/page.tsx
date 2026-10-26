import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Calculator, Clock } from 'lucide-react'
import type { Metadata } from 'next'

import { AdSense } from '@/components/adsense'
import { Navbar } from '@/components/navbar'
import { ShareButton } from '@/components/share-button'
import { getGuide, guides } from '@/lib/guides'

export const dynamicParams = false

export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const guide = getGuide(slug)
  if (!guide) return {}
  return {
    title: `${guide.title} | FitMeet Guides`,
    description: guide.description,
    alternates: { canonical: `https://fitmeet.fit/guides/${guide.slug}/` },
    openGraph: { title: guide.title, description: guide.description, type: 'article', url: `https://fitmeet.fit/guides/${guide.slug}/` },
  }
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const guide = getGuide(slug)
  if (!guide) notFound()
  const others = guides.filter((g) => g.slug !== guide.slug).slice(0, 3)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.description,
    dateModified: guide.updatedAt,
    author: { '@type': 'Organization', name: 'FitMeet' },
    publisher: { '@type': 'Organization', name: 'FitMeet', url: 'https://fitmeet.fit' },
    mainEntityOfPage: `https://fitmeet.fit/guides/${guide.slug}/`,
  }

  return (
    <>
      <Navbar />
      <AdSense />
      <main className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
          <Link href="/guides" className="inline-flex items-center gap-2 text-sm mb-8 transition-opacity hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
            <ArrowLeft size={14} /> All guides
          </Link>

          <header className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(57,255,20,0.1)', color: 'var(--primary)' }}>{guide.category}</span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}><Clock size={12} /> {guide.readTime} min read</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">{guide.title}</h1>
            <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>{guide.description}</p>
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Updated {formatDate(guide.updatedAt)}</p>
              <ShareButton title={guide.title} text={guide.description} url={`https://fitmeet.fit/guides/${guide.slug}`} />
            </div>
          </header>

          {guide.tool && (
            <Link href={guide.tool.href} className="mb-10 flex items-center gap-3 rounded-2xl border p-4 transition-opacity hover:opacity-85"
              style={{ background: 'rgba(57,255,20,0.06)', borderColor: 'rgba(57,255,20,0.3)' }}>
              <Calculator size={20} style={{ color: 'var(--primary)' }} />
              <span className="flex-1 font-semibold">{guide.tool.label}</span>
              <span className="text-sm" style={{ color: 'var(--primary)' }}>Open <ArrowRight size={13} className="inline" /></span>
            </Link>
          )}

          <article className="space-y-8">
            {guide.sections.map((section, i) => (
              <section key={i}>
                {section.heading && <h2 className="text-xl font-bold mb-4">{section.heading}</h2>}
                <div className="space-y-4">
                  {section.paragraphs.map((p, j) => (
                    <p key={j} className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>{p}</p>
                  ))}
                </div>
              </section>
            ))}
          </article>

          <p className="mt-10 text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            This guide is general information for healthy adults, not medical advice. If you have a health condition, are returning from injury or are unsure whether hard exercise is safe for you, talk to a doctor first.
          </p>

          <div className="mt-10 rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'rgba(57,255,20,0.16)' }}>
            <p className="font-bold text-lg mb-2">Train with people near you</p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              FitMeet helps you find local runs, rides and workouts, sync your trainings and get an AI coach&apos;s view on them — free.
            </p>
            <Link href="/register" className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold">
              Get started free <ArrowRight size={14} />
            </Link>
          </div>

          <div className="mt-10 border-t pt-10" style={{ borderColor: 'var(--border)' }}>
            <p className="font-bold mb-4">More guides</p>
            <div className="grid gap-3">
              {others.map((g) => (
                <Link key={g.slug} href={`/guides/${g.slug}`} className="rounded-2xl border p-4 transition-opacity hover:opacity-80" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  <p className="text-sm font-semibold leading-snug">{g.title}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
