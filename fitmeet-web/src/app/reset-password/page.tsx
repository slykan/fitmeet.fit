'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff } from 'lucide-react'

import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ResetPasswordForm {
  password: string
  password_confirmation: string
}

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const email = searchParams.get('email') ?? ''
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ResetPasswordForm>()

  async function onSubmit(data: ResetPasswordForm) {
    setMessage(null)
    setError(null)

    if (!token || !email) {
      setError('This reset link is invalid or incomplete.')
      return
    }

    try {
      const { data: res } = await api.post('/auth/reset-password', {
        token,
        email,
        password: data.password,
        password_confirmation: data.password_confirmation,
      })
      setMessage(res.message ?? 'Password has been reset. You can sign in now.')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
      const msg =
        e?.response?.data?.message ??
        Object.values(e?.response?.data?.errors ?? {})[0]?.[0] ??
        'Could not reset password. Please request a new link.'
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
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Choose a new password</p>
        </div>

        <div className="border rounded-2xl p-8 flex flex-col gap-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-1">Reset password</h2>
            <p className="text-sm break-words" style={{ color: 'var(--text-muted)' }}>{email || 'Invalid reset link'}</p>
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
              <div className="relative">
                <input
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 8, message: 'Minimum 8 characters' },
                  })}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="New password"
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

            <div>
              <input
                {...register('password_confirmation', {
                  required: 'Please confirm your password',
                  validate: val => val === watch('password') || 'Passwords do not match',
                })}
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                className={inputCls(!!errors.password_confirmation)}
              />
              {errors.password_confirmation && <p className="text-red-400 text-xs mt-1">{errors.password_confirmation.message}</p>}
            </div>

            <Button type="submit" size="lg" loading={isSubmitting} disabled={!token || !email} className="w-full mt-1">
              Reset password
            </Button>
          </form>

          <p className="text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            Back to{' '}
            <Link href="/login" className="font-semibold" style={{ color: 'var(--primary)' }}>
              sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
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
