import { LinearGradient } from 'expo-linear-gradient'
import { useMemo } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

import type { LiveParticipant } from '@/src/components/EventMapCard'
import { palette } from '@/src/theme'

type Props = {
  /** Ordered route points, e.g. the parsed GPX track. */
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
// bar, not for precise distance ranking (deviating from the route just pins
// you to the closest point you were last near).
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
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
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
    <View style={styles.wrap}>
      <View style={styles.track}>
        <LinearGradient
          colors={['rgba(57,255,20,0.15)', palette.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${leadProgress}%` }]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.sheen}
          />
        </LinearGradient>
        {groups.map((group) => (
          <Pressable
            key={group.participants.map((p) => p.id).join('-')}
            style={[styles.bubble, { left: `${Math.min(96, Math.max(0, group.progress * 100))}%` }]}
            onPress={() => onGroupTap?.(group.participants)}
          >
            {group.participants.length === 1 ? (
              group.participants[0].avatar ? (
                <Image source={{ uri: group.participants[0].avatar }} style={styles.bubbleImg} />
              ) : (
                <Text style={styles.bubbleText}>{initialFor(group.participants[0].name)}</Text>
              )
            ) : (
              <Text style={styles.bubbleText}>{group.participants.length}</Text>
            )}
          </Pressable>
        ))}
      </View>
      <View style={styles.labels}>
        <Text style={styles.labelText}>Start</Text>
        <Text style={styles.labelText}>Finish</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 4, paddingTop: 10 },
  track: {
    height: 14,
    borderRadius: 999,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.accent,
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '55%',
  },
  bubble: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    marginLeft: -16,
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: palette.accent,
    borderWidth: 2,
    borderColor: '#0b1120',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 1,
    elevation: 3,
  },
  bubbleImg: { width: '100%', height: '100%' },
  bubbleText: { color: '#041109', fontSize: 13, fontWeight: '800' },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  labelText: { color: palette.textDim, fontSize: 10, fontWeight: '700' },
})
