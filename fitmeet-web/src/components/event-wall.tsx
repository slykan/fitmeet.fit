'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, MessageCircle, Trash2 } from 'lucide-react'

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
  is_mine?: boolean
  can_delete?: boolean
}

export function EventWall({
  eventId,
  initialCount = 0,
  canAccess,
  initiallyOpen = false,
}: {
  eventId: number
  initialCount?: number
  canAccess: boolean
  initiallyOpen?: boolean
}) {
  const [open, setOpen] = useState(initiallyOpen)
  const [comments, setComments] = useState<EventComment[]>([])
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<number | null>(null)

  async function loadComments() {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get(`/events/${eventId}/comments`)
      const nextComments = (data.data ?? []) as EventComment[]
      setComments(nextComments)
      setCount(data.meta?.count ?? nextComments.length)
    } catch {
      setError('Could not load comments right now.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open || !canAccess) return
    void loadComments()
  }, [open, canAccess, eventId])

  async function handlePost() {
    if (!draft.trim()) return
    setPosting(true)
    setError(null)
    try {
      const { data } = await api.post(`/events/${eventId}/comments`, { body: draft.trim() })
      setComments((prev) => [...prev, data.data as EventComment])
      setCount((prev) => prev + 1)
      setDraft('')
      setOpen(true)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Could not post comment.')
    } finally {
      setPosting(false)
    }
  }

  async function handleDelete(commentId: number) {
    try {
      await api.delete(`/events/${eventId}/comments/${commentId}`)
      setComments((prev) => prev.filter((comment) => comment.id !== commentId))
      setCount((prev) => Math.max(0, prev - 1))
      setPendingDeleteCommentId((current) => current === commentId ? null : current)
    } catch {
      setError('Could not delete comment.')
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2">
          <MessageCircle size={16} style={{ color: 'var(--primary)' }} />
          <span className="text-xs uppercase tracking-wide font-semibold">
            Event Wall{count > 0 ? ` (${count})` : ''}
          </span>
        </span>
        {open ? (
          <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />
        ) : (
          <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
        )}
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {!canAccess ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Join this event to unlock the Event Wall.
            </p>
          ) : (
            <>
              {comments.length > 0 && (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold">{comment.user.name ?? 'Member'}</span>
                          <span style={{ color: 'var(--text-muted)' }}>{formatTime(comment.created_at)}</span>
                        </div>
                        <p className="text-sm mt-1 leading-6" style={{ color: 'var(--text-muted)' }}>
                          {comment.body}
                        </p>
                      </div>
                      {comment.can_delete && (
                        pendingDeleteCommentId === comment.id ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>
                              Delete?
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleDelete(comment.id)}
                                className="rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-opacity hover:opacity-80"
                                style={{ borderColor: 'rgba(248,113,113,0.3)', color: '#f87171', background: 'rgba(248,113,113,0.08)' }}
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingDeleteCommentId(null)}
                                className="rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors hover:bg-[--border]"
                                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPendingDeleteCommentId(comment.id)}
                            className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-red-500/10"
                            style={{ borderColor: 'rgba(248,113,113,0.3)', color: '#f87171' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              )}

              {!loading && comments.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No comments yet. Start the conversation.
                </p>
              )}

              {loading && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Loading comments…
                </p>
              )}

              <div className="space-y-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a comment…"
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none resize-none focus:border-[--primary] transition-colors"
                  style={{
                    minHeight: 92,
                    background: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--text-primary)',
                  }}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handlePost()}
                    disabled={posting || !draft.trim()}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                    style={{ background: 'var(--primary)', color: '#000' }}
                  >
                    {posting ? 'Posting…' : 'Post comment'}
                  </button>
                </div>
              </div>
            </>
          )}

          {error && (
            <div
              className="rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: 'rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.08)', color: '#f87171' }}
            >
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
