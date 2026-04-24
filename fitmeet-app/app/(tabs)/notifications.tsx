import { Ionicons } from '@expo/vector-icons'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { mockNotifications } from '@/src/mock-data'
import { palette, spacing } from '@/src/theme'

export default function NotificationsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Notifications</Text>
          <View style={styles.statusPill}>
            <Ionicons name="checkmark-done" size={15} color={palette.accent} />
            <Text style={styles.statusText}>Seen badge clears here</Text>
          </View>
        </View>

        {mockNotifications.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name={item.icon as never} size={18} color={palette.accent} />
            </View>
            <View style={styles.bodyWrap}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
              <Text style={styles.cardTime}>{item.time}</Text>
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
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusText: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 22,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.panelRaised,
  },
  bodyWrap: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  cardBody: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  cardTime: {
    color: palette.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
})
