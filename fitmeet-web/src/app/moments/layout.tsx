import type { Metadata } from 'next'

// Content here is loaded in the browser (user data), so the HTML is near-empty for crawlers:
// keep it out of search results (links still work and social previews still use the OG endpoint).
export const metadata: Metadata = {
  robots: { index: false, follow: true },
}

export default function NoIndexLayout({ children }: { children: React.ReactNode }) {
  return children
}
