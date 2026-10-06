import Link from 'next/link'

import { Navbar } from '@/components/navbar'

// When this text changes materially, bump User::TERMS_VERSION in the API so signed-in
// users are asked to accept it again (TermsConsentGate on web, consent screen in the app).
const LAST_UPDATED = '6 October 2026'

type Section = { id?: string; title: string; body?: string; items?: string[] }

const sections: Section[] = [
  {
    title: 'Who We Are',
    body: 'FitMeet (the FitMeet app for Android and iOS and the website fitmeet.fit) is operated by On Click, obrt za računalne djelatnosti, Croatia, which is the controller of your personal data. Contact: support@fitmeet.fit.',
  },
  {
    title: 'What FitMeet Collects',
    body: 'FitMeet stores the account details you choose to provide, such as your name, email address, profile photo, interests, home area, event activity, messages, and notification preferences. If you upload routes or GPX files, those are stored as part of the event you create. If you connect a training app (see below), FitMeet also stores the completed workouts imported from it.',
  },
  {
    title: 'Why We Use It',
    body: 'We use this information to help you discover nearby events, join activities, create your own events, invite friends, chat with other participants, keep your training history, and receive reminders or event updates. We also use it to keep the platform working safely and reliably. Each type of data is used only for the purpose described in its section of this policy.',
  },
  {
    id: 'huawei-health',
    title: 'HUAWEI Health Data',
    body: 'If you choose to connect HUAWEI Health under Connected apps, FitMeet reads your completed workouts from HUAWEI Health so they appear automatically in your FitMeet training history, next to trainings from other connected apps (duplicates are merged). Nothing is read before you authorize FitMeet on the HUAWEI ID consent screen, and FitMeet never writes data to HUAWEI Health.',
    items: [
      'Data types read (permissions "Activity record" and "Activity", read-only): workout records — type of activity, start and end time, active duration, distance, calories burned, heart-rate statistics (average, maximum, minimum), speed statistics and step count, plus your HUAWEI ID identifier to link the account.',
      'Purpose: to import your completed workouts into your FitMeet training history and statistics. Each data type is used only to display that workout\'s details (e.g. distance and duration for progress, heart rate and calories for the workout summary).',
      'FitMeet does not use HUAWEI Health data for advertising, does not sell it, and does not share it with third parties.',
      'Not medical: HUAWEI Health Service Kit is not a medical device. Data obtained through it is for general fitness reference only and must not be used for medical diagnosis or treatment.',
      'Your control: you can disconnect HUAWEI Health at any time in FitMeet (Profile or Settings › Connected apps › Disconnect) or cancel FitMeet\'s authorization in the HUAWEI Health app. When you disconnect in FitMeet, you choose whether workouts already imported are kept or deleted. After authorization is cancelled FitMeet reads no further data, and the app asks you to reconnect if you want to resume syncing.',
    ],
  },
  {
    title: 'Other Connected Apps',
    body: 'If you connect Strava, FitMeet reads your completed activities in the same way and for the same purpose as described for HUAWEI Health. You can disconnect it at any time under Connected apps.',
  },
  {
    title: 'Who Can See Your Trainings',
    body: 'Your trainings are visible to you. Unless you turn off "Share trainings in feed" in Settings, your FitMeet friends can also see your trainings in their activity feed. Trainings are never shown on public pages.',
  },
  {
    title: 'Location and Event Data',
    body: 'Your location-related settings help FitMeet show relevant events near you. Event locations, categories, route details, joined participants, and organiser information may be visible to other users inside the app depending on the event and sharing flow.',
  },
  {
    title: 'Messages and Notifications',
    body: 'Messages, group conversations, reminder settings, and notification history are stored so chats, unread indicators, reminders, and event updates work as expected. Email notifications are only sent when enabled in your profile settings.',
  },
  {
    title: 'Sharing and Public Pages',
    body: 'If an event is shared publicly, FitMeet may display a limited public event page with safe event details such as title, time, sport, route preview, and meeting area. Private events are not intended for public viewing.',
  },
  {
    title: 'Where Data Is Stored and For How Long',
    items: [
      'Storage location: all FitMeet data, including workouts imported from HUAWEI Health, is stored on FitMeet\'s own servers in Germany (European Union). Nothing is stored on your device beyond what the app needs to work (such as your sign-in session).',
      'Cross-border transfer: FitMeet does not transfer your HUAWEI Health data outside the European Union. Push notifications are delivered through the platform services of your phone (Google / Apple, via Expo), which may process limited technical data, such as a device token and the notification text, outside the EU under the safeguards those providers offer.',
      'Retention: your data is kept while your account exists. Deleting your account deletes your profile, trainings (including imported HUAWEI Health workouts), connected apps and other personal data from our database immediately, and revokes FitMeet\'s HUAWEI Health authorization.',
    ],
  },
  {
    title: 'How We Protect Your Data',
    items: [
      'All traffic between the app or website and our servers is encrypted (HTTPS/TLS), including any transfer to services we work with.',
      'Access tokens for connected apps (HUAWEI Health, Strava) are stored encrypted. Workout and account data is stored in a database that is not publicly reachable and is accessible only to the FitMeet service and its administrators.',
      'Our system logs do not record your personal data or workout contents.',
      'Every time you authorize or cancel access for a connected app, we keep a record (which app, what, when) so authorization decisions are traceable. These records are included in your data export.',
    ],
  },
  {
    id: 'your-rights',
    title: 'Your Control and Rights',
    items: [
      'Access and export: download a copy of all personal data FitMeet stores about you under Profile › Your data › Download my data (web) or Settings › Download my data (app).',
      'Correction: update your profile information, notification preferences, avatar and event participation from inside the app.',
      'Revoke: disconnect any connected app at any time; FitMeet stops reading its data immediately.',
      'Deletion: delete your account under Profile › Danger zone (web) or Settings › Delete account (app). This removes all your personal data as described above.',
      'For any other request, or to lodge a complaint, contact support@fitmeet.fit. You also have the right to lodge a complaint with the Croatian data protection authority (AZOP).',
    ],
  },
  {
    title: 'Consent and Changes',
    body: 'You accept the Terms of Service and this Privacy Policy when creating an account; FitMeet cannot be used without accepting them. Connecting a training app additionally requires your explicit authorization on that provider\'s consent screen. If we change this policy materially, we will ask you to review and accept it again before you continue using FitMeet.',
  },
  {
    title: 'Marketplace Listings — Disclaimer',
    body: 'FitMeet provides a marketplace feature that allows users to post and browse listings for sports equipment and related items. FitMeet acts solely as a platform connecting buyers and sellers and is not a party to any transaction. FitMeet does not verify the accuracy of listings, the condition of items, the identity of users beyond basic registration, or the completion of any sale. All transactions, including the agreed price, method of payment, and method of pickup or delivery, are arranged exclusively between the buyer and seller. FitMeet assumes no responsibility or liability for any loss, damage, dispute, fraud, or harm arising from a transaction between users. Users are advised to exercise caution, meet in safe public locations, and inspect items before completing a purchase.',
  },
]

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 py-10">
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div className="mb-8">
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--primary)' }}>
              FitMeet Policy
            </p>
            <h1 className="text-4xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-base leading-relaxed max-w-2xl" style={{ color: 'var(--text-muted)' }}>
              This page explains, in plain language, what FitMeet stores, why, where and for how long, and how you stay in control of it.
            </p>
            <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>Last updated: {LAST_UPDATED}</p>
          </div>

          <div className="space-y-4">
            {sections.map((section) => (
              <section
                key={section.title}
                id={section.id}
                className="rounded-2xl border p-6 scroll-mt-24"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <h2 className="text-xl font-semibold mb-3">{section.title}</h2>
                {section.body && (
                  <p className="text-sm leading-7" style={{ color: 'var(--text-muted)' }}>
                    {section.body}
                  </p>
                )}
                {section.items && (
                  <ul className="mt-3 space-y-2 list-disc pl-5 text-sm leading-7" style={{ color: 'var(--text-muted)' }}>
                    {section.items.map(item => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <div
            className="mt-8 rounded-2xl border p-6"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <h2 className="text-xl font-semibold mb-3">Questions</h2>
            <p className="text-sm leading-7 mb-4" style={{ color: 'var(--text-muted)' }}>
              For questions about privacy, your account data, or content removal, contact us at support@fitmeet.fit.
            </p>
            <Link href="/" className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>
              Back to FitMeet
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
