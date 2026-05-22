'use client'

import { ChevronDown, ChevronUp, Share2, X } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Navbar } from '@/components/navbar'
import { PaymentTiers } from '@/components/payment-tiers'
import api from '@/lib/api'

function BeerModal({ onClose, onPurchased }: { onClose: () => void; onPurchased: () => void }) {
  const [done, setDone] = useState(false)

  function handleSuccess() {
    setDone(true)
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { onPurchased(); onClose() }} />
        <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border p-8 text-center"
          style={{ background: '#0c0a14', borderColor: 'rgba(246,198,91,0.25)' }}>
          <p className="text-4xl mb-3">🙏</p>
          <p className="font-black text-xl mb-1">Thank you!</p>
          <p className="text-sm opacity-60 mb-5">Your name will appear on the leaderboard shortly.</p>
          <button onClick={() => { onPurchased(); onClose() }}
            className="px-6 py-2.5 rounded-xl font-bold text-sm"
            style={{ background: '#f6c65b', color: '#000' }}>
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border overflow-hidden flex flex-col max-h-[85vh]"
        style={{ background: '#0c0a14', borderColor: 'rgba(246,198,91,0.25)' }}>
        <div className="w-10 h-1 rounded-full mx-auto mt-3 sm:hidden" style={{ background: 'rgba(255,255,255,0.15)' }} />
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">🍺</span>
            <h2 className="font-black text-lg">Buy me a Beer</h2>
          </div>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto p-5 flex flex-col gap-3">
          <p className="text-sm opacity-60 mb-1">Support FitMeet and get on the Beer Sponsor leaderboard!</p>
          <PaymentTiers onSuccess={handleSuccess} />
        </div>
      </div>
    </div>
  )
}

interface Entry { id: number; name: string; avatar: string | null; count: number }
interface Data {
  beer: Entry[]; consistency: Entry[]; creator: Entry[]
  connector: Entry[]; legend: Entry[]; social: Entry[]; late: Entry[]
}

const SECTIONS: { key: keyof Data; emoji: string; title: string; desc: string; unit: string }[] = [
  { key: 'beer',        emoji: '🍺', title: 'Beer Sponsor',      desc: 'Bought the most drinks',           unit: 'pts'       },
  { key: 'consistency', emoji: '🔥', title: 'Consistency Beast',  desc: 'Joined the most events',           unit: 'events'    },
  { key: 'creator',     emoji: '👑', title: 'Event Creator',      desc: 'Organized the most events',        unit: 'events'    },
  { key: 'connector',   emoji: '🤝', title: 'Connector',          desc: 'Invited the most people',          unit: 'invites'   },
  { key: 'legend',      emoji: '📍', title: 'Local Legend',        desc: 'Check-in king',                    unit: 'check-ins' },
  { key: 'social',      emoji: '💬', title: 'Social Animal',       desc: 'Most comments',                    unit: 'comments'  },
  { key: 'late',        emoji: '⏰', title: 'Always Late',          desc: 'Joined but never checked in 😄',   unit: 'skips'     },
]

const MEDALS = ['🥇', '🥈', '🥉']

function Avatar({ entry }: { entry: Entry }) {
  if (entry.avatar) return (
    <Image src={entry.avatar} alt={entry.name} width={32} height={32} className="rounded-full object-cover shrink-0" style={{ width: 32, height: 32 }} />
  )
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0"
      style={{ background: 'rgba(57,255,20,0.12)', color: 'var(--primary)' }}>
      {entry.name.charAt(0).toUpperCase()}
    </div>
  )
}

function EntryRow({ entry, rank }: { entry: Entry; rank: number; unit: string }) {
  return (
    <Link href={`/users/view?id=${entry.id}`}
      className="flex items-center gap-3 px-4 py-2.5 transition-opacity hover:opacity-70">
      <span className="w-7 text-center text-lg shrink-0">{MEDALS[rank - 1] ?? rank}</span>
      <Avatar entry={entry} />
      <span className="flex-1 text-sm font-semibold truncate">{entry.name}</span>
      <span className="text-xs font-black px-2 py-1 rounded-lg"
        style={{ background: 'rgba(57,255,20,0.08)', color: 'var(--primary)', border: '1px solid rgba(57,255,20,0.2)' }}>
        {entry.count}
      </span>
    </Link>
  )
}

function Section({ section, data, onBuyBeer }: { section: typeof SECTIONS[0]; data: Entry[]; onBuyBeer?: () => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 p-4 hover:opacity-80 transition-opacity text-left"
      >
        <span className="text-2xl w-8 text-center">{section.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">{section.title}</p>
          <p className="text-xs opacity-50">{section.desc}</p>
        </div>
        {open ? <ChevronUp size={16} className="opacity-40 shrink-0" /> : <ChevronDown size={16} className="opacity-40 shrink-0" />}
      </button>

      {open && (
        <div className="border-t" style={{ borderColor: 'var(--border)' }}>
          {data.length === 0 ? (
            <p className="text-center text-sm opacity-40 py-4">No data yet.</p>
          ) : (
            data.map((entry, i) => <EntryRow key={entry.id} entry={entry} rank={i + 1} unit={section.unit} />)
          )}
          {onBuyBeer && (
            <div className="p-3 pt-2">
              <button
                onClick={onBuyBeer}
                className="w-full py-3 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
                style={{ background: 'rgba(246,198,91,0.1)', border: '1px solid rgba(246,198,91,0.3)', color: '#f6c65b' }}
              >
                🍺 Buy a Beer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function RanksPage() {
  const [data,     setData]     = useState<Data | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [copied,   setCopied]   = useState(false)
  const [showBeer, setShowBeer] = useState(false)

  useEffect(() => {
    api.get('/leaderboard').then(r => setData(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function handleShare() {
    const url  = 'https://fitmeet.fit/ranks'
    const text = 'Check out the FitMeet Community Badges — who\'s on top? 🏆'
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: 'Community Badges — FitMeet', text, url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <>
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-black">🏆 Community Badges</h1>
            <p className="text-sm opacity-50 mt-1">Top 5 · Last 30 days</p>
          </div>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-bold transition-opacity hover:opacity-80"
            style={{ borderColor: 'rgba(57,255,20,0.25)', background: 'rgba(57,255,20,0.06)', color: 'var(--primary)' }}
          >
            <Share2 size={14} />
            {copied ? 'Copied!' : 'Share'}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 opacity-40">Loading…</div>
        ) : (
          <div className="flex flex-col gap-3">
            {SECTIONS.map(s => (
              <Section
                key={s.key}
                section={s}
                data={data?.[s.key] ?? []}
                onBuyBeer={s.key === 'beer' ? () => setShowBeer(true) : undefined}
              />
            ))}
          </div>
        )}
      </main>

      {showBeer && (
        <BeerModal
          onClose={() => setShowBeer(false)}
          onPurchased={() => { setShowBeer(false); api.get('/leaderboard').then(r => setData(r.data)).catch(() => {}) }}
        />
      )}
    </>
  )
}
