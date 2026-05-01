import Link from 'next/link'
import { Navbar } from '@/components/navbar'

const sections = [
  {
    title: 'Zero Tolerance Policy',
    body: 'FitMeet has a strict zero-tolerance policy toward any content, behaviour, or conduct that sexualises, exploits, or endangers children. Any user found engaging in such activity will be permanently banned and reported to the relevant authorities without exception.',
  },
  {
    title: 'Prohibited Content and Conduct',
    body: 'The following are strictly prohibited on FitMeet: sharing, uploading, or distributing any content that sexually exploits minors; grooming, soliciting, or attempting to communicate with minors for inappropriate purposes; using FitMeet events, messages, or features to facilitate harm to children in any form.',
  },
  {
    title: 'Reporting Mechanisms',
    body: 'All users can report suspicious profiles, messages, or events directly through the app. Reports are reviewed promptly. If you suspect a child is in immediate danger, contact local law enforcement immediately. You may also report concerns to the FitMeet team via the contact details below.',
  },
  {
    title: 'Platform Safeguards',
    body: 'FitMeet requires account registration and monitors platform activity to detect and prevent misuse. We cooperate fully with law enforcement agencies and child protection organisations when required. Content identified as child sexual abuse material (CSAM) is removed immediately and reported to the National Center for Missing and Exploited Children (NCMEC) and applicable authorities.',
  },
  {
    title: 'User Responsibility',
    body: 'All FitMeet users are required to comply with these standards as a condition of use. By using FitMeet, users agree not to engage in any conduct that exploits or endangers children. Violations result in immediate account termination and may result in legal action.',
  },
  {
    title: 'Contact and Reporting',
    body: 'To report child safety concerns or CSAE-related content, contact us at: support@fitmeet.fit. We review all reports seriously and act swiftly to protect children on our platform.',
  },
]

export default function CsaePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 py-10">
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div className="mb-8">
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--primary)' }}>
              FitMeet Policy
            </p>
            <h1 className="text-4xl font-bold mb-4">Child Safety Standards</h1>
            <p className="text-base leading-relaxed max-w-2xl" style={{ color: 'var(--text-muted)' }}>
              FitMeet is committed to maintaining a safe environment for all users. This page outlines our standards
              against child sexual abuse and exploitation (CSAE) in accordance with platform policy requirements.
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
            <h2 className="text-xl font-semibold mb-3">Questions or Reports</h2>
            <p className="text-sm leading-7 mb-4" style={{ color: 'var(--text-muted)' }}>
              If you have questions about these standards or need to report a concern related to child safety,
              please contact us at{' '}
              <a href="mailto:support@fitmeet.fit" style={{ color: 'var(--primary)' }}>
                support@fitmeet.fit
              </a>
              . We take every report seriously.
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
