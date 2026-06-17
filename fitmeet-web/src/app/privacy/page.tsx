import Link from 'next/link'

import { Navbar } from '@/components/navbar'

const sections = [
  {
    title: 'What FitMeet Collects',
    body: 'FitMeet stores the account details you choose to provide, such as your name, email address, profile photo, interests, home area, event activity, messages, and notification preferences. If you upload routes or GPX files, those are stored as part of the event you create.',
  },
  {
    title: 'Why We Use It',
    body: 'We use this information to help you discover nearby events, join activities, create your own events, invite friends, chat with other participants, and receive reminders or event updates. We also use it to keep the platform working safely and reliably.',
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
    title: 'Your Control',
    body: 'You can update your profile information, notification preferences, avatar, and event participation from inside the app. If you no longer want to use FitMeet, contact the FitMeet team to request account deletion or data removal support.',
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
              This page explains, in plain language, what FitMeet stores and why. It is written to help users understand
              how the app handles account, event, messaging, and notification data.
            </p>
          </div>

          <div className="space-y-4">
            {sections.map((section) => (
              <section
                key={section.title}
                className="rounded-2xl border p-6"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <h2 className="text-xl font-semibold mb-3">{section.title}</h2>
                <p className="text-sm leading-7" style={{ color: 'var(--text-muted)' }}>
                  {section.body}
                </p>
              </section>
            ))}
          </div>

          <div
            className="mt-8 rounded-2xl border p-6"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <h2 className="text-xl font-semibold mb-3">Questions</h2>
            <p className="text-sm leading-7 mb-4" style={{ color: 'var(--text-muted)' }}>
              If you need support about privacy, account data, or content removal, contact the FitMeet team through the
              project support channel or the contact details provided by the service owner.
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
