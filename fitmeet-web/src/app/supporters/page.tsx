import type { Metadata } from 'next'
import { Navbar } from '@/components/navbar'
import { SupportersClient } from './supporters-client'

export const metadata: Metadata = {
  title: 'Beer Wall of Fame — FitMeet',
  description: 'People who keep FitMeet free. Buy a beer and get your name on every screen.',
  openGraph: {
    title: 'Beer Wall of Fame — FitMeet 🍺',
    description: 'People who keep FitMeet free. Buy a beer and get your name on every screen.',
  },
}

export default function SupportersPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <SupportersClient />
      </main>
    </>
  )
}
