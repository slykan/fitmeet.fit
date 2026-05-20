import Link from 'next/link'
import { ArrowRight, BookOpen, Users } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { posts } from '@/lib/posts'

export const metadata = {
  title: 'Blog — FitMeet',
  description: 'Guides, tips and ideas for organising group sports events and building active local communities.',
}

const CATEGORY_COLOR: Record<string, string> = {
  Running:   'rgba(57,255,20,0.12)',
  Cycling:   'rgba(0,168,255,0.12)',
  Hiking:    'rgba(251,191,36,0.12)',
  Fitness:   'rgba(167,139,250,0.12)',
  Community: 'rgba(251,113,133,0.12)',
}

const CATEGORY_TEXT: Record<string, string> = {
  Running:   '#39ff14',
  Cycling:   '#00a8ff',
  Hiking:    '#fbbf24',
  Fitness:   '#a78bfa',
  Community: '#fb7185',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function BlogPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="py-16 md:py-20 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center gap-3 mb-3">
              <BookOpen size={18} style={{ color: 'var(--primary)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>FitMeet Blog</p>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Guides for active people.</h1>
            <p className="text-lg max-w-2xl" style={{ color: 'var(--text-muted)' }}>
              Practical advice on organising group workouts, finding training partners, and building local sports communities that actually last.
            </p>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group rounded-2xl border flex flex-col overflow-hidden transition-opacity hover:opacity-80"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="p-6 flex flex-col gap-4 flex-1">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-bold px-3 py-1 rounded-full"
                        style={{
                          background: CATEGORY_COLOR[post.category] ?? 'rgba(57,255,20,0.1)',
                          color: CATEGORY_TEXT[post.category] ?? 'var(--primary)',
                        }}
                      >
                        {post.category}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {post.readTime} min read
                      </span>
                    </div>

                    <div className="flex-1">
                      <h2 className="font-bold text-lg leading-snug mb-2 group-hover:underline underline-offset-2">
                        {post.title}
                      </h2>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {post.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {formatDate(post.publishedAt)}
                      </span>
                      <ArrowRight size={14} style={{ color: 'var(--primary)' }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <Link
              href="/about"
              className="group mt-2 rounded-2xl border flex items-center gap-5 px-6 py-5 transition-opacity hover:opacity-80"
              style={{ background: 'var(--surface)', borderColor: 'rgba(57,255,20,0.18)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(57,255,20,0.1)' }}>
                <Users size={18} style={{ color: 'var(--primary)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold mb-0.5">About FitMeet</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  How it started, who it is for, and where it is going.
                </p>
              </div>
              <ArrowRight size={16} style={{ color: 'var(--primary)' }} className="shrink-0" />
            </Link>
          </div>
        </section>
      </main>
    </>
  )
}
