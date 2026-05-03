'use client'

import { useEffect } from 'react'

export default function StravaCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code  = params.get('code')
    const error = params.get('error')

    if (error || !code) {
      window.location.href = '/'
      return
    }

    window.location.href = `fitmeet://strava-callback?code=${encodeURIComponent(code)}`
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
      <div style={{ fontSize: 32 }}>🚴</div>
      <p style={{ color: '#aaa', fontSize: 15 }}>Redirecting back to FitMeet...</p>
    </div>
  )
}
