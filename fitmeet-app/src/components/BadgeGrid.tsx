import { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'

import { api } from '@/src/lib/api'
import { palette, spacing } from '@/src/theme'

export interface BadgeGridItem {
  key: string
  emoji: string
  name: string
  description: string
  unlocked: boolean
  unlocked_at: string | null
}

function Tile({ badge }: { badge: BadgeGridItem }) {
  function showDetail() {
    const dateLine = badge.unlocked && badge.unlocked_at
      ? `\n\nUnlocked ${new Date(badge.unlocked_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
      : ''
    Alert.alert(`${badge.emoji} ${badge.name}`, badge.description + dateLine)
  }

  return (
    <Pressable style={[styles.tile, !badge.unlocked && styles.tileLocked]} onPress={showDetail}>
      <Text style={[styles.emoji, !badge.unlocked && styles.emojiLocked]}>{badge.emoji}</Text>
      <Text style={[styles.name, !badge.unlocked && styles.nameLocked]} numberOfLines={1}>{badge.name}</Text>
    </Pressable>
  )
}

export function BadgeGrid({ badges: providedBadges }: { badges?: BadgeGridItem[] }) {
  const [fetched, setFetched] = useState<BadgeGridItem[] | null>(null)

  useEffect(() => {
    if (providedBadges) return
    api.get('/badges').then(({ data }) => setFetched(data.data)).catch(() => {})
  }, [providedBadges])

  const badges = providedBadges ?? fetched
  if (!badges) return null

  const unlockedCount = badges.filter(b => b.unlocked).length

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.icon}>🏅</Text>
        <View>
          <Text style={styles.title}>Badges</Text>
          <Text style={styles.subtitle}>{unlockedCount} of {badges.length} unlocked</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {badges.map(b => <Tile key={b.key} badge={b} />)}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.panel,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(57,255,20,0.2)',
    padding: spacing.md,
    gap: spacing.md,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon:     { fontSize: 28 },
  title:    { color: palette.text, fontSize: 16, fontWeight: '800' },
  subtitle: { color: palette.textDim, fontSize: 11, marginTop: 1 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tile: {
    width: 76,
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(57,255,20,0.08)',
    borderRadius: 14,
    paddingVertical: 10,
  },
  tileLocked: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  emoji: { fontSize: 26 },
  emojiLocked: { opacity: 0.28 },
  name: {
    color: palette.text,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  nameLocked: {
    color: palette.textDim,
    opacity: 0.5,
  },
})
