'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Calendar, MapPin, Info, Settings, Lock, Unlock, LocateFixed, Search } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import ElevationChart from '@/components/elevation-chart'
import api from '@/lib/api'
import { eventDateToLocalInput, eventLocalInputToUtcIso, resolveEventTimeZone, resolveTimeZoneFromCoords } from '@/lib/event-time'
import { parseGpx, GpxResult } from '@/lib/parse-gpx'
import { formatAddress } from '@/lib/format-address'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import CategoryPicker from '@/components/category-picker'

const LocationPickerMap = dynamic(() => import('@/components/location-picker-map'), { ssr: false })

const SKILL_OPTIONS = [
  { value: 'beginner', label: 'Beginner', desc: 'Just starting' },
  { value: 'advanced', label: 'Advanced', desc: 'Regular' },
  { value: 'pro',      label: 'Pro',      desc: 'Expert' },
] as const

const DURATION_PRESETS = [
  { label: '30 min', value: '30' },
  { label: '1 h',    value: '60' },
  { label: '1.5 h',  value: '90' },
  { label: '2 h',    value: '120' },
  { label: '3 h',    value: '180' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  title:            string
  category:         string
  description:      string
  start_at:         string
  duration_minutes: string
  lat:              number | null
  lng:              number | null
  address:          string
  skill_level:      'beginner' | 'advanced' | 'pro' | ''
  max_participants: string
  is_private:       boolean
  distance_km:      string
  elevation_gain:   string
  max_grade:        string
  max_downgrade:    string
  pace:             string
  youtube_url:      string
}

function localDatetimeMin(): string {
  const now = new Date()
  now.setMinutes(now.getMinutes() + 10)
  return eventDateToLocalInput(now)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateEventPage() {
  const { token } = useAuthStore()
  const router    = useRouter()
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [eventTimezone, setEventTimezone] = useState(
    () => resolveEventTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone),
  )
  const [gpxFile,   setGpxFile]   = useState<File | null>(null)
  const [gpxResult, setGpxResult] = useState<GpxResult | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      title: '', category: '', description: '',
      start_at: '', duration_minutes: '',
      lat: null, lng: null, address: '',
      skill_level: '', max_participants: '',
      is_private: false,
      distance_km: '', elevation_gain: '', max_grade: '', max_downgrade: '', pace: '',
    },
  })

  useEffect(() => {
    if (!token) router.replace('/login')
  }, [token, router])

  const watchedLat      = watch('lat')
  const watchedLng      = watch('lng')
  const watchedCategory = watch('category')
  const watchedSkill    = watch('skill_level')
  const watchedPrivate  = watch('is_private')
  const watchedDuration = watch('duration_minutes')

  async function handleMapChange(lat: number, lng: number) {
    setValue('lat', lat)
    setValue('lng', lng)
    resolveTimeZoneFromCoords(lat, lng, Intl.DateTimeFormat().resolvedOptions().timeZone)
      .then(setEventTimezone)
      .catch(() => {})
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data = await res.json()
      if (data.address) setValue('address', formatAddress(data.address))
    } catch {}
  }

  async function geocodeAddress() {
    const address = watch('address')
    if (!address.trim()) return
    setLocating(true)
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const results = await res.json()
      if (results[0]) {
        const { lat, lon, display_name } = results[0]
        setValue('lat', parseFloat(lat))
        setValue('lng', parseFloat(lon))
        setValue('address', display_name.split(',').slice(0, 3).join(',').trim())
      }
    } catch {}
    finally { setLocating(false) }
  }

  async function useMyLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        await handleMapChange(lat, lng)
        setLocating(false)
      },
      () => setLocating(false),
      { timeout: 10000 }
    )
  }

  async function handleGpxChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setGpxFile(file)
    const result = parseGpx(await file.text())
    setGpxResult(result)
    if (result.track.length > 0 && watchedLat === null) {
      setValue('lat', result.track[0][0])
      setValue('lng', result.track[0][1])
    }
    if (result.distanceKm > 0)    setValue('distance_km',    String(result.distanceKm))
    if (result.elevationGain > 0) setValue('elevation_gain', String(result.elevationGain))
    if (result.maxGrade > 0)         setValue('max_grade',      String(result.maxGrade))
    if (result.maxDowngrade < 0)     setValue('max_downgrade',  String(result.maxDowngrade))
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setImageFile(file)
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
    }
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  async function onSubmit(data: FormData) {
    setSaving(true)
    setError(null)
    try {
      const fd = new globalThis.FormData()
      const timezone = data.lat !== null && data.lng !== null
        ? await resolveTimeZoneFromCoords(data.lat, data.lng, eventTimezone)
        : resolveEventTimeZone(eventTimezone)

      fd.append('title',    data.title)
      fd.append('category', data.category)
      fd.append('timezone', timezone)
      fd.append('start_at', eventLocalInputToUtcIso(data.start_at, timezone))
      if (data.lat !== null)     fd.append('lat',              String(data.lat))
      if (data.lng !== null)     fd.append('lng',              String(data.lng))
      if (data.description)      fd.append('description',      data.description)
      if (data.address)          fd.append('address',          data.address)
      if (data.duration_minutes) fd.append('duration_minutes', data.duration_minutes)
      if (data.skill_level)      fd.append('skill_level',      data.skill_level)
      if (data.max_participants) fd.append('max_participants',  data.max_participants)
      fd.append('is_private', data.is_private ? '1' : '0')
      if (data.distance_km)    fd.append('distance_km',    data.distance_km)
      if (data.elevation_gain) fd.append('elevation_gain', data.elevation_gain)
      if (data.max_grade)      fd.append('max_grade',      data.max_grade)
      if (data.max_downgrade)  fd.append('max_downgrade',  data.max_downgrade)
      if (data.pace)           fd.append('pace',           data.pace)
      if (gpxFile)             fd.append('gpx_file',       gpxFile)
      if (imageFile)           fd.append('image_file',     imageFile)
      if (data.youtube_url)    fd.append('youtube_url',    data.youtube_url)

      const { data: res } = await api.post('/events', fd)
      router.replace(`/events/view?id=${res.data.id}`)
    } catch (err: unknown) {
      const e   = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
      const msg =
        e?.response?.data?.message ??
        Object.values(e?.response?.data?.errors ?? {})[0]?.[0] ??
        'Failed to create event. Please try again.'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  if (!token) return null

  return (
    <>
      <Navbar />
      <main className="min-h-screen py-10 px-4" style={{ background: 'var(--background)' }}>
        <div className="max-w-3xl mx-auto">

          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-1">Create event</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Set up your event and invite people to join
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* ── Basic info ── */}
            <Section title="Basic info" icon={<Info size={15} />}>

              <Field label="Event title *" error={errors.title?.message}>
                <input
                  {...register('title', { required: 'Title is required', maxLength: { value: 100, message: 'Max 100 characters' } })}
                  placeholder="e.g. Morning run around Jarun"
                  className={inputCls(!!errors.title)}
                />
              </Field>

              <Field label="Category *" error={errors.category?.message} className="mt-4">
                <Controller
                  name="category"
                  control={control}
                  rules={{ required: 'Select a category' }}
                  render={() => (
                    <CategoryPicker value={watchedCategory} onChange={v => setValue('category', v)} />
                  )}
                />
              </Field>

              <Field label="Description" className="mt-4">
                <textarea
                  {...register('description')}
                  placeholder="What should attendees know? (optional)"
                  rows={3}
                  className={cn(inputCls(false), 'resize-none')}
                />
              </Field>

              <Field label="Event image" className="mt-4">
                <div className="space-y-3">
                  <label
                    className="flex items-center justify-between gap-3 px-3 py-3 rounded-xl border cursor-pointer transition-all"
                    style={imageFile || imagePreview
                      ? { borderColor: 'var(--primary)', background: 'rgba(57,255,20,0.06)', color: 'var(--primary)' }
                      : { borderColor: 'var(--border)', color: 'var(--text-muted)' }
                    }
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                    <span className="text-sm">
                      {imageFile ? `Image selected: ${imageFile.name}` : 'Add event image (optional)'}
                    </span>
                    <span className="text-xs font-semibold">Upload</span>
                  </label>

                  {imagePreview ? (
                    <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                      <img
                        src={imagePreview}
                        alt="Event preview"
                        className="block w-full object-cover"
                        style={{ aspectRatio: '16 / 9' }}
                      />
                    </div>
                  ) : (
                    <div
                      className="flex items-center justify-center rounded-xl border text-sm"
                      style={{
                        borderColor: 'var(--border)',
                        color: 'var(--text-muted)',
                        aspectRatio: '16 / 9',
                        background: 'rgba(255,255,255,0.02)',
                      }}
                    >
                      No image
                    </div>
                  )}
                </div>
              </Field>
              <Field label="YouTube video URL" className="mt-4">
                <input
                  {...register('youtube_url', {
                    validate: v => !v || /^https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]{11}/.test(v) || 'Enter a valid YouTube URL',
                  })}
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  className={inputCls(!!errors.youtube_url)}
                />
                {errors.youtube_url && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.youtube_url.message}</p>}
              </Field>
            </Section>

            {/* ── When ── */}
            <Section title="When" icon={<Calendar size={15} />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Date & time *" error={errors.start_at?.message}>
                  <input
                    {...register('start_at', { required: 'Start time is required' })}
                    type="datetime-local"
                    min={localDatetimeMin()}
                    className={inputCls(!!errors.start_at)}
                    style={{ colorScheme: 'dark' }}
                  />
                </Field>

                <Field label="Duration">
                  <div className="flex gap-2 flex-wrap mb-2">
                    {DURATION_PRESETS.map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setValue('duration_minutes', p.value)}
                        className="px-3 py-1 rounded-lg border text-xs font-medium transition-all"
                        style={
                          watchedDuration === p.value
                            ? { borderColor: 'var(--primary)', background: 'rgba(57,255,20,0.08)', color: 'var(--primary)' }
                            : { borderColor: 'var(--border)', color: 'var(--text-muted)' }
                        }
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <input
                    {...register('duration_minutes')}
                    type="number"
                    placeholder="Custom (minutes)"
                    min={5}
                    max={1440}
                    className={inputCls(false)}
                  />
                </Field>
              </div>
            </Section>

            {/* ── Where ── */}
            <Section title="Where" icon={<MapPin size={15} />}>
              <Field label="Pin location on map *" error={errors.lat?.message}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Click on the map to set the meeting point
                  </p>
                  <button
                    type="button"
                    onClick={useMyLocation}
                    disabled={locating}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                    style={{ background: 'rgba(57,255,20,0.1)', color: 'var(--primary)' }}
                  >
                    <LocateFixed size={13} className={locating ? 'animate-spin' : ''} />
                    {locating ? 'Locating…' : 'Use my location'}
                  </button>
                </div>

                <Controller
                  name="lat"
                  control={control}
                  rules={{ required: 'Pick a location on the map' }}
                  render={() => (
                    <LocationPickerMap
                      lat={watchedLat}
                      lng={watchedLng}
                      onChange={handleMapChange}
                      coloredSegments={gpxResult?.coloredSegments}
                    />
                  )}
                />
                {watchedLat !== null && watchedLng !== null && (
                  <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    📍 {watchedLat.toFixed(5)}, {watchedLng.toFixed(5)}
                  </p>
                )}
              </Field>

              <Field label="Address" className="mt-4">
                <div className="flex gap-2">
                  <input
                    {...register('address')}
                    placeholder="Type city or address, then press Enter"
                    className={inputCls(false)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); geocodeAddress() } }}
                  />
                  <button
                    type="button"
                    onClick={geocodeAddress}
                    disabled={locating}
                    className="flex-shrink-0 px-3 rounded-xl border transition-colors hover:border-[--primary] disabled:opacity-50"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                  >
                    <Search size={15} className={locating ? 'animate-spin' : ''} />
                  </button>
                </div>
              </Field>

              <Field label="GPX route" className="mt-4">
                <label
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all"
                  style={gpxFile
                    ? { borderColor: 'var(--primary)', background: 'rgba(57,255,20,0.06)', color: 'var(--primary)' }
                    : { borderColor: 'var(--border)', color: 'var(--text-muted)' }
                  }
                >
                  <input
                    type="file"
                    accept=".gpx,.xml"
                    className="hidden"
                    onChange={handleGpxChange}
                  />
                  <span className="text-sm">
                    {gpxFile
                      ? `📍 ${gpxFile.name} · ${gpxResult?.track.length ?? 0} points`
                      : '+ Upload GPX file (optional)'}
                  </span>
                </label>
              </Field>

              {gpxResult && gpxResult.elevationProfile.length >= 2 && (
                <div className="mt-4">
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Elevation profile</p>
                  <ElevationChart profile={gpxResult.elevationProfile} totalKm={gpxResult.distanceKm} />
                </div>
              )}
            </Section>

            {/* ── Details ── */}
            <Section title="Details" icon={<Settings size={15} />} badge="optional">

              <Field label="Skill level" className="mb-4">
                <div className="grid grid-cols-3 gap-3">
                  {SKILL_OPTIONS.map(opt => {
                    const selected = watchedSkill === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setValue('skill_level', selected ? '' : opt.value)}
                        className="flex flex-col items-center gap-0.5 py-3 rounded-xl border transition-all active:scale-95"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <Field label="Max participants">
                  <input
                    {...register('max_participants')}
                    type="number"
                    placeholder="Unlimited"
                    min={2}
                    max={9999}
                    className={inputCls(false)}
                  />
                </Field>

                <Field label="Visibility">
                  <button
                    type="button"
                    onClick={() => setValue('is_private', !watchedPrivate)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all"
                    style={
                      watchedPrivate
                        ? { borderColor: 'var(--primary)', background: 'rgba(57,255,20,0.08)', color: 'var(--primary)' }
                        : { borderColor: 'var(--border)', color: 'var(--text-muted)' }
                    }
                  >
                    {watchedPrivate ? <Lock size={14} /> : <Unlock size={14} />}
                    {watchedPrivate ? 'Private event' : 'Public event'}
                  </button>
                </Field>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Field label="Distance (km)">
                  <input {...register('distance_km')} type="number" placeholder="e.g. 10" min={0} step={0.1} className={inputCls(false)} />
                </Field>
                <Field label="Elevation gain (m)">
                  <input {...register('elevation_gain')} type="number" placeholder="e.g. 250" min={0} className={inputCls(false)} />
                </Field>
                <Field label="Max grade ▲ (%)">
                  <input {...register('max_grade')} type="number" placeholder="e.g. 12" min={0} max={100} step={0.1} className={inputCls(false)} />
                </Field>
                <Field label="Max grade ▼ (%)">
                  <input {...register('max_downgrade')} type="number" placeholder="e.g. -8" max={0} min={-100} step={0.1} className={inputCls(false)} />
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Pace">
                  <input {...register('pace')} placeholder="e.g. 5:30/km" className={inputCls(false)} />
                </Field>
              </div>
            </Section>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="border"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" size="lg" loading={saving} className="flex-1">
                Create event
              </Button>
            </div>

          </form>
        </div>
      </main>
    </>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({
  title, icon, badge, children,
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
  label, error, className, children,
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
