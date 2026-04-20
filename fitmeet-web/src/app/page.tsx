import { Navbar } from '@/components/navbar'
import { HeroMap } from '@/components/hero-map'
import { MapPin, Users, Zap, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const categories = [
  { emoji: '🏃', label: 'Running', value: 'running' },
  { emoji: '🚴', label: 'Cycling', value: 'cycling' },
  { emoji: '🥾', label: 'Hiking', value: 'hiking' },
  { emoji: '🏊', label: 'Swimming', value: 'swimming' },
  { emoji: '⚽', label: 'Football', value: 'football' },
  { emoji: '🎉', label: 'Party', value: 'party' },
  { emoji: '😎', label: 'Chill', value: 'chill' },
  { emoji: '🧘', label: 'Yoga', value: 'yoga' },
  { emoji: '🏔️', label: 'Climbing', value: 'climbing' },
  { emoji: '🏕️', label: 'Camping', value: 'camping' },
]

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">

        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full blur-3xl pointer-events-none opacity-20"
            style={{ background: 'radial-gradient(ellipse, #39ff14 0%, transparent 70%)' }}
          />

          <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-10 text-center">
            <div
              className="inline-flex items-center gap-2 border rounded-full px-4 py-1.5 text-sm mb-8"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', background: 'var(--surface)' }}
            >
              <Zap size={13} fill="currentColor" style={{ color: 'var(--primary)' }} />
              Local events. Real people.
            </div>

            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-5 leading-tight">
              Find your people.<br />
              <span style={{ color: 'var(--primary)' }}>Move together.</span>
            </h1>
            <p className="text-lg max-w-lg mx-auto mb-10 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Discover running groups, cycling rides, hiking trips, parties and more — happening right around you.
            </p>

            <div className="flex gap-3 justify-center flex-wrap mb-16">
              <Link
                href="/events"
                className="btn-primary inline-flex items-center gap-2 px-8 py-3.5 rounded-xl active:scale-95 transition-transform"
              >
                Explore Events <ArrowRight size={16} />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 border font-semibold px-8 py-3.5 rounded-xl transition-colors hover:opacity-80"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              >
                Get Started
              </Link>
            </div>

            <HeroMap />
          </div>
        </section>

        {/* Categories */}
        <section className="max-w-6xl mx-auto px-4 py-12">
          <div className="flex flex-wrap gap-3 justify-center">
            {categories.map(({ emoji, label, value }) => (
              <Link
                key={value}
                href={`/events?category=${value}`}
                className="inline-flex items-center gap-2 border px-4 py-2 rounded-full text-sm font-medium transition-all"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-primary)' }}
              >
                <span>{emoji}</span> {label}
              </Link>
            ))}
          </div>
        </section>

        {/* Pillars */}
        <section className="max-w-6xl mx-auto px-4 pb-28 grid md:grid-cols-3 gap-5">
          {[
            { icon: MapPin, title: 'Discover', desc: 'Find events near you filtered by sport, category and skill level. See them on a live map.' },
            { icon: Users, title: 'Meet', desc: 'Connect with people who share your passions. Build your local crew one event at a time.' },
            { icon: Zap, title: 'Move', desc: 'From casual walks to competitive rides — find the perfect activity for your level.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border p-7"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: 'rgba(57,255,20,0.1)' }}>
                <Icon size={22} style={{ color: 'var(--primary)' }} />
              </div>
              <h3 className="font-bold text-xl mb-2">{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
            </div>
          ))}
        </section>

      </main>

      <footer className="border-t py-8 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        © 2026 FitMeet · Find your people. Move together.
      </footer>
    </>
  )
}
