'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { ArrowLeft, Check, Download, Flag, ImageIcon, MessageSquare, Plus, Search, Send, Trash2, UserCheck, UserPlus, UserX, Users, X } from 'lucide-react'

import { Navbar } from '@/components/navbar'
import api from '@/lib/api'
import { blockUser, reportContent, unblockUser } from '@/lib/moderation'
import { useAuthStore } from '@/store/auth'

interface Person {
  id: number
  name: string
  avatar: string | null
}

interface Conversation {
  id: number
  is_group: boolean
  title: string | null
  partner: Person | null
  participants: Person[]
  last_message: {
    body: string
    image_url: string | null
    is_mine: boolean
    created_at: string
    sender: Person
  }
  unread_count: number
}

interface ConversationDetail {
  id: number
  is_group: boolean
  title: string
  partner: Person | null
  partner_is_blocked: boolean
  participants: Person[]
  can_manage_members: boolean
}

interface Msg {
  id: number
  body: string
  image_url: string | null
  is_mine: boolean
  created_at: string
  sender: Person
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function PersonAvatar({ person, size = 44 }: { person: Person; size?: number }) {
  if (person.avatar) {
    return (
      <Image
        src={person.avatar}
        alt={person.name}
        width={size}
        height={size}
        className="rounded-full object-cover flex-shrink-0"
      />
    )
  }

  return (
    <div
      className="flex-shrink-0 rounded-full flex items-center justify-center font-bold text-black"
      style={{ width: size, height: size, fontSize: size * 0.38, background: 'var(--primary)' }}
    >
      {person.name.charAt(0).toUpperCase()}
    </div>
  )
}

function ConversationAvatar({
  conversation,
  size = 44,
}: {
  conversation: Pick<Conversation, 'is_group' | 'title' | 'partner' | 'participants'> | Pick<ConversationDetail, 'is_group' | 'title' | 'partner' | 'participants'>
  size?: number
}) {
  if (!conversation.is_group && conversation.partner) {
    return <PersonAvatar person={conversation.partner} size={size} />
  }

  const others = conversation.participants.slice(0, 2)

  return (
    <div
      className="relative flex-shrink-0 rounded-full border flex items-center justify-center overflow-hidden"
      style={{ width: size, height: size, borderColor: 'rgba(57,255,20,0.28)', background: 'rgba(57,255,20,0.08)' }}
    >
      {others.length > 0 ? (
        <div className="flex items-center justify-center gap-1">
          {others.map((participant) => (
            <div
              key={participant.id}
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-black"
              style={{ background: 'var(--primary)' }}
            >
              {participant.name.charAt(0).toUpperCase()}
            </div>
          ))}
        </div>
      ) : (
        <Users size={18} style={{ color: 'var(--primary)' }} />
      )}
    </div>
  )
}

function ThreadView({
  conversationId,
  userId,
  currentUserId,
  onBack,
}: {
  conversationId?: string | null
  userId?: string | null
  currentUserId: number
  onBack: () => void
}) {
  const router = useRouter()
  const [conversation, setConversation] = useState<ConversationDetail | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [loading, setLoading] = useState(true)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageModal, setImageModal] = useState<string | null>(null)
  const [addMembersOpen, setAddMembersOpen] = useState(false)
  const [friends, setFriends] = useState<Person[]>([])
  const [selectedMembers, setSelectedMembers] = useState<Set<number>>(new Set())
  const [addingMembers, setAddingMembers] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    const request = conversationId
      ? api.get(`/messages/conversations/${conversationId}`)
      : api.get(`/messages/${userId}`)

    request
      .then(({ data }) => {
        setConversation(data.conversation)
        setMessages(data.data ?? [])
      })
      .finally(() => setLoading(false))
  }, [conversationId, userId])

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const subtitle = useMemo(() => {
    if (!conversation) return ''
    const others = conversation.participants.filter((participant) => participant.id !== currentUserId)
    if (conversation.is_group) {
      return `${others.length + 1} members · ${others.map((participant) => participant.name).join(', ')}`
    }
    return conversation.partner?.name ?? ''
  }, [conversation, currentUserId])

  async function handleSend() {
    const text = body.trim()
    if ((!text && !imageFile) || sending || !conversation) return

    setSending(true)
    setBody('')
    const file = imageFile
    clearImage()
    try {
      const formData = new FormData()
      if (text) formData.append('body', text)
      if (file) formData.append('image_file', file)
      const { data } = await api.post(`/messages/conversations/${conversation.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setMessages((current) => [...current, data.data])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function pickImage(file: File | null) {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(file)
    setImagePreview(file ? URL.createObjectURL(file) : null)
  }

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function loadFriendsForGroup() {
    api.get('/users', { params: { friends_only: 1 } })
      .then(({ data }) => setFriends(data.data ?? []))
      .catch(() => {})
  }

  function openAddMembers() {
    setSelectedMembers(new Set())
    setAddMembersOpen(true)
    loadFriendsForGroup()
  }

  async function handleAddMembers() {
    if (!conversation || selectedMembers.size === 0) return
    setAddingMembers(true)
    try {
      const { data } = await api.post(`/messages/conversations/${conversation.id}/participants`, {
        participant_ids: Array.from(selectedMembers),
      })
      setConversation(data.conversation)
      setAddMembersOpen(false)
      setSelectedMembers(new Set())
    } finally {
      setAddingMembers(false)
    }
  }

  async function downloadImage(url: string) {
    const res = await fetch(url)
    const blob = await res.blob()
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = url.split('/').pop() || 'fitmeet-message-image'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(href)
  }

  async function handleDeleteConversation() {
    if (!conversation) return
    const confirmText = conversation.is_group ? 'Leave this group conversation?' : 'Delete this conversation?'
    if (!window.confirm(confirmText)) return

    await api.delete(`/messages/conversations/${conversation.id}`)
    router.push('/messages')
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <div
        className="flex items-center gap-3 px-4 py-3 border-b"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg transition-colors hover:bg-[--border]"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={20} />
        </button>
        {conversation && (
          <>
            <ConversationAvatar conversation={conversation} size={36} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold truncate">{conversation.title}</p>
              {subtitle && (
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {subtitle}
                </p>
              )}
            </div>
            {conversation.is_group && conversation.can_manage_members && (
              <button
                onClick={openAddMembers}
                title="Add people"
                className="p-2 rounded-xl transition-colors hover:bg-[--border]"
                style={{ color: 'var(--text-muted)' }}
              >
                <UserPlus size={16} />
              </button>
            )}
            {!conversation.is_group && conversation.partner && (
              <>
                <button
                  onClick={() => reportContent('user', conversation.partner!.id)}
                  title="Report user"
                  className="p-2 rounded-xl transition-colors hover:bg-[--border]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Flag size={16} />
                </button>
                <button
                  onClick={async () => {
                    const partnerId = conversation.partner!.id
                    const ok = conversation.partner_is_blocked
                      ? await unblockUser(partnerId)
                      : await blockUser(partnerId)
                    if (ok) {
                      setConversation((prev) => prev ? { ...prev, partner_is_blocked: !prev.partner_is_blocked } : prev)
                    }
                  }}
                  title={conversation.partner_is_blocked ? 'Unblock user' : 'Block user'}
                  className="p-2 rounded-xl transition-colors hover:bg-red-500/10"
                  style={{ color: conversation.partner_is_blocked ? 'var(--primary)' : 'var(--text-muted)' }}
                >
                  {conversation.partner_is_blocked ? <UserCheck size={16} /> : <UserX size={16} />}
                </button>
              </>
            )}
            <button
              onClick={handleDeleteConversation}
              title={conversation.is_group ? 'Leave conversation' : 'Delete conversation'}
              className="p-2 rounded-xl transition-colors hover:bg-red-500/10"
              style={{ color: 'var(--text-muted)' }}
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading && (
          <p className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
            Loading…
          </p>
        )}
        {!loading && messages.length === 0 && (
          <p className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
            No messages yet. Say hi!
          </p>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.is_mine ? 'justify-end' : 'justify-start'}`}>
            <div
              style={{
                maxWidth: '78%',
                background: message.is_mine ? 'var(--primary)' : 'var(--surface)',
                color: message.is_mine ? '#000' : 'var(--text-primary)',
                border: message.is_mine ? 'none' : '1px solid var(--border)',
                borderRadius: message.is_mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                padding: '10px 14px',
              }}
            >
              {conversation?.is_group && !message.is_mine && (
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--primary)' }}>
                  {message.sender.name}
                </p>
              )}
              <p className="text-sm leading-relaxed" style={{ wordBreak: 'break-word' }}>
                {message.body}
              </p>
              {message.image_url && (
                <div className={message.body ? 'mt-2' : ''}>
                  <button
                    type="button"
                    onClick={() => setImageModal(message.image_url)}
                    className="block overflow-hidden rounded-xl border"
                    style={{ borderColor: message.is_mine ? 'rgba(0,0,0,0.18)' : 'var(--border)' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={message.image_url} alt="Message attachment" className="max-h-64 max-w-full object-cover" />
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadImage(message.image_url!)}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold opacity-70 hover:opacity-100"
                  >
                    <Download size={12} /> Download
                  </button>
                </div>
              )}
              <p
                className="text-xs mt-1"
                style={{
                  color: message.is_mine ? 'rgba(0,0,0,0.5)' : 'var(--text-muted)',
                  textAlign: 'right',
                }}
              >
                {formatTime(message.created_at)}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div
        className="px-4 py-3 border-t flex gap-3 items-end"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex-shrink-0 w-11 h-11 rounded-2xl border flex items-center justify-center transition-colors hover:bg-[--border]"
          style={{ borderColor: imageFile ? 'var(--primary)' : 'var(--border)', color: imageFile ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          <ImageIcon size={17} />
        </button>
        <textarea
          ref={inputRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder="Type a message… (Enter to send)"
          rows={1}
          className="flex-1 rounded-2xl border px-4 py-3 text-sm outline-none focus:border-[--primary] resize-none"
          style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)', maxHeight: 120 }}
        />
        <button
          onClick={handleSend}
          disabled={(!body.trim() && !imageFile) || sending}
          className="flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ background: 'var(--primary)', color: '#000' }}
        >
          <Send size={17} />
        </button>
      </div>
      {imagePreview && (
        <div className="px-4 pb-3 border-t flex items-center gap-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagePreview} alt="Selected attachment" className="h-16 w-16 rounded-xl object-cover border" style={{ borderColor: 'var(--border)' }} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{imageFile?.name}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Image will be sent with your message.</p>
          </div>
          <button onClick={clearImage} className="p-2 rounded-xl hover:bg-[--border]" style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>
      )}
      {imageModal && (
        <div
          className="fixed inset-0 z-[2100] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.86)' }}
          onClick={() => setImageModal(null)}
        >
          <button
            type="button"
            onClick={() => setImageModal(null)}
            className="absolute right-4 top-4 h-10 w-10 rounded-full border flex items-center justify-center"
            style={{ borderColor: 'rgba(255,255,255,0.18)', color: '#fff', background: 'rgba(255,255,255,0.06)' }}
          >
            <X size={18} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); downloadImage(imageModal) }}
            className="absolute left-4 top-4 h-10 px-4 rounded-full border flex items-center gap-2 text-sm font-semibold"
            style={{ borderColor: 'rgba(255,255,255,0.18)', color: '#fff', background: 'rgba(255,255,255,0.06)' }}
          >
            <Download size={16} /> Download
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageModal} alt="Message attachment" className="max-h-[88vh] max-w-[92vw] rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      {addMembersOpen && conversation && (
        <div className="fixed inset-0 z-[2100] flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={(e) => e.target === e.currentTarget && setAddMembersOpen(false)}>
          <div className="w-full rounded-2xl border p-5 space-y-4" style={{ maxWidth: 460, background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">Add people</h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Invite friends into this group conversation.</p>
              </div>
              <button onClick={() => setAddMembersOpen(false)} style={{ color: 'var(--text-muted)' }}><X size={20} /></button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
              {friends
                .filter((friend) => !conversation.participants.some((participant) => participant.id === friend.id))
                .map((friend) => {
                  const active = selectedMembers.has(friend.id)
                  return (
                    <button
                      key={friend.id}
                      onClick={() => setSelectedMembers((current) => {
                        const next = new Set(current)
                        next.has(friend.id) ? next.delete(friend.id) : next.add(friend.id)
                        return next
                      })}
                      className="flex items-center gap-2 text-sm px-3 py-2 rounded-full border"
                      style={{
                        borderColor: active ? 'var(--primary)' : 'var(--border)',
                        color: active ? 'var(--primary)' : 'var(--text-primary)',
                        background: active ? 'rgba(57,255,20,0.08)' : 'transparent',
                      }}
                    >
                      <PersonAvatar person={friend} size={24} />
                      {friend.name}
                      {active && <Check size={13} />}
                    </button>
                  )
                })}
            </div>
            <button
              onClick={handleAddMembers}
              disabled={selectedMembers.size === 0 || addingMembers}
              className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-40"
              style={{ background: 'var(--primary)', color: '#000' }}
            >
              {addingMembers ? 'Adding...' : 'Add selected'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MessagesContent() {
  const { token, user } = useAuthStore()
  const router = useRouter()
  const params = useSearchParams()
  const conversationId = params.get('conversation')
  const userId = params.get('user')

  const [mounted, setMounted] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [compose, setCompose] = useState(false)
  const [friends, setFriends] = useState<Person[]>([])
  const [selectedRecipients, setSelectedRecipients] = useState<Person[]>([])
  const [groupTitle, setGroupTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [conversationSearch, setConversationSearch] = useState('')
  const [friendSearch, setFriendSearch] = useState('')

  useEffect(() => setMounted(true), [])

  const loadConversations = useCallback(() => {
    setLoading(true)
    api.get('/messages')
      .then(({ data }) => setConversations(data.data ?? []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!mounted) return
    if (!token) {
      router.replace('/login?redirect=/messages')
      return
    }
    if (!conversationId && !userId) {
      loadConversations()
    }
  }, [mounted, token, router, conversationId, userId, loadConversations])

  const loadFriends = useCallback(() => {
    api.get('/users', { params: { friends_only: 1 } })
      .then(({ data }) => setFriends(data.data ?? []))
      .catch(() => {})
  }, [])

  function openCompose() {
    setCompose(true)
    setSelectedRecipients([])
    setGroupTitle('')
    setBody('')
    setFriendSearch('')
    setSendError(null)
    loadFriends()
  }

  function toggleRecipient(friend: Person) {
    setSelectedRecipients((current) => {
      const exists = current.some((recipient) => recipient.id === friend.id)
      if (exists) {
        return current.filter((recipient) => recipient.id !== friend.id)
      }
      return [...current, friend]
    })
  }

  async function handleSendNewConversation() {
    if (selectedRecipients.length === 0 || !body.trim()) return

    setSending(true)
    setSendError(null)
    try {
      const { data } = await api.post('/messages/conversations', {
        participant_ids: selectedRecipients.map((recipient) => recipient.id),
        title: selectedRecipients.length > 1 ? groupTitle.trim() : undefined,
        body: body.trim(),
      })
      setCompose(false)
      router.push(`/messages?conversation=${data.conversation.id}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setSendError(msg ?? 'Failed to send. Try again.')
    } finally {
      setSending(false)
    }
  }

  async function handleDeleteConversation(conversation: Conversation) {
    const confirmText = conversation.is_group ? 'Leave this group conversation?' : 'Delete this conversation?'
    if (!window.confirm(confirmText)) return

    setDeleting(conversation.id)
    try {
      await api.delete(`/messages/conversations/${conversation.id}`)
      setConversations((current) => current.filter((item) => item.id !== conversation.id))
    } finally {
      setDeleting(null)
    }
  }

  const filteredConversations = conversations.filter((conversation) => {
    const query = conversationSearch.trim().toLowerCase()
    if (!query) return true

    const names = conversation.is_group
      ? [conversation.title ?? '', ...conversation.participants.map((participant) => participant.name)]
      : [conversation.partner?.name ?? '']

    return names.some((name) => name.toLowerCase().includes(query))
      || conversation.last_message.body.toLowerCase().includes(query)
  })

  const filteredFriends = friends.filter((friend) =>
    friend.name.toLowerCase().includes(friendSearch.trim().toLowerCase())
  )

  if (!mounted || !token || !user) return null

  if (conversationId || userId) {
    return (
      <ThreadView
        conversationId={conversationId}
        userId={userId}
        currentUserId={user.id}
        onBack={() => router.push('/messages')}
      />
    )
  }

  return (
    <main className="min-h-screen px-4 py-8">
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Messages</h1>
          <button
            onClick={openCompose}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-semibold transition-opacity hover:opacity-80"
            style={{ background: 'var(--primary)', color: '#000' }}
          >
            <Plus size={15} /> New Chat
          </button>
        </div>

        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            value={conversationSearch}
            onChange={(e) => setConversationSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-xl border pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[--primary] transition-colors"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
        </div>

        {compose && (
          <div
            className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={(e) => e.target === e.currentTarget && setCompose(false)}
          >
            <div
              className="w-full rounded-2xl border p-6 space-y-4"
              style={{ maxWidth: 520, background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-lg">New Chat</h2>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Pick one friend for a direct message or several for a group.
                  </p>
                </div>
                <button onClick={() => setCompose(false)} style={{ color: 'var(--text-muted)' }}>
                  <X size={20} />
                </button>
              </div>

              <div>
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Recipients</p>
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                  <input
                    value={friendSearch}
                    onChange={(e) => setFriendSearch(e.target.value)}
                    placeholder="Search friends..."
                    className="w-full rounded-xl border pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[--primary] transition-colors"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>

                {selectedRecipients.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedRecipients.map((recipient) => (
                      <button
                        key={recipient.id}
                        onClick={() => toggleRecipient(recipient)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors hover:bg-[--border]"
                        style={{ borderColor: 'rgba(57,255,20,0.25)', background: 'rgba(57,255,20,0.06)', color: 'var(--text-primary)' }}
                      >
                        <PersonAvatar person={recipient} size={22} />
                        <span>{recipient.name}</span>
                        <X size={13} />
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 max-h-52 overflow-y-auto pr-1">
                  {friends.length === 0 && (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      No friends yet.
                    </p>
                  )}
                  {friends.length > 0 && filteredFriends.length === 0 && (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      No friends match that search.
                    </p>
                  )}
                  {filteredFriends.map((friend) => {
                    const active = selectedRecipients.some((recipient) => recipient.id === friend.id)
                    return (
                      <button
                        key={friend.id}
                        onClick={() => toggleRecipient(friend)}
                        className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border transition-colors"
                        style={{
                          borderColor: active ? 'var(--primary)' : 'var(--border)',
                          color: active ? 'var(--primary)' : 'var(--text-primary)',
                          background: active ? 'rgba(57,255,20,0.08)' : 'transparent',
                        }}
                      >
                        <PersonAvatar person={friend} size={22} />
                        <span>{friend.name}</span>
                        {active && <Check size={13} />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedRecipients.length > 1 && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Group name</p>
                  <input
                    value={groupTitle}
                    onChange={(e) => setGroupTitle(e.target.value)}
                    placeholder="Optional group name"
                    className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-[--primary] transition-colors"
                    style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              )}

              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write a message…"
                rows={4}
                className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:border-[--primary] resize-none"
                style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
              />

              {sendError && (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
                  {sendError}
                </p>
              )}

              <button
                onClick={handleSendNewConversation}
                disabled={selectedRecipients.length === 0 || !body.trim() || sending}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ background: 'var(--primary)', color: '#000' }}
              >
                <Send size={15} /> {sending ? 'Sending…' : selectedRecipients.length > 1 ? 'Start Group Chat' : 'Send'}
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-16 text-sm" style={{ color: 'var(--text-muted)' }}>
            Loading…
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="text-center py-16">
            <MessageSquare size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No messages yet.</p>
          </div>
        )}

        {!loading && conversations.length > 0 && filteredConversations.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
            No conversations match that search.
          </div>
        )}

        <div className="space-y-2">
          {filteredConversations.map((conversation) => {
            const title = conversation.is_group
              ? (conversation.title || conversation.participants.map((participant) => participant.name).join(', '))
              : (conversation.partner?.name ?? 'Conversation')

            const previewPrefix = conversation.is_group && !conversation.last_message.is_mine
              ? `${conversation.last_message.sender.name}: `
              : conversation.last_message.is_mine
                ? 'You: '
                : ''

            return (
              <div key={conversation.id} className="flex items-center gap-2">
                <button
                  onClick={() => router.push(`/messages?conversation=${conversation.id}`)}
                  className="flex-1 flex items-center gap-3 p-4 rounded-2xl border transition-colors hover:bg-[--border] text-left min-w-0"
                  style={{ background: 'var(--surface)', borderColor: conversation.unread_count > 0 ? 'var(--primary)' : 'var(--border)' }}
                >
                  <ConversationAvatar conversation={conversation} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{title}</p>
                        {conversation.is_group && (
                          <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
                            {conversation.participants.length} members
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {conversation.unread_count > 0 && (
                          <span
                            style={{
                              minWidth: 20,
                              height: 20,
                              borderRadius: 999,
                              background: '#ef4444',
                              color: '#fff',
                              fontSize: 11,
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0 4px',
                            }}
                          >
                            {conversation.unread_count}
                          </span>
                        )}
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {timeAgo(conversation.last_message.created_at)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {previewPrefix}{conversation.last_message.body || (conversation.last_message.image_url ? 'Photo' : '')}
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => handleDeleteConversation(conversation)}
                  disabled={deleting === conversation.id}
                  title={conversation.is_group ? 'Leave conversation' : 'Delete conversation'}
                  className="flex-shrink-0 p-2.5 rounded-xl transition-colors hover:bg-red-500/10 disabled:opacity-40"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
                >
                  {deleting === conversation.id ? '…' : <Trash2 size={16} />}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}

export default function MessagesPage() {
  return (
    <>
      <Navbar />
      <Suspense>
        <MessagesContent />
      </Suspense>
    </>
  )
}
