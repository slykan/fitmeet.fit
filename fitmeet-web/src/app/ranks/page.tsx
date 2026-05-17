'use client'

import { ChevronDown, ChevronUp, Share2 } from 'lucide-react'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { Navbar } from '@/components/navbar'
import api from '@/lib/api'

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
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="w-7 text-center text-lg shrink-0">{MEDALS[rank - 1] ?? rank}</span>
      <Avatar entry={entry} />
      <span className="flex-1 text-sm font-semibold truncate">{entry.name}</span>
      <span className="text-xs font-black px-2 py-1 rounded-lg"
        style={{ background: 'rgba(57,255,20,0.08)', color: 'var(--primary)', border: '1px solid rgba(57,255,20,0.2)' }}>
        {entry.count}
      </span>
    </div>
  )
}

function Section({ section, data }: { section: typeof SECTIONS[0]; data: Entry[] }) {
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
        </div>
      )}
    </div>
  )
}

export default function RanksPage() {
  const [data,    setData]    = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied,  setCopied]  = useState(false)

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
            <p className="text-sm opacity-50 mt-1">Top 5 in each category</p>
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
              <Section key={s.key} section={s} data={data?.[s.key] ?? []} />
            ))}
          </div>
        )}
      </main>
    </>
  )
}
