'use client'

import Image from 'next/image'

export type PublicUser = {
  id: number
  name: string
  avatar: string | null
}

function UserChip({ user }: { user: PublicUser }) {
  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const firstName = user.name.split(' ')[0]

  return (
    <div
      className="flex items-center gap-2 shrink-0 rounded-full border px-3 py-1.5"
      style={{ background: 'rgba(57,255,20,0.04)', borderColor: 'rgba(57,255,20,0.15)' }}
    >
      {user.avatar ? (
        <Image
          src={user.avatar}
          alt={firstName}
          width={22}
          height={22}
          className="rounded-full object-cover shrink-0"
          style={{ width: 22, height: 22 }}
        />
      ) : (
        <div
          className="shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-black"
          style={{ width: 22, height: 22, background: 'var(--primary)' }}
        >
          {initials}
        </div>
      )}
      <span className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
        {firstName}
      </span>
    </div>
  )
}

export function LatestUsersTicker({ users }: { users: PublicUser[] }) {
  if (users.length === 0) return null

  const doubled = [...users, ...users]

  return (
    <div
      className="mt-3 rounded-2xl border overflow-hidden"
      style={{ borderColor: 'rgba(57,255,20,0.12)', background: 'rgba(57,255,20,0.03)' }}
    >
      <div className="px-4 pt-3 pb-2 flex items-center gap-2">
        <div
          className="w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ background: 'var(--primary)' }}
        />
        <span
          className="text-[10px] uppercase tracking-widest font-bold"
          style={{ color: 'var(--primary)' }}
        >
          Recently joined
        </span>
      </div>

      <div className="overflow-hidden pb-3 px-2">
        <div className="flex gap-2 users-ticker">
          {doubled.map((u, i) => (
            <UserChip key={`${u.id}-${i}`} user={u} />
          ))}
        </div>
      </div>
    </div>
  )
}
