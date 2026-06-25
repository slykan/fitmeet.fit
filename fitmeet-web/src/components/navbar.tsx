'use client'

import { useAuthStore } from '@/store/auth'
import { useTheme } from 'next-themes'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Moon, Sun, Plus, LogOut, User, CalendarDays, Bell, Users, MessageSquare, Settings, Trophy, ShieldCheck, Megaphone } from 'lucide-react'
import { Button } from './ui/button'
import api from '@/lib/api'
import { useEffect, useRef, useState } from 'react'

const notificationsSeenKey = (userId: number) => `fitmeet-notifications-last-seen:${userId}`

export function Navbar() {
  const { user, logout } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const router  = useRouter()
  const [mounted,    setMounted]    = useState(false)
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [notifCount, setNotifCount] = useState(0)
  const [msgCount,   setMsgCount]   = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!user) return
    const userId = user.id
    function fetchCounts() {
      api.get('/notifications').then(({ data }) => {
        const items = data.data ?? []
        const lastSeenRaw = window.localStorage.getItem(notificationsSeenKey(userId))
        const lastSeenAt = lastSeenRaw ? new Date(lastSeenRaw).getTime() : 0
        const unseenCount = items.filter((item: { created_at?: string }) => {
          if (!item.created_at) return true
          return new Date(item.created_at).getTime() > lastSeenAt
        }).length
        setNotifCount(unseenCount)
      }).catch(() => {})
      api.get('/messages/unread-count').then(({ data }) => {
        setMsgCount(data.count ?? 0)
      }).catch(() => {})
    }
    fetchCounts()
    const id = setInterval(fetchCounts, 60_000)
    const handleSeen = () => setNotifCount(0)
    window.addEventListener('fitmeet-notifications-seen', handleSeen)
    window.addEventListener('storage', fetchCounts)
    return () => {
      clearInterval(id)
      window.removeEventListener('fitmeet-notifications-seen', handleSeen)
      window.removeEventListener('storage', fetchCounts)
    }
  }, [user])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    setMenuOpen(false)
    try { await api.post('/logout') } catch {}
    logout()
    router.push('/login')
  }

  function navigate(path: string) {
    if (path === '/notifications' && user && typeof window !== 'undefined') {
      window.localStorage.setItem(notificationsSeenKey(user.id), new Date().toISOString())
      setNotifCount(0)
      window.dispatchEvent(new Event('fitmeet-notifications-seen'))
    }
    setMenuOpen(false)
    router.push(path)
  }

  const isDark = theme === 'dark'

  return (
    <nav className="sticky top-0 z-[1001] border-b border-[--border] bg-[--surface]/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">

        <div className="flex items-center gap-3 md:gap-5">
          <Link href={user ? '/hub' : '/'} className="flex items-center">
            {mounted && (
              <Image
                src={isDark ? '/logo_c.png' : '/logo_b.png'}
                alt="FitMeet"
                width={36}
                height={36}
                className="object-contain"
              />
            )}
          </Link>
          {user && (
            <>
              <Link href="/meet"
                className="hidden md:block text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}>
                Meet
              </Link>
              <Link href="/ranks"
                className="hidden md:block text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}>
                Ranks
              </Link>
              <Link href="/notifications"
                className="hidden md:relative md:block text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}
                onClick={() => {
                  if (user && typeof window !== 'undefined') {
                    window.localStorage.setItem(notificationsSeenKey(user.id), new Date().toISOString())
                    setNotifCount(0)
                    window.dispatchEvent(new Event('fitmeet-notifications-seen'))
                  }
                }}>
                <span className="relative">
                  Alerts
                  {notifCount > 0 && (
                    <span className="absolute -top-1.5 -right-3.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[10px] font-bold px-1"
                      style={{ background: '#ef4444', color: '#fff' }}>
                      {notifCount > 99 ? '99+' : notifCount}
                    </span>
                  )}
                </span>
              </Link>
              <Link href="/messages"
                className="hidden md:block text-sm font-medium transition-colors hover:opacity-80"
                style={{ color: 'var(--text-muted)' }}>
                <span className="relative">
                  Messages
                  {msgCount > 0 && (
                    <span className="absolute -top-1.5 -right-3.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[10px] font-bold px-1"
                      style={{ background: '#ef4444', color: '#fff' }}>
                      {msgCount > 99 ? '99+' : msgCount}
                    </span>
                  )}
                </span>
              </Link>
            </>
          )}
          <Link
            href="/blog"
            className={`hidden ${user ? 'lg:block' : 'md:block'} text-sm font-medium transition-colors hover:opacity-80`}
            style={{ color: 'var(--text-muted)' }}
          >
            Blog
          </Link>
          <Link
            href="/about"
            className={`hidden ${user ? 'lg:block' : 'md:block'} text-sm font-medium transition-colors hover:opacity-80`}
            style={{ color: 'var(--text-muted)' }}
          >
            About
          </Link>
          <Link
            href="/press"
            className={`hidden ${user ? 'lg:block' : 'md:block'} text-sm font-medium transition-colors hover:opacity-80`}
            style={{ color: 'var(--text-muted)' }}
          >
            Press
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="p-2 rounded-lg hover:bg-[--surface] text-[--text-muted] hover:text-[--text-primary] transition-colors"
          >
            {mounted && (isDark ? <Sun size={18} /> : <Moon size={18} />)}
          </button>

          {user ? (
            <>
              <Link
                href="/meet"
                className="p-2 rounded-lg text-[--text-muted] hover:text-[--text-primary] transition-colors"
                title="Meet"
              >
                <CalendarDays size={18} />
              </Link>

              <Link
                href="/ranks"
                className="p-2 rounded-lg text-[--text-muted] hover:text-[--text-primary] transition-colors"
                title="Community Badges"
              >
                <Trophy size={18} />
              </Link>

              <Link
                href="/notifications"
                className="relative p-2 rounded-lg text-[--text-muted] hover:text-[--text-primary] transition-colors"
                title="Notifications"
              >
                <Bell size={18} />
                {notifCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 4, right: 4,
                    minWidth: 16, height: 16, borderRadius: 999,
                    background: '#ef4444', color: '#fff',
                    fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1, padding: '0 3px',
                  }}>
                    {notifCount > 99 ? '99+' : notifCount}
                  </span>
                )}
              </Link>

              <Link
                href="/messages"
                className="relative p-2 rounded-lg text-[--text-muted] hover:text-[--text-primary] transition-colors"
                title="Messages"
              >
                <MessageSquare size={18} />
                {msgCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 4, right: 4,
                    minWidth: 16, height: 16, borderRadius: 999,
                    background: '#ef4444', color: '#fff',
                    fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1, padding: '0 3px',
                  }}>
                    {msgCount > 99 ? '99+' : msgCount}
                  </span>
                )}
              </Link>

              <Button size="sm" onClick={() => router.push('/events/create')} className="!px-2.5">
                <Plus size={18} />
              </Button>

              {/* Profile dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(o => !o)}
                  className="p-2 rounded-xl hover:bg-[--border] transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <User size={20} />
                </button>

                {menuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-52 rounded-2xl border shadow-xl overflow-hidden"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    {/* User info header */}
                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-sm font-semibold truncate">{user.name}</p>
                    </div>

                    <div className="py-1">
                      <MenuItem icon={<Bell size={15} />}         label="Notifications" onClick={() => navigate('/notifications')} badge={notifCount} />
                      <MenuItem icon={<ShieldCheck size={15} />}  label="Your Alibi"   onClick={() => navigate('/alibi')} />
                      <MenuItem icon={<Settings size={15} />}     label="Settings"     onClick={() => navigate('/profile')} />
                      <MenuItem icon={<Users size={15} />}        label="Meet"         onClick={() => navigate('/meet')} />
                      <MenuItem icon={<CalendarDays size={15} />} label="My Events"    onClick={() => navigate('/events/my')} />
                      {user.is_admin && (
                        <MenuItem icon={<Megaphone size={15} />} label="Admin" onClick={() => navigate('/admin')} />
                      )}
                    </div>

                    <div className="border-t py-1" style={{ borderColor: 'var(--border)' }}>
                      <MenuItem
                        icon={<LogOut size={15} />}
                        label="Sign out"
                        onClick={handleLogout}
                        danger
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Button size="sm" onClick={() => router.push('/login')}>Sign in</Button>
          )}
        </div>
      </div>
    </nav>
  )
}

function MenuItem({
  icon, label, onClick, danger, badge,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-[--border]"
      style={{ color: danger ? 'var(--destructive, #f87171)' : 'var(--text-primary)' }}
    >
      <span style={{ color: danger ? 'inherit' : 'var(--text-muted)' }}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge != null && badge > 0 && (
        <span style={{
          minWidth: 18, height: 18, borderRadius: 999,
          background: '#ef4444', color: '#fff',
          fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 4px',
        }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}
