import type { Metadata } from 'next'
import { Space_Grotesk } from 'next/font/google'
import { BadgeUnlockOverlay } from '@/components/badge-unlock-overlay'
import { BeerTicker } from '@/components/beer-ticker'
import { Providers } from '@/components/providers'
import { Footer } from '@/components/footer'
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
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        {/* Google AdSense */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3054841074530422"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[--background] text-[--text-primary]">
        <Providers>
          <BeerTicker />
          <BadgeUnlockOverlay />
          {children}
        </Providers>
        <Footer />
        {/* Tawk.to live chat */}
        <script
          dangerouslySetInnerHTML={{
            __html: `var Tawk_API=Tawk_API||{},Tawk_LoadStart=new Date();(function(){var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];s1.async=true;s1.src='https://embed.tawk.to/5d3547899b94cd38bbe89079/1jp589ien';s1.charset='UTF-8';s1.setAttribute('crossorigin','*');s0.parentNode.insertBefore(s1,s0);})();`,
          }}
        />
      </body>
    </html>
  )
}
