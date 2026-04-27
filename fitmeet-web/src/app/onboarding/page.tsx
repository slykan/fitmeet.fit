'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useForm, Controller } from 'react-hook-form'
import { Bell, Calendar, Globe, Mail, MapPin, Navigation, Phone, User, Check, LocateFixed, Search, UserPlus } from 'lucide-react'

import api from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CategoryMultiPicker } from '@/components/category-picker'

const LocationPickerMap = dynamic(() => import('@/components/location-picker-map'), { ssr: false })

// ─── Constants ───────────────────────────────────────────────────────────────

const RADIUS_OPTIONS = [
  { value: 'nearby',    label: 'Nearby',    km: '50 km' },
  { value: 'city',      label: 'City',      km: '200 km' },
  { value: 'region',    label: 'Region',    km: '500 km' },
  { value: 'unlimited', label: 'Unlimited', km: '∞' },
] as const

const SKILL_OPTIONS = [
  { value: 'beginner', label: 'Beginner', desc: 'Just getting started' },
  { value: 'advanced', label: 'Advanced', desc: 'Regular practitioner' },
  { value: 'pro',      label: 'Pro',      desc: 'Expert level' },
] as const

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  name:         string
  phone:        string
  hide_phone:   boolean
  home_country: string
  home_city:    string
  home_lat:     number | null
  home_lng:     number | null
  radius:       'nearby' | 'city' | 'region' | 'unlimited'
  categories:   string[]
  skill_level:  'beginner' | 'advanced' | 'pro' | null
  email_friend_requests: boolean
  email_new_events: boolean
  email_event_reminders: boolean
  email_friend_events: boolean
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { token, user, setUser } = useAuthStore()
  const router  = useRouter()
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
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
      hide_phone:   (user as { hide_phone?: boolean })?.hide_phone ?? false,
      home_country: user?.home?.country ?? '',
      home_city:    user?.home?.city    ?? '',
      home_lat:     user?.home?.lat     ?? null,
      home_lng:     user?.home?.lng     ?? null,
      radius:       user?.radius        ?? 'nearby',
      categories:   user?.categories    ?? [],
      skill_level:  user?.skill_level   ?? null,
      email_friend_requests: user?.email_preferences?.friend_requests ?? true,
      email_new_events:      user?.email_preferences?.new_events ?? true,
      email_event_reminders: user?.email_preferences?.event_reminders ?? true,
      email_friend_events:   user?.email_preferences?.friend_events ?? true,
    },
  })

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (!token) router.replace('/login')
  }, [token, router])

  const watchedLat        = watch('home_lat')
  const watchedLng        = watch('home_lng')
  const watchedRadius     = watch('radius')
  const watchedCategories = watch('categories')
  const watchedSkill      = watch('skill_level')
  const watchedHidePhone  = watch('hide_phone')
  const watchedFriendEmails       = watch('email_friend_requests')
  const watchedNewEventEmails     = watch('email_new_events')
  const watchedReminderEmails     = watch('email_event_reminders')
  const watchedFriendEventEmails  = watch('email_friend_events')

  function toggleCategory(value: string) {
    const current = watchedCategories
    setValue(
      'categories',
      current.includes(value) ? current.filter(c => c !== value) : [...current, value],
    )
  }

  async function geocodeHomeLocation() {
    const city    = watch('home_city')
    const country = watch('home_country')
    const q       = [city, country].filter(Boolean).join(', ')
    if (!q.trim()) return
    setLocating(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const results = await res.json()
      if (results[0]) {
        setValue('home_lat', parseFloat(results[0].lat))
        setValue('home_lng', parseFloat(results[0].lon))
      }
    } catch {}
    finally { setLocating(false) }
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
      if (data.home_lat)               payload.home_lat     = data.home_lat
      if (data.home_lng)               payload.home_lng     = data.home_lng
      if (data.categories.length > 0)  payload.categories   = data.categories
      if (data.skill_level)            payload.skill_level  = data.skill_level
      payload.hide_phone = data.hide_phone
      payload.email_friend_requests = data.email_friend_requests
      payload.email_new_events = data.email_new_events
      payload.email_event_reminders = data.email_event_reminders
      payload.email_friend_events = data.email_friend_events

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
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          {mounted && (
            <div className="flex justify-center mb-4">
              <Image
                src={theme === 'dark' ? '/logo_c.png' : '/logo_b.png'}
                alt="FitMeet"
                width={72}
                height={72}
                className="object-contain"
              />
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            <span style={{ color: 'var(--text-primary)' }}>Fit</span>
            <span style={{ color: 'var(--primary)' }}>meet</span>
          </h1>
          <p className="text-sm font-medium mb-1">Complete your profile</p>
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
                <button
                  type="button"
                  onClick={() => setValue('hide_phone', !watchedHidePhone)}
                  className="mt-2 flex items-center gap-2 text-xs select-none"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <div
                    className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0"
                    style={{ background: watchedHidePhone ? 'var(--primary)' : 'var(--border)' }}
                  >
                    <div
                      className="absolute top-0.5 w-3 h-3 rounded-full transition-all"
                      style={{
                        left: watchedHidePhone ? '18px' : '2px',
                        background: watchedHidePhone ? '#000' : 'var(--text-muted)',
                      }}
                    />
                  </div>
                  Hide phone from other users
                </button>
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
                <div className="flex gap-2">
                  <input
                    {...register('home_city', { required: 'City is required' })}
                    placeholder="Zagreb"
                    className={inputCls(!!errors.home_city)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); geocodeHomeLocation() } }}
                  />
                  <button
                    type="button"
                    onClick={geocodeHomeLocation}
                    disabled={locating}
                    title="Find on map"
                    className="flex-shrink-0 px-3 rounded-xl border transition-colors hover:border-[--primary] disabled:opacity-50"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                  >
                    <Search size={15} className={locating ? 'animate-spin' : ''} />
                  </button>
                </div>
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
              <CategoryMultiPicker
                value={watchedCategories}
                onChange={cats => setValue('categories', cats)}
              />
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

          <Section title="Email notifications" icon={<Mail size={15} />}>
            <div className="space-y-3">
              <ToggleRow
                icon={<UserPlus size={15} />}
                title="Friend activity"
                description="Friend requests and accepted requests."
                checked={watchedFriendEmails}
                onToggle={() => setValue('email_friend_requests', !watchedFriendEmails)}
              />
              <ToggleRow
                icon={<UserPlus size={15} />}
                title="Friends' events"
                description="New events created by your friends, regardless of category or distance."
                checked={watchedFriendEventEmails}
                onToggle={() => setValue('email_friend_events', !watchedFriendEventEmails)}
              />
              <ToggleRow
                icon={<Calendar size={15} />}
                title="New events near you"
                description="Events that match your interests and radius."
                checked={watchedNewEventEmails}
                onToggle={() => setValue('email_new_events', !watchedNewEventEmails)}
              />
              <ToggleRow
                icon={<Bell size={15} />}
                title="Event reminders"
                description="Reminder emails for events you joined."
                checked={watchedReminderEmails}
                onToggle={() => setValue('email_event_reminders', !watchedReminderEmails)}
              />
            </div>
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

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onToggle,
}: {
  icon: React.ReactNode
  title: string
  description: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:border-[--primary]"
      style={{ borderColor: checked ? 'var(--primary)' : 'var(--border)' }}
    >
      <span style={{ color: checked ? 'var(--primary)' : 'var(--text-muted)' }}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</span>
      </span>
      <span
        className="relative w-9 h-5 rounded-full transition-colors flex-shrink-0"
        style={{ background: checked ? 'var(--primary)' : 'var(--border)' }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
          style={{
            left: checked ? '18px' : '2px',
            background: checked ? '#000' : 'var(--text-muted)',
          }}
        />
      </span>
    </button>
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
