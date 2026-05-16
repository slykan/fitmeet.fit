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

export const revalidate = 60

async function getDonors() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'https://api.fitmeet.fit/api'}/beer-donations?limit=200`,
      { next: { revalidate: 60 } }
    )
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function SupportersPage() {
  const donors = await getDonors()

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <SupportersClient initialDonors={donors} />
      </main>
    </>
  )
}
