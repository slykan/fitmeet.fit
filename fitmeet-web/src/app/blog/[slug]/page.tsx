import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Clock } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { ShareButton } from '@/components/share-button'
import { posts, getPost } from '@/lib/posts'
import type { Metadata } from 'next'

export const dynamicParams = false

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return {}
  return {
    title: `${post.title} — FitMeet Blog`,
    description: post.description,
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

const CATEGORY_COLOR: Record<string, string> = {
  Running:   'rgba(57,255,20,0.12)',
  Cycling:   'rgba(0,168,255,0.12)',
  Hiking:    'rgba(251,191,36,0.12)',
  Fitness:   'rgba(167,139,250,0.12)',
  Community: 'rgba(251,113,133,0.12)',
  Routes:    'rgba(34,197,94,0.14)',
}
const CATEGORY_TEXT: Record<string, string> = {
  Running:   '#39ff14',
  Cycling:   '#00a8ff',
  Hiking:    '#fbbf24',
  Fitness:   '#a78bfa',
  Community: '#fb7185',
  Routes:    '#22c55e',
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  const currentIndex = posts.findIndex((p) => p.slug === post.slug)
  const prev = currentIndex > 0 ? posts[currentIndex - 1] : null
  const next = currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">

          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-sm mb-8 transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            <ArrowLeft size={14} /> Back to Blog
          </Link>

          <header className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <span
                className="text-xs font-bold px-3 py-1 rounded-full"
                style={{
                  background: CATEGORY_COLOR[post.category] ?? 'rgba(57,255,20,0.1)',
                  color: CATEGORY_TEXT[post.category] ?? 'var(--primary)',
                }}
              >
                {post.category}
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <Clock size={12} /> {post.readTime} min read
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">{post.title}</h1>
            <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
              {post.description}
            </p>
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {formatDate(post.publishedAt)}
              </p>
              <ShareButton
                title={post.title}
                text={post.description}
                url={`https://fitmeet.fit/blog/${post.slug}`}
              />
            </div>
          </header>

          <div className="border-t mb-10" style={{ borderColor: 'var(--border)' }} />

          <article className="space-y-8">
            {post.sections.map((section, i) => (
              <section key={i}>
                {section.heading && (
                  <h2 className="text-xl font-bold mb-4">{section.heading}</h2>
                )}
                <div className="space-y-4">
                  {section.paragraphs.map((p, j) => (
                    <p key={j} className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {p}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </article>

          <div className="mt-12 rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'rgba(57,255,20,0.16)' }}>
            <p className="font-bold text-lg mb-2">Try it with FitMeet</p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              Create or join local sports events, share routes, and keep your group in sync — all in one place.
            </p>
            <Link
              href="/register"
              className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold"
            >
              Get started free <ArrowRight size={14} />
            </Link>
          </div>

          {(prev || next) && (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 border-t pt-10" style={{ borderColor: 'var(--border)' }}>
              {prev && (
                <Link
                  href={`/blog/${prev.slug}`}
                  className="rounded-2xl border p-4 transition-opacity hover:opacity-80"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>← Previous</p>
                  <p className="text-sm font-semibold leading-snug">{prev.title}</p>
                </Link>
              )}
              {next && (
                <Link
                  href={`/blog/${next.slug}`}
                  className="rounded-2xl border p-4 transition-opacity hover:opacity-80 sm:text-right"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Next →</p>
                  <p className="text-sm font-semibold leading-snug">{next.title}</p>
                </Link>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
