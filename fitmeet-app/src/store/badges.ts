import { create } from 'zustand'

export type UnlockedBadge = {
  key: string
  emoji: string
  name: string
  description: string
  unlocked_at: string
}

type BadgesState = {
  pendingQueue: UnlockedBadge[]
  current: UnlockedBadge | null
  enqueue: (badges: UnlockedBadge[]) => void
  dismiss: () => void
}

export const useBadgesStore = create<BadgesState>((set, get) => ({
  pendingQueue: [],
  current: null,

  enqueue: (badges) => {
    if (!badges?.length) return
    const { current, pendingQueue } = get()
    const nextQueue = [...pendingQueue, ...badges]

    if (!current) {
      const [next, ...rest] = nextQueue
      set({ current: next, pendingQueue: rest })
    } else {
      set({ pendingQueue: nextQueue })
    }
  },

  dismiss: () => {
    const { pendingQueue } = get()
    const [next, ...rest] = pendingQueue
    set({ current: next ?? null, pendingQueue: rest })
  },
}))
