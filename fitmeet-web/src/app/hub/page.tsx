'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { useAuthStore } from '@/store/auth'

const HubMap = dynamic(() => import('@/components/hub-map'), { ssr: false })

export default function HubPage() {
  const { token, hasHydrated } = useAuthStore()
  const router    = useRouter()

  useEffect(() => {
    if (!hasHydrated) return
    if (!token) router.replace('/login')
  }, [hasHydrated, token, router])

  if (!hasHydrated || !token) return null

  return (
    <>
      <Navbar />
      <style>{`
        .hub-page-shell {
          height: calc(100dvh - 64px - var(--beer-ticker-h, 0px));
        }

        @supports not (height: 100dvh) {
          .hub-page-shell {
            height: calc(100vh - 64px - var(--beer-ticker-h, 0px));
          }
        }

        @media (max-width: 767px) {
          .hub-page-shell {
            height: calc(100svh - 64px - var(--beer-ticker-h, 0px));
          }
        }
      `}</style>
      <div className="hub-page-shell">
        <HubMap />
      </div>
    </>
  )
}
