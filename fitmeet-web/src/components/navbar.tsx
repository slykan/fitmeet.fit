'use client'

import { useAuthStore } from '@/store/auth'
import { useTheme } from 'next-themes'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Moon, Sun, Plus, LogOut, User, CalendarDays, Bell, Users } from 'lucide-react'
import { Button } from './ui/button'
import api from '@/lib/api'
import { useEffect, useRef, useState } from 'react'

export function Navbar() {
  const { user, logout } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const router  = useRouter()
  const [mounted,    setMounted]    = useState(false)
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [notifCount, setNotifCount] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!user) return
    function fetchCount() {
      api.get('/notifications').then(({ data }) => {
        setNotifCount((data.data ?? []).length)
      }).catch(() => {})
    }
    fetchCount()
    const id = setInterval(fetchCount, 60_000)
    return () => clearInterval(id)
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
    setMenuOpen(false)
    router.push(path)
  }

  const isDark = theme === 'dark'

  return (
    <nav className="sticky top-0 z-[1001] border-b border-[--border] bg-[--surface]/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">

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
                href="/events/my"
                className="p-2 rounded-lg text-[--text-muted] hover:text-[--text-primary] transition-colors"
                title="My events"
              >
                <CalendarDays size={18} />
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

              <Button size="sm" onClick={() => router.push('/events/create')}>
                <Plus size={15} className="mr-1" /> New Event
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
                      <MenuItem icon={<Bell size={15} />} label="Notifications" onClick={() => navigate('/notifications')} badge={notifCount} />
                      <MenuItem icon={<User size={15} />} label="Profile"       onClick={() => navigate('/onboarding')} />
                      <MenuItem icon={<Users size={15} />} label="Meet"         onClick={() => navigate('/meet')} />
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
