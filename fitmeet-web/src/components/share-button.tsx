'use client'

import { useState } from 'react'
import { Share2, Check } from 'lucide-react'

interface ShareButtonProps {
  title: string
  text: string
  url: string
}

export function ShareButton({ title, text, url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
      } catch {}
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-2 border px-6 py-3 rounded-xl text-sm font-semibold transition-colors hover:opacity-80"
      style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', background: 'var(--surface)' }}
    >
      {copied ? <Check size={14} style={{ color: 'var(--primary)' }} /> : <Share2 size={14} />}
      {copied ? 'Link copied!' : 'Share'}
    </button>
  )
}
