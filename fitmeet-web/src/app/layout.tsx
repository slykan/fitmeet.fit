import type { Metadata } from 'next'
import { Space_Grotesk } from 'next/font/google'
import { Providers } from '@/components/providers'
import './globals.css'

const spaceGrotesk = Space_Grotesk({
  variable: '--font-space-grotesk',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://fitmeet.fit'),
  title: 'FitMeet — Find your people. Move together.',
  description: 'Discover and join local sports and social events near you.',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-[--background] text-[--text-primary]">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
