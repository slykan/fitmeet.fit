'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

import { HealthPanel } from '@/components/health-panel'
import { Navbar } from '@/components/navbar'

// Profile › Health settings — the same Health panel as in Feed › Health, opened straight in edit mode.
export default function HealthSettingsPage() {
  const router = useRouter()
  return (
    <>
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft size={16} /> Back
        </button>
        <h1 className="text-2xl font-bold">Health settings</h1>
        <HealthPanel startEditing />
      </div>
    </>
  )
}
