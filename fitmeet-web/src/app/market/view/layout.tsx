import type { Metadata } from 'next'

// ?id= stranica samo preusmjerava na javnu stranicu (prerenderirana /<id>/ ili /share/?id=) — ne ide u Google.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function ViewLayout({ children }: { children: React.ReactNode }) {
  return children
}
