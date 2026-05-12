type SchedulableEvent = {
  schedule: {
    start_at: string
    duration_minutes: number | null
  }
  is_in_progress?: boolean
}

export function sortEventsBySchedule<T extends SchedulableEvent>(
  events: T[],
  options?: { pastOnly?: boolean; direction?: 'asc' | 'desc' },
): T[] {
  const pastOnly = options?.pastOnly ?? false
  const direction = options?.direction ?? 'asc'

  return [...events].sort((a, b) => {
    const startA = new Date(a.schedule.start_at).getTime()
    const startB = new Date(b.schedule.start_at).getTime()
    const endA = startA + (a.schedule.duration_minutes ?? 60) * 60_000
    const endB = startB + (b.schedule.duration_minutes ?? 60) * 60_000
    const now = Date.now()
    const inProgressA = a.is_in_progress ?? (startA <= now && now < endA)
    const inProgressB = b.is_in_progress ?? (startB <= now && now < endB)

    if (pastOnly) {
      return direction === 'asc' ? startB - startA : startA - startB
    }

    if (inProgressA !== inProgressB) return inProgressA ? -1 : 1
    if (startA !== startB) return direction === 'asc' ? startA - startB : startB - startA
    return 0
  })
}
