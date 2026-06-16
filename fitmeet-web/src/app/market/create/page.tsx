'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { ChevronLeft, X } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import api from '@/lib/api'
import { CATEGORIES, CATEGORY_EMOJI } from '@/lib/categories'
import { useAuthStore } from '@/store/auth'

const CONDITIONS = [
  { value: 'new',      label: 'New' },
  { value: 'like_new', label: 'Like new' },
  { value: 'used',     label: 'Used' },
]

function CreateContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('id')
  const { token } = useAuthStore()

  const [title, setTitle]       = useState('')
  const [description, setDesc]  = useState('')
  const [price, setPrice]       = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [condition, setCond]    = useState('used')
  const [category, setCategory] = useState('running')
  const [images, setImages]     = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!token) { router.replace('/login'); return }
    if (!editId) return

    api.get(`/market/${editId}`).then(({ data }) => {
      const l = data.data
      setTitle(l.title ?? '')
      setDesc(l.description ?? '')
      setPrice(String(l.price ?? ''))
      setCurrency(l.currency ?? 'EUR')
      setCond(l.condition ?? 'used')
      setCategory(l.category?.value ?? 'running')
      if (l.images?.length) setPreviews(l.images)
    }).catch(() => router.replace('/meet'))
  }, [editId, router, token])

  function pickImages(files: FileList | null) {
    if (!files) return
    const next = [...images, ...Array.from(files)].slice(0, 5)
    setImages(next)
    setPreviews(next.map(f => URL.createObjectURL(f)))
  }

  function removeImage(idx: number) {
    const nextFiles = images.filter((_, i) => i !== idx)
    const nextPrev  = previews.filter((_, i) => i !== idx)
    setImages(nextFiles)
    setPreviews(nextPrev)
  }

  async function handleSave() {
    if (!title.trim()) { setError('Enter a title.'); return }
    if (!price || isNaN(Number(price)) || Number(price) < 0) { setError('Enter a valid price.'); return }
    setError(null)
    setSaving(true)

    try {
      const form = new FormData()
      form.append('title', title.trim())
      form.append('description', description.trim())
      form.append('price', price)
      form.append('currency', currency)
      form.append('condition', condition)
      form.append('category', category)
      if (images.length) images.forEach(f => form.append('images[]', f))

      if (editId) {
        form.append('_method', 'PUT')
        await api.post(`/market/${editId}`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
        router.push(`/market/view?id=${editId}`)
      } else {
        const { data } = await api.post('/market', form, { headers: { 'Content-Type': 'multipart/form-data' } })
        router.push(`/market/view?id=${data.data.id}`)
      }
    } catch {
      setError('Could not save listing. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!token) return null

  return (
    <>
      <Navbar />
      <main className="min-h-screen py-8 px-4">
        <div style={{ maxWidth: 600, margin: '0 auto' }} className="space-y-5">

          <button onClick={() => router.back()} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <ChevronLeft size={16} /> Back
          </button>

          <h1 className="text-2xl font-black">{editId ? 'Edit listing' : 'Sell something'}</h1>

          {/* Images */}
          <div className="rounded-2xl border p-4 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="font-bold text-sm">Photos <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(max 5)</span></p>
            <div className="flex flex-wrap gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                  <Image src={src} alt="" fill className="object-cover" unoptimized />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.7)' }}
                  >
                    <X size={11} color="#fff" />
                  </button>
                </div>
              ))}
              {previews.length < 5 && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-24 h-24 rounded-xl border-2 border-dashed flex items-center justify-center text-2xl transition-opacity hover:opacity-70"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  +
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => pickImages(e.target.files)}
            />
          </div>

          {/* Details */}
          <div className="rounded-2xl border p-4 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="font-bold text-sm">Details</p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Shimano road bike shoes size 43"
                maxLength={200}
                className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-[--primary] transition-colors"
                style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Description</label>
              <textarea
                value={description}
                onChange={e => setDesc(e.target.value)}
                placeholder="Describe the item, size, usage, reason for selling…"
                maxLength={2000}
                rows={4}
                className="w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-[--primary] transition-colors resize-none"
                style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Price *</label>
                <div className="flex gap-2">
                  <input
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="0"
                    type="number"
                    min="0"
                    step="0.01"
                    className="flex-1 min-w-0 rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-[--primary] transition-colors"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className="rounded-xl border px-2 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  >
                    <option>EUR</option>
                    <option>USD</option>
                    <option>HRK</option>
                    <option>GBP</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Condition *</label>
                <div className="flex gap-1.5">
                  {CONDITIONS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCond(c.value)}
                      className="flex-1 py-2 text-xs rounded-lg border font-semibold transition-colors"
                      style={{
                        borderColor: condition === c.value ? 'var(--primary)' : 'var(--border)',
                        color: condition === c.value ? 'var(--primary)' : 'var(--text-muted)',
                        background: condition === c.value ? 'rgba(57,255,20,0.08)' : 'transparent',
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Category *</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setCategory(cat.value)}
                    className="text-xs px-3 py-1.5 rounded-full border font-medium transition-colors"
                    style={{
                      borderColor: category === cat.value ? 'var(--primary)' : 'var(--border)',
                      color: category === cat.value ? 'var(--primary)' : 'var(--text-muted)',
                      background: category === cat.value ? 'rgba(57,255,20,0.08)' : 'transparent',
                    }}
                  >
                    {CATEGORY_EMOJI[cat.value]} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm px-3 py-2 rounded-xl border" style={{ color: '#f87171', borderColor: '#f87171', background: 'rgba(248,113,113,0.08)' }}>
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => router.back()}
                className="flex-1 py-3 rounded-xl border font-bold text-sm transition-opacity hover:opacity-80"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 rounded-xl font-bold text-sm transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: 'var(--primary)', color: '#000' }}
              >
                {saving ? 'Saving…' : editId ? 'Save changes' : 'Post listing'}
              </button>
            </div>
          </div>

        </div>
      </main>
    </>
  )
}

export default function CreateListingPage() {
  return (
    <Suspense fallback={null}>
      <CreateContent />
    </Suspense>
  )
}
