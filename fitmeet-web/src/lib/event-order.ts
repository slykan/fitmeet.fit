type SchedulableEvent = {
  schedule: {
    start_at: string
    duration_minutes: number | null
  }
}

function eventTimes(event: SchedulableEvent) {
  const start = new Date(event.schedule.start_at).getTime()
  const durationMs = (event.schedule.duration_minutes ?? 60) * 60_000
  const end = start + durationMs
  const now = Date.now()

  return {
    start,
    end,
    inProgress: start <= now && now < end,
    past: now >= end,
  }
}

export function sortEventsBySchedule<T extends SchedulableEvent>(events: T[], pastOnly = false): T[] {
  return [...events].sort((a, b) => {
    const timeA = eventTimes(a)
    const timeB = eventTimes(b)

    if (pastOnly) {
      if (timeA.start !== timeB.start) return timeB.start - timeA.start
      return 0
    }

    if (timeA.inProgress !== timeB.inProgress) return timeA.inProgress ? -1 : 1
    if (timeA.start !== timeB.start) return timeA.start - timeB.start
    return 0
  })
}
