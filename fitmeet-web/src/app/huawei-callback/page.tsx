'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HuaweiCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')
    router.replace(code ? '/profile?huawei_connected=1' : `/profile?huawei_error=${error ?? '1'}`)
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
