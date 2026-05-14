'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Trophy, Users, Zap } from 'lucide-react'

export type PublicStats = {
  users_count: number
  last_user_name: string | null
  events_count: number
  comments_count: number
}

function useCountUp(target: number, active: boolean, duration = 1800) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!active || target === 0) return

    const start = performance.now()

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }, [active, target, duration])

  return value
}

type StatBoxProps = {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  label: string
  value: number | null
  isName?: boolean
  nameValue?: string | null
  active: boolean
}

function StatBox({ icon: Icon, label, value, isName, nameValue, active }: StatBoxProps) {
  const counted = useCountUp(value ?? 0, active && !isName)

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-3"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(57,255,20,0.1)' }}
      >
        <Icon size={18} style={{ color: 'var(--primary)' }} />
      </div>

      {isName ? (
        <div>
          <p
            className="text-xl font-bold leading-snug"
            style={{
              transition: 'opacity 0.4s',
              opacity: active ? 1 : 0,
            }}
          >
            {nameValue ?? '—'}
          </p>
        </div>
      ) : (
        <p className="text-3xl font-bold tabular-nums">
          {counted.toLocaleString()}
          <span style={{ color: 'var(--primary)' }}>+</span>
        </p>
      )}

      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
    </div>
  )
}

export function PublicStatsSection({ stats }: { stats: PublicStats }) {
  const ref = useRef<HTMLElement | null>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true)
          observer.disconnect()
        }
      },
      { threshold: 0.25 },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={ref} className="py-16 md:py-20 border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="max-w-2xl mb-10">
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--primary)' }}>
            By the numbers
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">A community that keeps growing.</h2>
          <p className="text-base leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Real people, real events. Here is a live snapshot of what is happening on FitMeet right now.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatBox
            icon={Users}
            label="Members joined"
            value={stats.users_count}
            active={active}
          />
          <StatBox
            icon={Trophy}
            label="Latest member"
            isName
            nameValue={stats.last_user_name}
            value={null}
            active={active}
          />
          <StatBox
            icon={Zap}
            label="Events created"
            value={stats.events_count}
            active={active}
          />
          <StatBox
            icon={MessageCircle}
            label="Comments posted"
            value={stats.comments_count}
            active={active}
          />
        </div>
      </div>
    </section>
  )
}
