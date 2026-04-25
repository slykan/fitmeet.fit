'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff } from 'lucide-react'
import Image from 'next/image'
import { useTheme } from 'next-themes'

import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LoginForm {
  email: string
  password: string
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

function LoginContent() {
  const { setAuth, user, hasHydrated } = useAuthStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setMounted(true), [])

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>()

  // Handle Google OAuth callback token
  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) return
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
    api.get('/me')
      .then(({ data }) => {
        setAuth(token, data.data)
        router.replace(data.data.onboarding_complete ? '/hub' : '/onboarding')
      })
      .catch(() => setError('Authentication failed. Please try again.'))
  }, [searchParams, setAuth, router])

  const redirect = searchParams.get('redirect')

  // Redirect if already logged in
  useEffect(() => {
    if (!hasHydrated) return
    if (user) router.replace(user.onboarding_complete ? (redirect || '/hub') : '/onboarding')
  }, [hasHydrated, user, router, redirect])

  async function onSubmit(data: LoginForm) {
    setError(null)
    try {
      const { data: res } = await api.post('/auth/login', data)
      setAuth(res.token, res.data)
      router.replace(res.data.onboarding_complete ? (redirect || '/hub') : '/onboarding')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Invalid email or password.')
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/auth/google')
      window.location.href = data.url
    } catch {
      setError('Could not connect to server. Please try again.')
      setGoogleLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-sm">

        <div className="text-center mb-10">
          {mounted && (
            <div className="flex justify-center mb-4">
              <Image
                src={theme === 'dark' ? '/logo_c.png' : '/logo_b.png'}
                alt="FitMeet"
                width={80}
                height={80}
                className="object-contain"
              />
            </div>
          )}
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            <span style={{ color: 'var(--text-primary)' }}>Fit</span>
            <span style={{ color: 'var(--primary)' }}>meet</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Find your people. Move together.</p>
        </div>

        <div className="border rounded-2xl p-8 flex flex-col gap-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-1">Welcome back</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sign in to your account</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Email / password */}
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div>
              <input
                {...register('email', { required: 'Email is required' })}
                type="email"
                placeholder="Email"
                className={inputCls(!!errors.email)}
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <div className="relative">
                <input
                  {...register('password', { required: 'Password is required' })}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  className={cn(inputCls(!!errors.password), 'pr-10')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <Button type="submit" size="lg" loading={isSubmitting} className="w-full mt-1">
              Sign in
            </Button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          {/* Google */}
          <Button variant="ghost" size="lg" onClick={handleGoogleLogin} loading={googleLoading} className="w-full gap-3 border">
            {!googleLoading && <GoogleIcon />}
            Continue with Google
          </Button>

          <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-semibold" style={{ color: 'var(--primary)' }}>
              Sign up
            </Link>
          </p>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-muted)' }}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
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

function inputCls(hasError: boolean) {
  return cn(
    'w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all',
    'bg-[--background] text-[--text-primary]',
    'focus:ring-1',
    hasError
      ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20'
      : 'border-[--border] focus:border-[--primary] focus:ring-[--primary]/20',
  )
}
