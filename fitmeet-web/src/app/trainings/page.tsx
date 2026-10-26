import type { Metadata } from 'next'

import { FolderRedirect } from '@/components/folder-redirect'

// /trainings/ only holds sub-pages; this index avoids a server directory listing.
export const metadata: Metadata = { robots: { index: false, follow: true } }

export default function Page() {
  return <FolderRedirect to="/notifications" label="your trainings" />
}
