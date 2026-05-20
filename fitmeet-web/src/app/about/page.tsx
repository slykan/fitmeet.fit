import Link from 'next/link'
import { ArrowRight, Users } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { ShareButton } from '@/components/share-button'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About Us — FitMeet',
  description: 'FitMeet started from a garage, a few friends, and many conversations after training sessions. Learn how we are building a platform for local sports communities.',
}

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="py-16 md:py-20 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-3xl mx-auto px-4">
            <div className="flex items-center gap-3 mb-3">
              <Users size={18} style={{ color: 'var(--primary)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>About FitMeet</p>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Welcome to FitMeet</h1>
            <p className="text-lg leading-relaxed mb-6" style={{ color: 'var(--text-muted)' }}>
              Finding people for sports and activities is not always easy. Sometimes friends are busy, local groups
              are inactive, or motivation drops when training alone. That is where FitMeet comes in.
            </p>
            <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
              FitMeet is a simple platform for connecting people through activities, events, and movement. Users can
              create public or private meetups, join events nearby, and discover others with similar interests.
            </p>
            <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              The app is made for everyday people — not only professional athletes. Running, cycling, gym workouts,
              hiking, football, basketball, group fitness, casual walks, coffee after training… everything can
              become a meetup.
            </p>
          </div>
        </section>

        <section className="py-12 md:py-16 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-2xl font-bold mb-6">How it started</h2>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/fitmeet-garage.jpg"
              alt="FitMeet founders — the garage where it all started"
              className="w-full rounded-2xl object-cover mb-8"
              style={{ maxHeight: 480, boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }}
            />

            <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
              FitMeet started very simply. Literally from a garage, a few friends, and many conversations after
              training sessions.
            </p>
            <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
              A small group of enthusiasts who enjoy cycling, fitness, running, sports in general… and sometimes
              a beer as a reward after a good workout.
            </p>
            <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
              Most ideas behind the app come directly from our own experiences. Things we missed, things we wanted
              to organise faster, and things we believed could make local sports communities stronger and more
              active.
            </p>
            <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              We are building FitMeet step by step, together with the community.
            </p>
          </div>
        </section>

        <section className="py-12 md:py-16 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-2xl font-bold mb-6">What can you do on FitMeet?</h2>
            <div className="space-y-3">
              {[
                'Create sports and social events',
                'Join activities near your location',
                'Meet new people with similar interests',
                'Organise local training groups',
                'Stay motivated through community',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'rgba(57,255,20,0.12)' }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ background: 'var(--primary)' }} />
                  </div>
                  <p className="text-base" style={{ color: 'var(--text-muted)' }}>{item}</p>
                </div>
              ))}
            </div>
            <p className="text-base leading-relaxed mt-6 font-medium">
              The goal is simple: make activity more social and easier to start.
            </p>
          </div>
        </section>

        <section className="py-12 md:py-16 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-2xl font-bold mb-6">Who is FitMeet for?</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                'Beginners starting their fitness journey',
                'Active athletes looking for partners',
                'Local sports communities',
                'Travellers searching for activities in new cities',
                'Anyone who prefers moving together instead of alone',
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-xl border px-4 py-3 text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-muted)' }}
                >
                  {item}
                </div>
              ))}
            </div>
            <p className="text-base leading-relaxed mt-6" style={{ color: 'var(--text-muted)' }}>
              There are no complicated rules or systems. Open the app, find an event, join, and go.
            </p>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-2xl font-bold mb-4">Looking forward</h2>
            <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--text-muted)' }}>
              This is only the beginning. We want to continue improving the app, adding new ideas, and expanding
              the community over time.
            </p>
            <p className="text-base leading-relaxed mb-8" style={{ color: 'var(--text-muted)' }}>
              The best part of sport has always been the people around it. That is exactly what we want FitMeet
              to become.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/register"
                className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold"
              >
                Join FitMeet <ArrowRight size={14} />
              </Link>
              <ShareButton
                title="About FitMeet"
                text="FitMeet started from a garage, a few friends, and many conversations after training sessions."
                url="https://fitmeet.fit/about"
              />
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
