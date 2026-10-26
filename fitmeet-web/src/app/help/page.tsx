import Link from 'next/link'
import { ArrowRight, LifeBuoy } from 'lucide-react'
import type { Metadata } from 'next'

import { AdSense } from '@/components/adsense'
import { Navbar } from '@/components/navbar'

export const metadata: Metadata = {
  title: 'Help Centre — FitMeet FAQ',
  description: 'Answers to common questions about FitMeet: events and check-in, syncing trainings from Strava and HUAWEI Health, the AI coach, Health and food log, the marketplace, privacy and your account.',
  alternates: { canonical: 'https://fitmeet.fit/help/' },
}

const FAQ: { group: string; items: { q: string; a: string }[] }[] = [
  { group: 'Getting started', items: [
    { q: 'What is FitMeet?', a: 'FitMeet is a free app and website for finding people to do sport with near you. You can discover and join local events — runs, rides, hikes, workouts and social meetups — create your own, share routes, sync your trainings and get an AI coach\'s view on them.' },
    { q: 'Is FitMeet free?', a: 'Yes. Creating an account, joining and creating events, routes, the marketplace and training sync are free. The AI coach and food estimates have a generous monthly allowance. Supporters can buy the team a "beer" to help keep it free.' },
    { q: 'Where can I use it?', a: 'On the web at fitmeet.fit and in the FitMeet apps for Android (Google Play and HUAWEI AppGallery) and iPhone. Your account, events and data are the same everywhere.' },
  ] },
  { group: 'Events', items: [
    { q: 'How do I find events near me?', a: 'Open Meet and set your location. You will see upcoming events around you, filtered by sport and distance, on a list or a map. Tap an event to see the route, time, organiser and who is going.' },
    { q: 'How do I create an event?', a: 'In Meet, tap the + button, choose the sport, set the start point, date and time, and optionally draw or import a route (GPX). You can make it public or only for friends. People who join get reminders and live updates.' },
    { q: 'What is check-in?', a: 'At the start of an event, participants check in to confirm they are there. With automatic check-in turned on, the app checks you in when you arrive within about 200 metres of the start point. Check-ins count towards badges and community ranks.' },
  ] },
  { group: 'Trainings and the AI coach', items: [
    { q: 'Which apps can I sync trainings from?', a: 'Strava and HUAWEI Health. Connect them in Profile › Connected apps. New activities are imported automatically; you can also choose whether friends see your trainings in their feed.' },
    { q: 'My HUAWEI Health sync says it is paused. What do I do?', a: 'This usually means data sharing is switched off for FitMeet in HUAWEI Health. Our step-by-step guide shows where to turn it back on for iPhone and Android.' },
    { q: 'What does the AI coach do?', a: 'Open any of your trainings to see charts and a short analysis written for that session, and ask follow-up questions. Weekly and monthly reports summarise your training load and suggest what to do next. Only you see your analyses.' },
  ] },
  { group: 'Health and food', items: [
    { q: 'What is the Health tab?', a: 'Health shows your basal metabolic rate and an estimate of everything you burned — walking and trainings included — next to what you ate. Fill in your health data once (sex, weight, height and optionally body fat, average steps, FTP and a goal) in Profile › Health settings.' },
    { q: 'How does the food log work?', a: 'Tap Add meal and describe what you ate in your own words. The AI estimates calories, protein, carbs and fat; you can correct the total before saving. Quick drink buttons and "Repeat" for meals you had before are free and don\'t use your monthly estimates.' },
    { q: 'Who can see my health data?', a: 'Only you. Health data and food logs are never shown on your public profile or to other users, and they are used only to calculate your numbers and to give your AI coach context.' },
  ] },
  { group: 'Marketplace', items: [
    { q: 'How do I buy or sell sports gear?', a: 'Browse listings on the Marketplace without an account. To post a listing or contact a seller, sign in, add photos, price and condition, and your listing goes live straight away. Mark it as sold when you are done.' },
    { q: 'How do I trade safely?', a: 'Meet in a public place, inspect the item before paying, avoid paying strangers in advance, and be wary of prices that look too good to be true. If something looks wrong, report it to us via the contact page.' },
  ] },
  { group: 'Privacy and account', items: [
    { q: 'How do I report or block someone?', a: 'Open their profile or the content you want to report and use Report or Block. Our team reviews reports, and blocked users can no longer see you or contact you.' },
    { q: 'Can I download or delete my data?', a: 'Yes. In Settings you can export all your data, and you can delete your account at any time, which removes your profile and personal data.' },
    { q: 'How do I contact the FitMeet team?', a: 'Use the contact page or the chat bubble on the website. We usually reply within one business day.' },
  ] },
]

export default function HelpPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.flatMap(g => g.items.map(i => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } }))),
  }
  return (
    <>
      <Navbar />
      <AdSense />
      <main className="flex-1">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <div className="max-w-3xl mx-auto px-4 py-14 md:py-20">
          <p className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--primary)' }}><LifeBuoy size={16} /> Help Centre</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">How can we help?</h1>
          <p className="text-lg mb-10" style={{ color: 'var(--text-muted)' }}>
            Answers to the most common questions about FitMeet. Can&apos;t find yours? <Link href="/contact" className="underline" style={{ color: 'var(--primary)' }}>Contact us</Link>.
          </p>

          <div className="space-y-10">
            {FAQ.map(g => (
              <section key={g.group}>
                <h2 className="text-xl font-bold mb-4">{g.group}</h2>
                <div className="space-y-3">
                  {g.items.map(i => (
                    <details key={i.q} className="rounded-2xl border p-4 group" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} open>
                      <summary className="font-semibold cursor-pointer list-none">{i.q}</summary>
                      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{i.a}</p>
                      {i.q.startsWith('My HUAWEI') && (
                        <Link href="/help/huawei-health" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--primary)' }}>HUAWEI Health guide <ArrowRight size={13} /></Link>
                      )}
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'rgba(57,255,20,0.16)' }}>
            <p className="font-bold text-lg mb-2">Learn more about training</p>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Practical guides on heart-rate zones, calories, FTP and running paces, plus free calculators.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/guides" className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold">Guides <ArrowRight size={14} /></Link>
              <Link href="/tools" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: 'var(--border)' }}>Calculators</Link>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
