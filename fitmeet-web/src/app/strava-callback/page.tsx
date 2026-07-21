'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'

export default function StravaCallbackPage() {
  const router = useRouter()
  const { token, setAuth } = useAuthStore()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code  = params.get('code')
    const state = params.get('state')
    const error = params.get('error')

    if (error || !code) {
      router.replace('/login')
      return
    }

    if (state === 'web-login') {
      // Web login flow: exchange code for FitMeet token
      api.post('/strava/login', { code })
        .then(({ data }) => {
          setAuth(data.token, data.data)
          router.replace(data.data.onboarding_complete ? '/hub' : '/onboarding')
        })
        .catch(() => router.replace('/login?error=strava_failed'))
      return
    }

    if (state === 'web-connect') {
      const storedToken = token ?? JSON.parse(localStorage.getItem('fitmeet-auth') ?? '{}')?.state?.token
      if (!storedToken) { router.replace('/login'); return }

      api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
      api.post('/strava/connect', { code })
        .then(() => router.replace('/profile?strava_connected=1'))
        .catch(() => router.replace('/profile?strava_error=1'))
      return
    }

    if (state === 'web-import' || state?.startsWith('web-import-edit-')) {
      // Web route import flow: need auth token
      const storedToken = token ?? JSON.parse(localStorage.getItem('fitmeet-auth') ?? '{}')?.state?.token
      if (!storedToken) { router.replace('/login'); return }

      const editId = state?.startsWith('web-import-edit-') ? state.replace('web-import-edit-', '') : null
      const returnPath = editId ? `/events/edit?id=${editId}` : '/events/create'

      api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`
      api.post('/strava/routes', { code })
        .then(({ data }) => {
          sessionStorage.setItem('strava_routes_pending', JSON.stringify({
            routes: data.data ?? [],
            importToken: data.import_token,
          }))
          router.replace(returnPath)
        })
        .catch(() => router.replace(returnPath + (returnPath.includes('?') ? '&' : '?') + 'strava_error=1'))
      return
    }

    // Mobile deep link fallback
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
      <div style={{ fontSize: 18, color: '#FC4C02', fontWeight: 900, letterSpacing: 1 }}>STRAVA</div>
      <p style={{ color: '#aaa', fontSize: 15 }}>Connecting...</p>
    </div>
  )
}
