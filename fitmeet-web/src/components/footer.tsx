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
        <div className="flex flex-wrap items-center gap-3">
          <span>© {new Date().getFullYear()} FitMeet</span>
          <span>·</span>
          <span>Find your people. Move together.</span>
        </div>
        <div className="flex items-center gap-5">
          <Link
            href="/about"
            className="hover:underline transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            About
          </Link>
          <Link
            href="/contact"
            className="hover:underline transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            Support
          </Link>
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
      <div
        className="max-w-6xl mx-auto px-4 pb-4 text-xs text-center"
        style={{ color: 'var(--text-muted)', opacity: 0.45 }}
      >
        Powered by{' '}
        <a
          href="https://on-click.hr"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
          style={{ color: 'var(--text-muted)' }}
        >
          on-click.hr
        </a>
      </div>
    </footer>
  )
}
