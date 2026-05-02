import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { palette, spacing } from '@/src/theme'

type Props = {
  variant?: 'hub' | 'meet'
}

const FLOATING: { icon: keyof typeof Ionicons.glyphMap; top: number; left: number; size: number; opacity: number }[] = [
  { icon: 'bicycle-outline',    top: 8,  left: 18,  size: 22, opacity: 0.45 },
  { icon: 'people-outline',     top: 4,  left: 62,  size: 18, opacity: 0.35 },
  { icon: 'walk-outline',       top: 18, left: 84,  size: 20, opacity: 0.40 },
  { icon: 'football-outline',   top: 68, left: 6,   size: 18, opacity: 0.30 },
  { icon: 'fitness-outline',    top: 72, left: 80,  size: 20, opacity: 0.38 },
  { icon: 'boat-outline',       top: 78, left: 48,  size: 16, opacity: 0.28 },
]

export function EmptyEvents({ variant = 'hub' }: Props) {
  const isHub = variant === 'hub'

  return (
    <View style={styles.wrap}>
      {/* Graphic */}
      <View style={styles.graphic}>
        {/* Glow rings */}
        <View style={[styles.ring, styles.ringOuter]} />
        <View style={[styles.ring, styles.ringInner]} />

        {/* Floating sport icons */}
        {FLOATING.map((f) => (
          <View
            key={f.icon}
            style={[styles.floatIcon, { top: `${f.top}%` as never, left: `${f.left}%` as never }]}
          >
            <Ionicons name={f.icon} size={f.size} color={palette.accent} style={{ opacity: f.opacity }} />
          </View>
        ))}

        {/* Centre icon */}
        <View style={styles.centre}>
          <Ionicons
            name={isHub ? 'location-outline' : 'calendar-outline'}
            size={38}
            color={palette.accent}
          />
        </View>
      </View>

      {/* Copy */}
      <Text style={styles.title}>
        {isHub ? 'Nothing nearby yet' : 'Your calendar is clear'}
      </Text>
      <Text style={styles.body}>
        {isHub
          ? 'No events in this area match your interests. Be the first — create one and invite your friends to move together.'
          : 'You haven\'t joined any upcoming events. Browse the Hub or start your own and get people moving.'}
      </Text>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable style={styles.btnPrimary} onPress={() => router.push('/event/create' as never)}>
          <Ionicons name="add-circle-outline" size={18} color="#041109" />
          <Text style={styles.btnPrimaryText}>Create event</Text>
        </Pressable>
        {!isHub && (
          <Pressable style={styles.btnSecondary} onPress={() => router.push('/(tabs)/hub' as never)}>
            <Text style={styles.btnSecondaryText}>Browse Hub</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: 14,
  },

  graphic: {
    width: 180,
    height: 180,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
  },
  ringOuter: {
    width: 170,
    height: 170,
    borderColor: `${palette.accent}18`,
    backgroundColor: `${palette.accent}04`,
  },
  ringInner: {
    width: 118,
    height: 118,
    borderColor: `${palette.accent}28`,
    backgroundColor: `${palette.accent}08`,
  },

  floatIcon: {
    position: 'absolute',
  },

  centre: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: `${palette.accent}14`,
    borderWidth: 1,
    borderColor: `${palette.accent}35`,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  body: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 300,
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: palette.accent,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 16,
  },
  btnPrimaryText: {
    color: '#041109',
    fontSize: 15,
    fontWeight: '800',
  },
  btnSecondary: {
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel,
  },
  btnSecondaryText: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
})
