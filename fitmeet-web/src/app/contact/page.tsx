import type { Metadata } from 'next'
import { Mail, MessageSquare, HelpCircle } from 'lucide-react'
import { Navbar } from '@/components/navbar'

export const metadata: Metadata = {
  title: 'Support — FitMeet',
  description: 'Get help with FitMeet. Contact our support team.',
}

const topics = [
  {
    icon: HelpCircle,
    title: 'General questions',
    description: 'How the app works, account setup, features and anything else.',
  },
  {
    icon: MessageSquare,
    title: 'Report a problem',
    description: 'Bug, unexpected behaviour, or something that does not load correctly.',
  },
  {
    icon: Mail,
    title: 'Account or billing',
    description: 'Account access, supporter badge, subscription or payment issue.',
  },
]

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="py-16 md:py-24">
          <div className="max-w-2xl mx-auto px-4">
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--primary)' }}>
              Support
            </p>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">How can we help?</h1>
            <p className="text-base leading-relaxed mb-10" style={{ color: 'var(--text-muted)' }}>
              Reach out to the FitMeet team for any questions, issues or feedback. We typically reply within one business day.
            </p>

            <div className="grid gap-4 mb-10">
              {topics.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="flex gap-4 rounded-2xl border p-5"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div
                    className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(57,255,20,0.1)' }}
                  >
                    <Icon size={18} style={{ color: 'var(--primary)' }} />
                  </div>
                  <div>
                    <p className="font-semibold mb-1">{title}</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div
              className="rounded-2xl border p-6"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p className="font-semibold mb-1">Send us an email</p>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                Drop a message with your username or registered email so we can find your account faster.
              </p>
              <a
                href="mailto:fit@fitmeet.fit"
                className="btn-primary inline-flex items-center gap-2 px-6 py-3 rounded-xl transition-opacity hover:opacity-85"
              >
                <Mail size={15} />
                fit@fitmeet.fit
              </a>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
