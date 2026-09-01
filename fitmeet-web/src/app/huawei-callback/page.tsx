'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

export default function HuaweiCallbackPage() {
  const router = useRouter()
  const { token } = useAuthStore()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code  = params.get('code')
    const error = params.get('error')

    if (error || !code) {
      router.replace(`/profile?huawei_error=${error ?? '1'}`)
      return
    }

    const storedToken = token ?? JSON.parse(localStorage.getItem('fitmeet-auth') ?? '{}')?.state?.token
    if (!storedToken) { router.replace('/login'); return }

    api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
    api.post('/huawei/connect', { code })
      .then(() => router.replace('/profile?huawei_connected=1'))
      .catch(() => router.replace('/profile?huawei_error=1'))
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#050816',
      color: '#fff',
      fontFamily: 'sans-serif',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ fontSize: 18, color: '#C7000B', fontWeight: 900, letterSpacing: 1 }}>HUAWEI HEALTH</div>
      <p style={{ color: '#aaa', fontSize: 15 }}>Connecting...</p>
    </div>
  )
}
