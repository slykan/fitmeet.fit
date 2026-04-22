'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { useAuthStore } from '@/store/auth'

const HubMap = dynamic(() => import('@/components/hub-map'), { ssr: false })

export default function HubPage() {
  const { token } = useAuthStore()
  const router    = useRouter()

  useEffect(() => {
    if (!token) router.replace('/login')
  }, [token, router])

  if (!token) return null

  return (
    <>
      <Navbar />
      <div style={{ height: 'calc(100vh - 64px)' }}>
        <HubMap />
      </div>
    </>
  )
}
