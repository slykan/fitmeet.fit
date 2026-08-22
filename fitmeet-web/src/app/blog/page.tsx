import Link from 'next/link'
import { Apple, ArrowRight, BookOpen, Download, MapPin, MessageCircle, Navigation, PencilLine, Route, Share2, ShieldCheck, ShoppingBag, Sparkles, Tag, Users } from 'lucide-react'
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
  Routes:    'rgba(34,197,94,0.14)',
  Safety:    'rgba(239,68,68,0.12)',
  Training:  'rgba(20,184,166,0.12)',
}

const CATEGORY_TEXT: Record<string, string> = {
  Running:   '#39ff14',
  Cycling:   '#00a8ff',
  Hiking:    '#fbbf24',
  Fitness:   '#a78bfa',
  Community: '#fb7185',
  Routes:    '#22c55e',
  Safety:    '#ef4444',
  Training:  '#14b8a6',
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

        {/* Novosti */}
        <section className="py-10 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center gap-2 mb-6">
              <Sparkles size={15} style={{ color: 'var(--primary)' }} />
              <p className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--primary)' }}>News</p>
            </div>

            {/* Live location sharing — top news */}
            <Link
              href="/blog/fitmeet-live-location-sharing"
              className="rounded-2xl border p-6 flex flex-col gap-4 transition-opacity hover:opacity-90 mb-4"
              style={{
                background: 'linear-gradient(135deg, rgba(57,255,20,0.09) 0%, rgba(57,255,20,0.02) 100%)',
                borderColor: 'rgba(57,255,20,0.28)',
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: 'rgba(57,255,20,0.16)', color: 'var(--primary)' }}
                >
                  New · Live map
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>22 August 2026</span>
              </div>
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <h2 className="text-xl font-bold leading-snug mb-2">
                    See everyone live on the map during group rides and runs
                  </h2>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Opt in after checking in to an event and share your live position with the group — see where everyone is in real time, their speed, and never lose the pack, even if your phone is locked.
                  </p>
                </div>
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl shrink-0" style={{ background: 'rgba(57,255,20,0.12)' }}>
                  <Navigation size={32} style={{ color: 'var(--primary)' }} />
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold mt-auto" style={{ color: 'var(--primary)' }}>
                Read more <ArrowRight size={12} />
              </div>
            </Link>

            {/* Trust & Safety — news */}
            <Link
              href="/blog/fitmeet-block-report-trust-and-safety"
              className="rounded-2xl border p-6 flex flex-col gap-4 transition-opacity hover:opacity-90 mb-4"
              style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.09) 0%, rgba(239,68,68,0.02) 100%)',
                borderColor: 'rgba(239,68,68,0.28)',
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.18)', color: '#ef4444' }}
                >
                  New · Safety
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>8 July 2026</span>
              </div>
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <h2 className="text-xl font-bold leading-snug mb-2">
                    Report, block and stay in control — new trust &amp; safety tools
                  </h2>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Report users, events, comments, listings and messages in a couple of taps, block anyone instantly, and rest easy knowing a real admin team reviews every report.
                  </p>
                </div>
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl shrink-0" style={{ background: 'rgba(239,68,68,0.12)' }}>
                  <ShieldCheck size={32} style={{ color: '#ef4444' }} />
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold mt-auto" style={{ color: '#ef4444' }}>
                Read more <ArrowRight size={12} />
              </div>
            </Link>

            {/* iOS App Store — news */}
            <Link
              href="/blog/fitmeet-ios-app-coming-to-app-store"
              className="rounded-2xl border p-6 flex flex-col gap-4 transition-opacity hover:opacity-90 mb-4"
              style={{
                background: 'linear-gradient(135deg, rgba(0,168,255,0.09) 0%, rgba(0,168,255,0.02) 100%)',
                borderColor: 'rgba(0,168,255,0.28)',
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: 'rgba(0,168,255,0.18)', color: '#00a8ff' }}
                >
                  New · iOS
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>1 July 2026</span>
              </div>
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <h2 className="text-xl font-bold leading-snug mb-2">
                    FitMeet is coming to the App Store — submitted and awaiting Apple approval
                  </h2>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    The iOS app is complete and in review. Every feature from Android is here: live map, route builder, GPX export, marketplace and messaging. Coming very soon.
                  </p>
                </div>
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl shrink-0" style={{ background: 'rgba(0,168,255,0.12)' }}>
                  <Apple size={32} style={{ color: '#00a8ff' }} />
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold mt-auto" style={{ color: '#00a8ff' }}>
                Read more <ArrowRight size={12} />
              </div>
            </Link>

            <div className="grid gap-4 md:grid-cols-3 mb-4">
              {/* Marketplace — featured news */}
              <Link
                href="/blog/fitmeet-marketplace-buy-sell-sports-gear"
                className="md:col-span-2 rounded-2xl border p-6 flex flex-col gap-4 transition-opacity hover:opacity-90"
                style={{
                  background: 'linear-gradient(135deg, rgba(251,113,133,0.09) 0%, rgba(251,113,133,0.02) 100%)',
                  borderColor: 'rgba(251,113,133,0.28)',
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: 'rgba(251,113,133,0.18)', color: '#fb7185' }}
                  >
                    New · Marketplace
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>16 June 2026</span>
                </div>
                <h2 className="text-xl font-bold leading-snug">
                  Buy and sell sports gear with your local community
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  List gear you no longer need, post a wanted request, or browse what athletes near you are selling — bikes, shoes, kit and more. Contact sellers directly through FitMeet messages.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: ShoppingBag, label: 'Sell gear' },
                    { icon: Tag,         label: 'Buy requests' },
                    { icon: MessageCircle, label: 'DM sellers' },
                    { icon: MapPin,      label: 'Local first' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs font-semibold">
                      <Icon size={12} style={{ color: '#fb7185' }} /> {label}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold mt-auto" style={{ color: '#fb7185' }}>
                  Read more <ArrowRight size={12} />
                </div>
              </Link>

              <div className="flex flex-col gap-3">
                {[
                  {
                    icon: ShoppingBag,
                    title: 'Sell listings',
                    desc: 'Post photos, price, condition and category. Listings go live instantly.',
                  },
                  {
                    icon: Tag,
                    title: 'Wanted posts',
                    desc: 'Looking for something specific? Post a request with max budget.',
                  },
                  {
                    icon: MessageCircle,
                    title: 'Built-in messaging',
                    desc: 'Contact sellers directly through FitMeet — no external accounts needed.',
                  },
                ].map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className="rounded-xl border p-4 flex gap-3"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(251,113,133,0.1)' }}
                    >
                      <Icon size={14} style={{ color: '#fb7185' }} />
                    </div>
                    <div>
                      <p className="font-bold text-sm mb-0.5">{title}</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Previous news — GPX routes */}
            <div className="grid gap-4 md:grid-cols-3">
              <Link
                href="/blog/gpx-routes-create-download-share"
                className="md:col-span-2 rounded-2xl border p-6 flex flex-col gap-4 transition-opacity hover:opacity-90"
                style={{
                  background: 'linear-gradient(135deg, rgba(57,255,20,0.07) 0%, rgba(57,255,20,0.01) 100%)',
                  borderColor: 'rgba(57,255,20,0.18)',
                }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: 'rgba(57,255,20,0.12)', color: '#39ff14' }}
                  >
                    Routes
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>28 May 2026</span>
                </div>
                <h2 className="text-xl font-bold leading-snug">
                  Create, download and share GPX routes for free
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Draw routes point by point with road snapping, export as GPX and send directly to your Garmin, Wahoo or any navigation app.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: PencilLine, label: 'Draw routes' },
                    { icon: Download,   label: 'GPX export' },
                    { icon: Share2,     label: 'Share pages' },
                    { icon: MapPin,     label: 'Send to device' },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs font-semibold">
                      <Icon size={12} style={{ color: 'var(--primary)' }} /> {label}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold mt-auto" style={{ color: 'var(--primary)' }}>
                  Read more <ArrowRight size={12} />
                </div>
              </Link>

              <div className="flex flex-col gap-3">
                {[
                  {
                    icon: Route,
                    title: 'Route catalog',
                    desc: 'Browse public community routes with map, elevation chart and stats.',
                  },
                  {
                    icon: Download,
                    title: 'Works on any device',
                    desc: 'GPX import for Garmin, Wahoo, Komoot, AllTrails and smartphone apps.',
                  },
                  {
                    icon: PencilLine,
                    title: 'Mobile route builder',
                    desc: 'Full-screen route creation on Android in the FitMeet app.',
                  },
                ].map(({ icon: Icon, title, desc }) => (
                  <div
                    key={title}
                    className="rounded-xl border p-4 flex gap-3"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(57,255,20,0.1)' }}
                    >
                      <Icon size={14} style={{ color: 'var(--primary)' }} />
                    </div>
                    <div>
                      <p className="font-bold text-sm mb-0.5">{title}</p>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex items-center gap-2 mb-8">
              <BookOpen size={15} style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>All articles</p>
            </div>
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
