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
      <div style={{ height: 'calc(100vh - 64px)' }}>
        <HubMap />
      </div>
    </>
  )
}
