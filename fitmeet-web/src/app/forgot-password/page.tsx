'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ForgotPasswordForm {
  email: string
}

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordForm>()

  async function onSubmit(data: ForgotPasswordForm) {
    setMessage(null)
    setError(null)

    try {
      const { data: res } = await api.post('/auth/forgot-password', data)
      setMessage(res.message ?? 'Password reset link sent. Check your email.')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
      const msg =
        e?.response?.data?.message ??
        Object.values(e?.response?.data?.errors ?? {})[0]?.[0] ??
        'Could not send reset link. Please try again.'
      setError(msg)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            <span style={{ color: 'var(--text-primary)' }}>Fit</span>
            <span style={{ color: 'var(--primary)' }}>meet</span>
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Reset your password</p>
        </div>

        <div className="border rounded-2xl p-8 flex flex-col gap-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-1">Forgot password?</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Enter your email and we&apos;ll send a reset link.</p>
          </div>

          {message && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm rounded-xl px-4 py-3">
              {message}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

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

            <Button type="submit" size="lg" loading={isSubmitting} className="w-full mt-1">
              Send reset link
            </Button>
          </form>

          <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Remembered it?{' '}
            <Link href="/login" className="font-semibold" style={{ color: 'var(--primary)' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
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
