import { Ionicons } from '@expo/vector-icons'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { mockChats } from '@/src/mock-data'
import { palette, spacing } from '@/src/theme'

export default function MessagesScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Messages</Text>
          <View style={styles.composeChip}>
            <Ionicons name="add" size={16} color={palette.accent} />
            <Text style={styles.composeLabel}>New group</Text>
          </View>
        </View>

        <View style={styles.searchStub}>
          <Ionicons name="search" size={16} color={palette.textDim} />
          <Text style={styles.searchLabel}>Search people and groups</Text>
        </View>

        {mockChats.map((chat) => (
          <View key={chat.id} style={styles.chatRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{chat.initials}</Text>
            </View>
            <View style={styles.chatMeta}>
              <View style={styles.chatTop}>
                <Text style={styles.chatName}>{chat.name}</Text>
                <Text style={styles.chatTime}>{chat.time}</Text>
              </View>
              <Text style={styles.chatPreview}>{chat.preview}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: palette.text,
    fontSize: 30,
    fontWeight: '800',
  },
  composeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel,
  },
  composeLabel: {
    color: palette.text,
    fontWeight: '700',
    fontSize: 13,
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
  chatRow: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 22,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.panelRaised,
  },
  avatarText: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
  },
  chatMeta: {
    flex: 1,
    gap: 6,
  },
  chatTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  chatName: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  chatTime: {
    color: palette.textDim,
    fontSize: 12,
  },
  chatPreview: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
})
