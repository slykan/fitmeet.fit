'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, MessageCircle } from 'lucide-react'

import api from '@/lib/api'

interface CommentUser {
  id: number | null
  name: string | null
  avatar: string | null
}

interface EventComment {
  id: number
  body: string
  created_at: string
  user: CommentUser
}

export function EventCommentsPreview({
  eventId,
  count,
}: {
  eventId: number
  count: number
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [locked, setLocked] = useState(false)
  const [comments, setComments] = useState<EventComment[]>([])

  if (count <= 0) return null

  async function toggleExpanded(e: React.MouseEvent) {
    e.stopPropagation()
    if (expanded) {
      setExpanded(false)
      return
    }

    setExpanded(true)
    if (comments.length > 0 || loading || locked) return

    setLoading(true)
    try {
      const { data } = await api.get(`/events/${eventId}/comments`)
      setComments((data.data ?? []) as EventComment[])
      setLocked(false)
    } catch (error: unknown) {
      if ((error as { response?: { status?: number } })?.response?.status === 403) {
        setLocked(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const preview = comments.slice(-2)

  return (
    <div
      className="mt-2 rounded-xl border overflow-hidden"
      style={{
        borderColor: 'rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={toggleExpanded}
        className="w-full px-3 py-2.5 flex items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 min-w-0">
          <MessageCircle size={14} style={{ color: 'var(--primary)' }} />
          <span className="text-xs font-semibold truncate">Comments ({count})</span>
        </span>
        {expanded ? (
          <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} />
        ) : (
          <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {loading ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading comments…</p>
          ) : locked ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Join this event to preview comments.</p>
          ) : preview.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Comments are there, but preview is still catching up.</p>
          ) : (
            <>
              {preview.map((comment) => (
                <div key={comment.id} className="space-y-0.5">
                  <div className="text-xs font-semibold">{comment.user.name ?? 'Member'}</div>
                  <div
                    className="text-xs leading-5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {comment.body}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(`/events/view?id=${eventId}&wall=1`)
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold transition-opacity hover:opacity-75"
                style={{ color: 'var(--primary)' }}
              >
                View more
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
