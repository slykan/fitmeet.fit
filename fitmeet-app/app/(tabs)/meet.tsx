import { Ionicons } from '@expo/vector-icons'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { mockEvents } from '@/src/mock-data'
import { palette, spacing } from '@/src/theme'

const chips = ['Going', 'Friends', 'My', 'Past']

export default function MeetScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Meet</Text>
          <View style={styles.searchStub}>
            <Ionicons name="search" size={16} color={palette.textDim} />
            <Text style={styles.searchLabel}>Search events</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {chips.map((chip, index) => (
            <View key={chip} style={index === 0 ? styles.activeChip : styles.chip}>
              <Text style={index === 0 ? styles.activeChipLabel : styles.chipLabel}>{chip}</Text>
            </View>
          ))}
        </ScrollView>

        {mockEvents.map((event, index) => (
          <View key={event.id} style={[styles.card, index === 2 && styles.cardMuted]}>
            <View style={styles.cardTop}>
              <View style={styles.cardTitleWrap}>
                <Text style={styles.cardTitle}>{event.title}</Text>
                <Text style={styles.cardMeta}>
                  {event.date} | {event.time} | {event.category}
                </Text>
              </View>
              <View style={event.cancelled ? styles.cancelBadge : styles.liveBadge}>
                <Text style={event.cancelled ? styles.cancelBadgeText : styles.liveBadgeText}>
                  {event.cancelled ? 'Cancelled' : 'Live'}
                </Text>
              </View>
            </View>
            <View style={styles.cardFooter}>
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={15} color={palette.textDim} />
                <Text style={styles.metaText}>{event.location}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={15} color={palette.textDim} />
                <Text style={styles.metaText}>{event.attendees} going</Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    gap: spacing.md,
  },
  title: {
    color: palette.text,
    fontSize: 30,
    fontWeight: '800',
  },
  searchStub: {
    height: 48,
    borderRadius: 16,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  searchLabel: {
    color: palette.textDim,
    fontSize: 14,
  },
  chipRow: {
    gap: 10,
    paddingVertical: 2,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
  },
  activeChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: palette.accent,
  },
  chipLabel: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  activeChipLabel: {
    color: '#041109',
    fontSize: 13,
    fontWeight: '800',
  },
  card: {
    backgroundColor: palette.panel,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardMuted: {
    opacity: 0.8,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  cardTitleWrap: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '800',
  },
  cardMeta: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  liveBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(94, 255, 73, 0.14)',
  },
  liveBadgeText: {
    color: palette.accent,
    fontWeight: '800',
    fontSize: 12,
  },
  cancelBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
  },
  cancelBadgeText: {
    color: '#ff8b8b',
    fontWeight: '800',
    fontSize: 12,
  },
  cardFooter: {
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  metaText: {
    color: palette.textMuted,
    fontSize: 14,
  },
})
