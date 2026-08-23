'use client'

import { useMemo } from 'react'
import type { LiveParticipant } from '@/components/location-picker-map'

interface Props {
  track: [number, number][]
  participants: LiveParticipant[]
  onGroupTap?: (participants: LiveParticipant[]) => void
}

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371
  const dLat = (b[0] - a[0]) * Math.PI / 180
  const dLng = (b[1] - a[1]) * Math.PI / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function cumulativeKm(track: [number, number][]) {
  const cum = [0]
  for (let i = 1; i < track.length; i++) cum.push(cum[i - 1] + haversineKm(track[i - 1], track[i]))
  return cum
}

// Approximate progress: nearest existing track point, not a true perpendicular
// projection onto the route — good enough for a "roughly where everyone is"
// bar, not for precise distance ranking.
function nearestPointProgress(track: [number, number][], cum: number[], pos: [number, number]): number | null {
  const total = cum[cum.length - 1]
  if (!track.length || !total) return null
  let bestIdx = 0
  let bestDist = Infinity
  for (let i = 0; i < track.length; i++) {
    const d = haversineKm(track[i], pos)
    if (d < bestDist) { bestDist = d; bestIdx = i }
  }
  return cum[bestIdx] / total
}

function initialFor(name: string) {
  return (name || '?').charAt(0).toUpperCase()
}

const GROUP_THRESHOLD = 0.035

export function LiveProgressBar({ track, participants, onGroupTap }: Props) {
  const cum = useMemo(() => cumulativeKm(track), [track])

  const groups = useMemo(() => {
    if (track.length < 2) return []
    const withProgress = participants
      .map((p) => ({ p, progress: nearestPointProgress(track, cum, [p.lat, p.lng]) }))
      .filter((x): x is { p: LiveParticipant; progress: number } => x.progress != null)
      .sort((a, b) => a.progress - b.progress)

    const used = new Array(withProgress.length).fill(false)
    const result: { progress: number; participants: LiveParticipant[] }[] = []
    for (let i = 0; i < withProgress.length; i++) {
      if (used[i]) continue
      const group = [withProgress[i]]
      used[i] = true
      for (let j = i + 1; j < withProgress.length; j++) {
        if (used[j]) continue
        if (withProgress[j].progress - group[group.length - 1].progress < GROUP_THRESHOLD) {
          group.push(withProgress[j])
          used[j] = true
        }
      }
      const avgProgress = group.reduce((sum, g) => sum + g.progress, 0) / group.length
      result.push({ progress: avgProgress, participants: group.map((g) => g.p) })
    }
    return result
  }, [track, cum, participants])

  if (track.length < 2 || groups.length === 0) return null

  const leadProgress = Math.min(100, Math.max(0, Math.max(...groups.map((g) => g.progress)) * 100))

  return (
    <div style={{ padding: '10px 4px 0' }}>
      <div
        style={{
          position: 'relative',
          height: 28,
          borderRadius: 999,
          background: 'var(--surface)',
          border: '1.5px solid var(--primary)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${leadProgress}%`,
            borderRadius: 999,
            background: 'linear-gradient(90deg, rgba(57,255,20,0.15), var(--primary))',
          }}
        />
        {groups.map((group) => (
          <button
            key={group.participants.map((p) => p.id).join('-')}
            type="button"
            onClick={() => onGroupTap?.(group.participants)}
            style={{
              position: 'absolute',
              top: 1,
              left: `${Math.min(96, Math.max(0, group.progress * 100))}%`,
              width: 24,
              height: 24,
              borderRadius: 999,
              background: 'var(--primary)',
              border: '2px solid #0b1120',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {group.participants.length === 1 ? (
              group.participants[0].avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={group.participants[0].avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ color: '#041109', fontSize: 10, fontWeight: 800 }}>{initialFor(group.participants[0].name)}</span>
              )
            ) : (
              <span style={{ color: '#041109', fontSize: 10, fontWeight: 800 }}>{group.participants.length}</span>
            )}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}>Start</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}>Finish</span>
      </div>
    </div>
  )
}
