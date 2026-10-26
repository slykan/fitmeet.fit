'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Index page for folders that only hold sub-pages (e.g. /events/share/…): without it the
// server would show an "Index of /…" directory listing. Sends the visitor to the real page.
export function FolderRedirect({ to, label }: { to: string; label: string }) {
  const router = useRouter()
  useEffect(() => { router.replace(to) }, [router, to])
  return (
    <main className="flex-1 flex items-center justify-center py-24 px-4 text-sm" style={{ color: 'var(--text-muted)' }}>
      <p>Redirecting to <Link href={to} className="underline" style={{ color: 'var(--primary)' }}>{label}</Link>…</p>
    </main>
  )
}
