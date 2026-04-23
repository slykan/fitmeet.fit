'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'

export function useRequireAuth() {
  const { token, user, hasHydrated } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!hasHydrated) return
    if (!token) {
      router.replace('/login')
      return
    }
    if (user && !user.onboarding_complete) {
      router.replace('/onboarding')
    }
  }, [hasHydrated, token, user, router])

  return { user, token, hasHydrated }
}
