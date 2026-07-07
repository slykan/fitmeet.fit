import Link from 'next/link'
import { Navbar } from '@/components/navbar'

const sections = [
  {
    title: 'Acceptance of Terms',
    body: 'By creating a FitMeet account or using the FitMeet app or website, you agree to these Terms of Use and to our Privacy Policy. If you do not agree, please do not register or use FitMeet.',
  },
  {
    title: 'Zero Tolerance for Objectionable Content and Abusive Behaviour',
    body: 'FitMeet has zero tolerance for objectionable content and abusive users. This includes harassment, hate speech, threats, spam, and any content that is illegal, sexually exploitative, or otherwise harmful to other members of the community. Violating this policy results in content removal and, where appropriate, permanent account suspension.',
  },
  {
    title: 'Reporting and Blocking',
    body: 'Every user can report objectionable content or behaviour directly from within the app — on profiles, comments, marketplace listings, event photos, and messages. Users can also block another user at any time; blocking immediately hides that user’s content from your feeds and prevents them from messaging you. Reports are reviewed by our team, and confirmed violations are actioned — removing the content and suspending the offending account — within 24 hours.',
  },
  {
    title: 'User Conduct',
    body: 'You are responsible for the content you post and the way you interact with other members. You agree not to impersonate others, misuse the marketplace or event features, or use FitMeet to harm, harass, or endanger anyone.',
  },
  {
    title: 'Account Suspension',
    body: 'FitMeet may suspend or terminate accounts that violate these Terms, without prior notice, including accounts responsible for reported objectionable content or abusive behaviour.',
  },
  {
    title: 'Changes to These Terms',
    body: 'We may update these Terms from time to time. Continued use of FitMeet after changes are published means you accept the updated Terms.',
  },
]

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen px-4 py-10">
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div className="mb-8">
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--primary)' }}>
              FitMeet Policy
            </p>
            <h1 className="text-4xl font-bold mb-4">Terms of Use</h1>
            <p className="text-base leading-relaxed max-w-2xl" style={{ color: 'var(--text-muted)' }}>
              These Terms of Use govern your access to and use of FitMeet. Please read them carefully.
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
              If you have questions about these Terms, contact us at{' '}
              <a href="mailto:support@fitmeet.fit" style={{ color: 'var(--primary)' }}>
                support@fitmeet.fit
              </a>
              .
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
