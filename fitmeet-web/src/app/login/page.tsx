'use client'

import { useAuthStore } from '@/store/auth'
import api from '@/lib/api'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { Button } from '@/components/ui/button'

function LoginContent() {
  const { setAuth, user } = useAuthStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) return

    setLoading(true)
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`

    api.get('/me')
      .then(({ data }) => {
        setAuth(token, data.data)
        router.replace(data.data.onboarding_complete ? '/' : '/onboarding')
      })
      .catch(() => setError('Authentication failed. Please try again.'))
      .finally(() => setLoading(false))
  }, [searchParams, setAuth, router])

  useEffect(() => {
    if (user) router.replace(user.onboarding_complete ? '/' : '/onboarding')
  }, [user, router])

  async function handleGoogleLogin() {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/auth/google')
      window.location.href = data.url
    } catch {
      setError('Could not connect to server. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ color: 'var(--primary)' }}>FITMEET</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Find your people. Move together.</p>
        </div>

        <div className="border rounded-2xl p-8 flex flex-col gap-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-1">Welcome</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sign in to discover events near you</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <Button size="lg" onClick={handleGoogleLogin} loading={loading} className="w-full gap-3">
            {!loading && (
              <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Continue with Google
          </Button>

          <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
