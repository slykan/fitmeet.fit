import Link from 'next/link'

export function Footer() {
  return (
    <footer
      className="border-t mt-auto"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <div
        className="max-w-6xl mx-auto px-4 py-5 flex flex-wrap items-center justify-between gap-3 text-xs"
        style={{ color: 'var(--text-muted)' }}
      >
        <span>© {new Date().getFullYear()} FitMeet. All rights reserved.</span>
        <div className="flex items-center gap-5">
          <Link
            href="/privacy"
            className="hover:underline transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            Privacy Policy
          </Link>
          <Link
            href="/csae"
            className="hover:underline transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            Child Safety
          </Link>
        </div>
      </div>
    </footer>
  )
}
