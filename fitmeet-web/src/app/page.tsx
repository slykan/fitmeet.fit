import {
  ArrowRight,
  Bell,
  Camera,
  CheckCircle2,
  Compass,
  MessageSquareText,
  Route,
  Share2,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

import { Navbar } from '@/components/navbar'
import { HeroMap } from '@/components/hero-map'
import { LatestEventsCarousel } from '@/components/latest-events-carousel'
import { LatestUsersTicker } from '@/components/latest-users-ticker'
import { PublicStatsSection } from '@/components/public-stats'
import { PublicCommentsSection } from '@/components/public-comments'

const categories = [
  'Running',
  'Cycling',
  'Hiking',
  'Swimming',
  'Football',
  'Yoga',
  'Camping',
  'Climbing',
]

function GooglePlayIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M3.18 23.76c.3.17.65.19.97.07l11.65-11.65L12 8.38 3.18 23.76z"/>
      <path fill="#FBBC04" d="M20.47 10.6L17.3 8.77l-3.57 3.57 3.57 3.57 3.2-1.85a1.75 1.75 0 0 0 0-3.05v-.01z"/>
      <path fill="#4285F4" d="M3.18.24A1.75 1.75 0 0 0 2.25 1.8v20.4c0 .62.33 1.17.83 1.47L15.42 12 3.18.24z"/>
      <path fill="#34A853" d="M3.18.24L15.42 12l3.38-3.38L4.15.17A1.75 1.75 0 0 0 3.18.24z"/>
    </svg>
  )
}

function InstagramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

const highlights = [
  {
    icon: Compass,
    title: 'Live hub map',
    description: 'Browse nearby events by sport, interest and radius without losing the big picture.',
  },
  {
    icon: Route,
    title: 'Route and GPX sharing',
    description: 'Add the route, share the event, and let people know exactly what they are joining.',
  },
  {
    icon: MessageSquareText,
    title: 'Friends and group chat',
    description: 'Invite friends, coordinate details and keep the whole group in one conversation.',
  },
  {
    icon: Bell,
    title: 'Reminders and updates',
    description: 'Get event reminders, cancellation updates and new event notifications when they matter.',
  },
]

const latestFeatures = [
  {
    icon: CheckCircle2,
    title: 'Event check-ins',
    description: 'Check in when you arrive and see who is already there before the activity starts.',
    href: null,
  },
  {
    icon: MessageSquareText,
    title: 'Comments and chat',
    description: 'Share updates, coordinate details and keep participants connected around every event.',
    href: null,
  },
  {
    icon: Camera,
    title: 'Moments',
    description: 'After every event, organizers upload one photo. Real people, real events — all in one gallery.',
    href: '/moments',
  },
]

const steps = [
  {
    step: '01',
    title: 'Sign in and set your vibe',
    caption: 'Pick interests, set your radius and start with a feed that already feels local.',
    panel: <LoginShot />,
  },
  {
    step: '02',
    title: 'Create or join an event',
    caption: 'Add the place, route, time and details. Then share it out in a way that feels polished.',
    panel: <EventShot />,
  },
  {
    step: '03',
    title: 'Invite friends, find your crew',
    caption: 'Chat together, coordinate the plan and keep everyone synced before the event starts.',
    panel: <FriendsShot />,
  },
]

type HomeEvent = {
  id: number
  title: string
  image_url: string | null
  category: { value: string; label: string }
  location: { address: string | null }
  schedule: { start_at: string; timezone: string; duration_minutes: number | null }
  activity: { distance_km: number | null; elevation_gain: number | null }
  participants_count: number
  views_count: number
  comments_count: number
  status: string
  organizer: { id: number; name: string } | null
}




async function getLatestEvents(): Promise<HomeEvent[]> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.fitmeet.fit/api'

  try {
    const response = await fetch(`${apiBase}/events/public-latest?limit=10`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    })

    if (!response.ok) return []

    const payload = (await response.json()) as { data?: HomeEvent[] }
    return payload.data ?? []
  } catch {
    return []
  }
}

export default async function HomePage() {
  const [latestEvents] = await Promise.all([
    getLatestEvents(),
  ])

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b" style={{ borderColor: 'var(--border)' }}>
          <div
            className="absolute inset-x-0 top-0 h-[36rem] opacity-60 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 20% 10%, rgba(57,255,20,0.16), transparent 35%), radial-gradient(circle at 80% 0%, rgba(0,168,255,0.14), transparent 34%)',
            }}
          />

          <div className="relative max-w-6xl mx-auto px-4 pt-16 pb-14 md:pt-20 md:pb-20">
            <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <Image
                    src="/logo_c.png"
                    alt="FitMeet"
                    width={52}
                    height={52}
                    className="object-contain dark:block hidden"
                  />
                  <Image
                    src="/logo_b.png"
                    alt="FitMeet"
                    width={52}
                    height={52}
                    className="object-contain dark:hidden block"
                  />
                  <div
                    className="inline-flex items-center gap-2 border rounded-full px-4 py-1.5 text-sm"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--surface)' }}
                  >
                    <Zap size={13} style={{ color: 'var(--primary)' }} />
                    Local events. Real people.
                  </div>
                </div>

                <h1 className="text-5xl md:text-7xl font-bold leading-[1.02] mb-5">
                  Find your people.
                  <br />
                  <span style={{ color: 'var(--primary)' }}>Move together.</span>
                </h1>

                <p className="text-lg max-w-xl leading-relaxed mb-8" style={{ color: 'var(--text-muted)' }}>
                  Discover events nearby, create your own, meet new people and keep every activity in sync from
                  the first idea to check-in.
                </p>

                <div className="flex gap-3 flex-wrap mb-8">
                  <Link
                    href="/login"
                    className="btn-primary inline-flex items-center gap-2 px-8 py-3.5 rounded-xl active:scale-95 transition-transform"
                  >
                    Explore FitMeet <ArrowRight size={16} />
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 border font-semibold px-8 py-3.5 rounded-xl transition-colors hover:opacity-80"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    Create account
                  </Link>
                  <a
                    href="https://play.google.com/store/apps/details?id=app.fitmeet.fit"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Get FitMeet on Google Play"
                    className="inline-flex items-center gap-3 px-5 py-3 rounded-xl transition-opacity hover:opacity-85 active:scale-95 transition-transform"
                    style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.10)' }}
                  >
                    <GooglePlayIcon size={24} />
                    <span className="flex flex-col leading-tight">
                      <span className="text-[10px] font-normal" style={{ color: 'rgba(255,255,255,0.7)' }}>Get it on</span>
                      <span className="text-sm font-semibold text-white">Google Play</span>
                    </span>
                  </a>
                  <a
                    href="https://www.instagram.com/fitmeet.fit?igsh=MWxoM2FhZmR0dnprYg=="
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="FitMeet on Instagram"
                    className="inline-flex items-center justify-center border rounded-xl px-4 py-3.5 transition-colors hover:opacity-80"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    <InstagramIcon />
                  </a>
                </div>

                <div
                  className="mb-8 rounded-2xl border p-4"
                  style={{
                    borderColor: 'rgba(57,255,20,0.16)',
                    background: 'linear-gradient(180deg, rgba(57,255,20,0.055), rgba(255,255,255,0.025))',
                  }}
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--primary)' }}>
                      New in FitMeet
                    </p>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Check-ins, Moments, chat
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {latestFeatures.map(({ icon: Icon, title, description, href }) => (
                      <div key={title} className="flex gap-3 sm:block">
                        <div
                          className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center sm:mb-3"
                          style={{ background: 'rgba(57,255,20,0.1)' }}
                        >
                          <Icon size={17} style={{ color: 'var(--primary)' }} />
                        </div>
                        <div>
                          {href ? (
                            <Link href={href} className="text-sm font-bold mb-1 hover:underline underline-offset-2 inline-flex items-center gap-1">
                              {title} <ArrowRight size={11} />
                            </Link>
                          ) : (
                            <p className="text-sm font-bold mb-1">{title}</p>
                          )}
                          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                            {description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {categories.map((label) => (
                    <Link
                      key={label}
                      href="/login"
                      className="inline-flex items-center gap-2 border px-4 py-2 rounded-full text-sm font-medium transition-all"
                      style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="min-w-0">
                <div
                  className="rounded-[28px] border p-4 md:p-5"
                  style={{
                    borderColor: 'rgba(57,255,20,0.18)',
                    background: 'linear-gradient(180deg, rgba(11,16,21,0.98), rgba(8,10,15,0.96))',
                    boxShadow: '0 20px 70px rgba(0,0,0,0.35)',
                  }}
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div>
                      <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                        Hub preview
                      </p>
                      <p className="text-sm font-semibold">Explore nearby events and groups</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={14} style={{ color: 'var(--primary)' }} />
                      Filters, reminders, chat
                    </div>
                  </div>
                  <HeroMap />
                </div>
                <LatestUsersTicker />
              </div>
            </div>
          </div>
        </section>

        <LatestEventsCarousel events={latestEvents} />

        <section className="py-16 md:py-20 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-6xl mx-auto px-4">
            <div className="max-w-2xl mb-10">
              <p className="text-sm font-semibold mb-3" style={{ color: 'var(--primary)' }}>
                How it works
              </p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">From sign in to show up, the flow stays simple.</h2>
              <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                FitMeet helps people discover, organise and actually get out the door. These are the moments worth
                showing on the front page.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {steps.map((item) => (
                <div key={item.step} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-full border"
                      style={{ borderColor: 'var(--border)', color: 'var(--primary)', background: 'rgba(57,255,20,0.08)' }}
                    >
                      {item.step}
                    </span>
                    <h3 className="font-semibold text-lg">{item.title}</h3>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {item.caption}
                  </p>
                  {item.panel}
                </div>
              ))}
            </div>
          </div>
        </section>

        <PublicStatsSection />

        <PublicCommentsSection />

        <section className="py-16 md:py-20">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div>
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--primary)' }}>
                  Built for real organising
                </p>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">More than event discovery.</h2>
                <p className="text-base leading-relaxed mb-6" style={{ color: 'var(--text-muted)' }}>
                  Once people join, the useful stuff kicks in: route sharing, reminders, notifications, friend invites
                  and now group conversations. That is the difference between a cool idea and something people actually
                  use.
                </p>

                <div
                  className="rounded-2xl border p-5"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(57,255,20,0.08)' }}
                    >
                      <Share2 size={18} style={{ color: 'var(--primary)' }} />
                    </div>
                    <div>
                      <p className="font-semibold">Shareable event pages</p>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        Public event sharing with route cover, date, time and sport details built in.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MiniStat label="Filters on hub" value="Interests, radius, going, friends, my" />
                    <MiniStat label="Event extras" value="GPX, share, cancel flow, reminders" />
                    <MiniStat label="Messaging" value="Direct chat and group conversations" />
                    <MiniStat label="Notifications" value="Email + in-app updates that stick" />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {highlights.map(({ icon: Icon, title, description }) => (
                  <div
                    key={title}
                    className="rounded-2xl border p-6"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                      style={{ background: 'rgba(57,255,20,0.1)' }}
                    >
                      <Icon size={20} style={{ color: 'var(--primary)' }} />
                    </div>
                    <h3 className="font-bold text-xl mb-2">{title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

    </>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
      <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

function LoginShot() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/welcome1.jpeg"
      alt="FitMeet welcome screen"
      className="w-full rounded-[28px] object-cover"
      style={{ boxShadow: '0 18px 48px rgba(0,0,0,0.28)' }}
    />
  )
}

function EventShot() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/create1.jpg"
      alt="Create event screen"
      className="w-full rounded-[28px] object-cover"
      style={{ boxShadow: '0 18px 48px rgba(0,0,0,0.28)' }}
    />
  )
}

function FriendsShot() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/invite1.jpg"
      alt="Invite friends screen"
      className="w-full rounded-[28px] object-cover"
      style={{ boxShadow: '0 18px 48px rgba(0,0,0,0.28)' }}
    />
  )
}

function FieldMock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-3 py-3" style={{ background: 'var(--background)' }}>
      <p className="text-[11px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

function Bubble({ text, mine = false }: { text: string; mine?: boolean }) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[82%] px-3.5 py-2.5 text-sm"
        style={{
          borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: mine ? 'var(--primary)' : 'var(--background)',
          color: mine ? '#000' : 'var(--text-primary)',
        }}
      >
        {text}
      </div>
    </div>
  )
}
