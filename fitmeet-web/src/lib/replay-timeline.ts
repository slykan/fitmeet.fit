import type { ReplayTrack } from '@/components/route-replay-map'

// A stretch where nobody moves (a break, waiting for the group) plays as if it were
// this long, instead of its real length, so the replay doesn't sit on a frozen marker.
const IDLE_AS_REAL_MS = 60000

type TimelineSegment = {
  realStart: number
  realEnd: number
  replayStart: number
  replayEnd: number
  label: string | null
}

// Maps the replay clock to real time. Stretches where nobody is moving — outside
// every rider's own movement and stops (track-history meta.pauses) — play as
// IDLE_AS_REAL_MS, everything else at its real length, so riders stay in sync.
export function buildTimeline(tracks: ReplayTrack[], commonStartMs: number, totalRealMs: number) {
  const active: [number, number][] = []
  for (const t of tracks) {
    let cursor = new Date(t.points[0].recorded_at).getTime() - commonStartMs
    const end = new Date(t.points[t.points.length - 1].recorded_at).getTime() - commonStartMs
    const stops = (t.pauses ?? [])
      .map(([a, b]) => [new Date(a).getTime() - commonStartMs, new Date(b).getTime() - commonStartMs] as [number, number])
      .sort((x, y) => x[0] - y[0])
    for (const [a, b] of stops) {
      if (a > cursor) active.push([cursor, Math.min(a, end)])
      cursor = Math.max(cursor, b)
    }
    if (end > cursor) active.push([cursor, end])
  }
  active.sort((x, y) => x[0] - y[0])
  const merged: [number, number][] = []
  for (const iv of active) {
    const last = merged[merged.length - 1]
    if (last && iv[0] <= last[1]) last[1] = Math.max(last[1], iv[1])
    else merged.push([iv[0], iv[1]])
  }

  const segments: TimelineSegment[] = []
  let real = 0
  let replay = 0
  const push = (realEnd: number, idle: boolean) => {
    const len = realEnd - real
    if (len <= 0) return
    const squeeze = idle && len > IDLE_AS_REAL_MS
    const replayLen = squeeze ? IDLE_AS_REAL_MS : len
    segments.push({
      realStart: real, realEnd, replayStart: replay, replayEnd: replay + replayLen,
      label: squeeze ? `Break · ${Math.round(len / 60000)} min` : null,
    })
    real = realEnd
    replay += replayLen
  }
  for (const [a, b] of merged) {
    push(Math.min(a, totalRealMs), true)
    push(Math.min(b, totalRealMs), false)
  }
  push(totalRealMs, true)

  return {
    totalMs: replay,
    toReal(replayMs: number): { realMs: number; idleLabel: string | null } {
      const seg = segments.find(s => replayMs <= s.replayEnd) ?? segments[segments.length - 1]
      if (!seg) return { realMs: replayMs, idleLabel: null }
      const span = seg.replayEnd - seg.replayStart
      const frac = span > 0 ? Math.min(1, Math.max(0, (replayMs - seg.replayStart) / span)) : 1
      return { realMs: seg.realStart + frac * (seg.realEnd - seg.realStart), idleLabel: seg.label }
    },
  }
}
