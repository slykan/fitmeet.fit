'use client'

import Link from 'next/link'
import { Share2, Play } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { MomentsGrid } from '@/components/moments-grid'

export default function MomentsPage() {
  function handleShare() {
    const url = 'https://fitmeet.fit/moments'
    if (navigator.share) {
      navigator.share({ title: 'FitMeet Moments', text: 'Real people, real events 📸', url })
    } else {
      navigator.clipboard.writeText(url)
        .then(() => alert('Link copied!'))
        .catch(() => {})
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black">Moments</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Real events, real people</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
              Event organizers can add one photo after each event ends.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/moments/slideshow"
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'rgba(57,255,20,0.15)', border: '1px solid rgba(57,255,20,0.4)', color: 'var(--primary)' }}
            >
              <Play size={15} /> Play
            </Link>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl font-semibold transition-opacity hover:opacity-80"
              style={{ background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.25)', color: 'var(--primary)' }}
            >
              <Share2 size={15} /> Share
            </button>
          </div>
        </div>

        <MomentsGrid />
      </div>
    </div>
  )
}
