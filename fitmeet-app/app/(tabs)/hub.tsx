import { Ionicons } from '@expo/vector-icons'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { FILTER_FEATURED } from '@/src/lib/categories'
import { mockEvents } from '@/src/mock-data'
import { palette, spacing } from '@/src/theme'

export default function HubScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Hub</Text>
            <Text style={styles.title}>Nearby energy</Text>
          </View>
          <View style={styles.recenterChip}>
            <Ionicons name="locate-outline" size={16} color={palette.accent} />
            <Text style={styles.recenterLabel}>Recenter</Text>
          </View>
        </View>

        <View style={styles.mapCard}>
          <View style={styles.radar} />
          {mockEvents.slice(0, 3).map((event, index) => (
            <View
              key={event.id}
              style={[
                styles.marker,
                {
                  top: 70 + index * 82,
                  left: index === 1 ? 214 : 42 + index * 48,
                },
              ]}
            >
              <View style={styles.markerHead}>
                <Text style={styles.markerEmoji}>{event.emoji}</Text>
              </View>
              <View style={styles.markerStem} />
            </View>
          ))}
          <View style={styles.mapOverlay}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <View style={styles.filterChipActive}>
                <Text style={styles.filterLabelActive}>All interests</Text>
              </View>
              {FILTER_FEATURED.map((filter) => (
                <View key={filter} style={styles.filterChip}>
                  <Text style={styles.filterLabel}>{filter}</Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>Region</Text>
              <View style={styles.sliderTrack}>
                <View style={styles.sliderProgress} />
                <View style={styles.sliderThumb} />
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>On the map right now</Text>
          <Text style={styles.sectionHint}>Preview cards</Text>
        </View>

        {mockEvents.map((event) => (
          <View key={event.id} style={styles.eventCard}>
            <View style={styles.eventTop}>
              <View style={styles.eventBadge}>
                <Text style={styles.eventEmoji}>{event.emoji}</Text>
              </View>
              <View style={styles.eventMeta}>
                <Text style={styles.eventTitle}>{event.title}</Text>
                <Text style={styles.eventSubtitle}>
                  {event.category} | {event.time}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.textDim} />
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
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    color: palette.text,
    fontSize: 30,
    fontWeight: '800',
  },
  recenterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recenterLabel: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  mapCard: {
    height: 360,
    borderRadius: 28,
    backgroundColor: '#0b1222',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.line,
  },
  radar: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 999,
    alignSelf: 'center',
    top: 34,
    backgroundColor: 'rgba(70, 255, 120, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(70, 255, 120, 0.12)',
  },
  marker: {
    position: 'absolute',
    alignItems: 'center',
  },
  markerHead: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#070b18',
    borderWidth: 3,
    borderColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerEmoji: {
    fontSize: 22,
  },
  markerStem: {
    width: 6,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(94, 255, 73, 0.55)',
    marginTop: -2,
  },
  mapOverlay: {
    marginTop: 'auto',
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: 'rgba(6, 8, 18, 0.84)',
  },
  filterRow: {
    gap: 10,
  },
  filterChipActive: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: palette.accent,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: palette.panelRaised,
    borderWidth: 1,
    borderColor: palette.line,
  },
  filterLabelActive: {
    color: '#031109',
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  filterLabel: {
    color: palette.text,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  sliderRow: {
    gap: 10,
  },
  sliderLabel: {
    color: palette.textMuted,
    fontWeight: '700',
  },
  sliderTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#25304f',
    justifyContent: 'center',
  },
  sliderProgress: {
    position: 'absolute',
    width: '64%',
    height: 8,
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  sliderThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.accent,
    marginLeft: '60%',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  sectionHint: {
    color: palette.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  eventCard: {
    backgroundColor: palette.panel,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.md,
  },
  eventTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  eventBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: palette.panelRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventEmoji: {
    fontSize: 24,
  },
  eventMeta: {
    flex: 1,
    gap: 4,
  },
  eventTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  eventSubtitle: {
    color: palette.textMuted,
    fontSize: 14,
  },
})
