'use client'

import { useAuthStore } from '@/store/auth'
import { useTheme } from 'next-themes'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Moon, Sun, Plus, LogOut, User, CalendarDays } from 'lucide-react'
import { Button } from './ui/button'
import api from '@/lib/api'
import { useEffect, useState } from 'react'

export function Navbar() {
  const { user, logout } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  async function handleLogout() {
    try { await api.post('/logout') } catch {}
    logout()
    router.push('/login')
  }

  const isDark = theme === 'dark'

  return (
    <nav className="sticky top-0 z-50 border-b border-[--border] bg-[--surface]/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">

        <Link href="/" className="flex items-center">
          {mounted && (
            <Image
              src={isDark ? '/logo_c.png' : '/logo_b.png'}
              alt="FitMeet"
              width={36}
              height={36}
              className="object-contain"
            />
          )}
          <span className="ml-2 text-lg font-bold tracking-widest uppercase text-[--text-primary]">
            FitMeet
          </span>
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
              <Button size="sm" onClick={() => router.push('/events/create')}>
                <Plus size={15} className="mr-1" /> New Event
              </Button>

              <Link href="/profile" className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-[--surface] transition-colors">
                {user.avatar ? (
                  <Image src={user.avatar} alt={user.name} width={32} height={32} className="rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[--primary] flex items-center justify-center">
                    <User size={15} className="text-black" />
                  </div>
                )}
                <span className="text-sm font-medium hidden sm:block">{user.name.split(' ')[0]}</span>
              </Link>

              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-[--text-muted] hover:text-[--text-primary] transition-colors"
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <Button size="sm" onClick={() => router.push('/login')}>Sign in</Button>
          )}
        </div>
      </div>
    </nav>
  )
}
