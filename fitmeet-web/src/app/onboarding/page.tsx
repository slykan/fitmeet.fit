'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Globe, MapPin, Navigation, Phone, User, Check, LocateFixed } from 'lucide-react'

import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const LocationPickerMap = dynamic(() => import('@/components/location-picker-map'), { ssr: false })

// ─── Constants ───────────────────────────────────────────────────────────────

const RADIUS_OPTIONS = [
  { value: 'nearby',    label: 'Nearby',    km: '50 km' },
  { value: 'city',      label: 'City',      km: '200 km' },
  { value: 'region',    label: 'Region',    km: '500 km' },
  { value: 'unlimited', label: 'Unlimited', km: '∞' },
] as const

const CATEGORIES = [
  { value: 'running',    emoji: '🏃', label: 'Running' },
  { value: 'cycling',    emoji: '🚴', label: 'Cycling' },
  { value: 'hiking',     emoji: '🥾', label: 'Hiking' },
  { value: 'swimming',   emoji: '🏊', label: 'Swimming' },
  { value: 'football',   emoji: '⚽', label: 'Football' },
  { value: 'basketball', emoji: '🏀', label: 'Basketball' },
  { value: 'tennis',     emoji: '🎾', label: 'Tennis' },
  { value: 'volleyball', emoji: '🏐', label: 'Volleyball' },
  { value: 'yoga',       emoji: '🧘', label: 'Yoga' },
  { value: 'fitness',    emoji: '💪', label: 'Fitness' },
  { value: 'skiing',     emoji: '⛷️',  label: 'Skiing' },
  { value: 'climbing',   emoji: '🏔️', label: 'Climbing' },
  { value: 'padel',      emoji: '🏓', label: 'Padel' },
  { value: 'party',      emoji: '🎉', label: 'Party' },
  { value: 'chill',      emoji: '😎', label: 'Chill' },
  { value: 'food_drinks',emoji: '🍕', label: 'Food & Drinks' },
  { value: 'camping',    emoji: '🏕️', label: 'Camping' },
  { value: 'beach',      emoji: '🏖️', label: 'Beach' },
  { value: 'kayaking',   emoji: '🚣', label: 'Kayaking' },
  { value: 'music',      emoji: '🎵', label: 'Music' },
]

const SKILL_OPTIONS = [
  { value: 'beginner', label: 'Beginner', desc: 'Just getting started' },
  { value: 'advanced', label: 'Advanced', desc: 'Regular practitioner' },
  { value: 'pro',      label: 'Pro',      desc: 'Expert level' },
] as const

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  name:         string
  phone:        string
  home_country: string
  home_city:    string
  home_lat:     number | null
  home_lng:     number | null
  radius:       'nearby' | 'city' | 'region' | 'unlimited'
  categories:   string[]
  skill_level:  'beginner' | 'advanced' | 'pro' | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { token, user, setUser } = useAuthStore()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      name:         user?.name         ?? '',
      phone:        user?.phone        ?? '',
      home_country: user?.home?.country ?? '',
      home_city:    user?.home?.city    ?? '',
      home_lat:     user?.home?.lat     ?? null,
      home_lng:     user?.home?.lng     ?? null,
      radius:       user?.radius        ?? 'nearby',
      categories:   user?.categories    ?? [],
      skill_level:  user?.skill_level   ?? null,
    },
  })

  useEffect(() => {
    if (!token) router.replace('/login')
  }, [token, router])

  const watchedLat        = watch('home_lat')
  const watchedLng        = watch('home_lng')
  const watchedRadius     = watch('radius')
  const watchedCategories = watch('categories')
  const watchedSkill      = watch('skill_level')

  function toggleCategory(value: string) {
    const current = watchedCategories
    setValue(
      'categories',
      current.includes(value) ? current.filter(c => c !== value) : [...current, value],
    )
  }

  async function getCurrentLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setValue('home_lat', lat)
        setValue('home_lng', lng)
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          )
          const data = await res.json()
          const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || ''
          const country = data.address?.country || ''
          if (city)    setValue('home_city', city)
          if (country) setValue('home_country', country)
        } catch {}
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 10000 }
    )
  }

  async function onSubmit(data: FormData) {
    setSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        name:         data.name,
        phone:        data.phone,
        home_country: data.home_country,
        home_city:    data.home_city,
        radius:       data.radius,
      }
      if (data.home_lat !== null)      payload.home_lat     = data.home_lat
      if (data.home_lng !== null)      payload.home_lng     = data.home_lng
      if (data.categories.length > 0)  payload.categories   = data.categories
      if (data.skill_level)            payload.skill_level  = data.skill_level

      const { data: res } = await api.patch('/me', payload)
      setUser(res.data)
      router.replace('/hub')
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } } }
      const status = e?.response?.status
      const msg =
        e?.response?.data?.message ??
        Object.values(e?.response?.data?.errors ?? {})[0]?.[0] ??
        `Failed to save profile (${status ?? 'network error'}). Please try again.`
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (!token || !user) return null

  return (
    <main className="min-h-screen py-12 px-4" style={{ background: 'var(--background)' }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="text-3xl font-bold tracking-widest mb-2" style={{ color: 'var(--primary)' }}>
            FITMEET
          </div>
          <h1 className="text-2xl font-bold mb-1">Complete your profile</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Set up your account to start discovering events near you
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* ── Personal info ── */}
          <Section title="Personal info" icon={<User size={15} />}>

            {/* Google avatar + identity */}
            <div
              className="flex items-center gap-4 p-4 rounded-xl mb-5"
              style={{ background: 'var(--background)', border: '1px solid var(--border)' }}
            >
              {user.avatar ? (
                <Image
                  src={user.avatar}
                  alt={user.name}
                  width={48}
                  height={48}
                  className="rounded-full"
                />
              ) : (
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg text-black shrink-0"
                  style={{ background: 'var(--primary)' }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="font-semibold truncate">{user.name}</div>
                <div className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</div>
              </div>
              <div
                className="ml-auto shrink-0 text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: 'rgba(57,255,20,0.1)', color: 'var(--primary)' }}
              >
                Google
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full name *" error={errors.name?.message}>
                <input
                  {...register('name', { required: 'Name is required' })}
                  placeholder="Your full name"
                  className={inputCls(!!errors.name)}
                />
              </Field>

              <Field label="Phone number *" error={errors.phone?.message}>
                <div className="relative">
                  <Phone
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <input
                    {...register('phone', { required: 'Phone number is required' })}
                    placeholder="+385 91 234 5678"
                    className={cn(inputCls(!!errors.phone), 'pl-9')}
                  />
                </div>
              </Field>
            </div>
          </Section>

          {/* ── Location ── */}
          <Section title="Your location" icon={<MapPin size={15} />}>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <Field label="Country *" error={errors.home_country?.message}>
                <div className="relative">
                  <Globe
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <input
                    {...register('home_country', { required: 'Country is required' })}
                    placeholder="Croatia"
                    className={cn(inputCls(!!errors.home_country), 'pl-9')}
                  />
                </div>
              </Field>

              <Field label="City *" error={errors.home_city?.message}>
                <input
                  {...register('home_city', { required: 'City is required' })}
                  placeholder="Zagreb"
                  className={inputCls(!!errors.home_city)}
                />
              </Field>
            </div>

            <Field label="Pin your location on map" className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Click on the map or use your current location
                </p>
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  disabled={locating}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                  style={{ background: 'rgba(57,255,20,0.1)', color: 'var(--primary)' }}
                >
                  <LocateFixed size={13} className={locating ? 'animate-spin' : ''} />
                  {locating ? 'Locating...' : 'Use my location'}
                </button>
              </div>
              <Controller
                name="home_lat"
                control={control}
                render={() => (
                  <LocationPickerMap
                    lat={watchedLat}
                    lng={watchedLng}
                    onChange={(lat, lng) => {
                      setValue('home_lat', lat)
                      setValue('home_lng', lng)
                    }}
                  />
                )}
              />
              {watchedLat !== null && watchedLng !== null && (
                <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                  📍 {watchedLat.toFixed(5)}, {watchedLng.toFixed(5)}
                </p>
              )}
            </Field>

            <Field label="Search radius *">
              <div className="grid grid-cols-4 gap-2">
                {RADIUS_OPTIONS.map(opt => {
                  const selected = watchedRadius === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setValue('radius', opt.value)}
                      className="flex flex-col items-center gap-0.5 py-3 px-2 rounded-xl border text-center transition-all active:scale-95"
                      style={
                        selected
                          ? { borderColor: 'var(--primary)', background: 'rgba(57,255,20,0.08)', color: 'var(--primary)' }
                          : { borderColor: 'var(--border)', color: 'var(--text-muted)' }
                      }
                    >
                      <span className="text-xs font-bold">{opt.label}</span>
                      <span className="text-xs opacity-70">{opt.km}</span>
                    </button>
                  )
                })}
              </div>
            </Field>
          </Section>

          {/* ── Interests (optional) ── */}
          <Section title="Interests" icon={<Navigation size={15} />} badge="optional">

            <Field label="Favourite activities" className="mb-5">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => {
                  const selected = watchedCategories.includes(cat.value)
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => toggleCategory(cat.value)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all active:scale-95"
                      style={
                        selected
                          ? { borderColor: 'var(--primary)', background: 'rgba(57,255,20,0.08)', color: 'var(--primary)' }
                          : { borderColor: 'var(--border)', color: 'var(--text-muted)' }
                      }
                    >
                      <span>{cat.emoji}</span>
                      {cat.label}
                    </button>
                  )
                })}
              </div>
            </Field>

            <Field label="Skill level">
              <div className="grid grid-cols-3 gap-3">
                {SKILL_OPTIONS.map(opt => {
                  const selected = watchedSkill === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setValue('skill_level', selected ? null : opt.value)}
                      className="flex flex-col items-center gap-1 py-3.5 rounded-xl border transition-all active:scale-95"
                      style={
                        selected
                          ? { borderColor: 'var(--primary)', background: 'rgba(57,255,20,0.08)', color: 'var(--primary)' }
                          : { borderColor: 'var(--border)', color: 'var(--text-muted)' }
                      }
                    >
                      <span className="font-semibold text-sm">{opt.label}</span>
                      <span className="text-xs opacity-70">{opt.desc}</span>
                    </button>
                  )
                })}
              </div>
            </Field>
          </Section>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" loading={saving} className="w-full">
            {!saving && <Check size={16} className="mr-2" />}
            Save & continue
          </Button>

        </form>
      </div>
    </main>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  badge,
  children,
}: {
  title: string
  icon: React.ReactNode
  badge?: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-2xl border p-6"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-5">
        <span style={{ color: 'var(--primary)' }}>{icon}</span>
        <h2 className="font-bold text-sm uppercase tracking-wide">{title}</h2>
        {badge && (
          <span
            className="text-xs px-2 py-0.5 rounded-full ml-1"
            style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
          >
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  error,
  className,
  children,
}: {
  label?: string
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
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
