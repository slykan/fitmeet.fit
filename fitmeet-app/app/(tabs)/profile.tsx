import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'

const preferenceRows = [
  { label: 'Friend activity', value: true },
  { label: 'New events near you', value: true },
  { label: 'Event reminders', value: true },
]

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.slice(0, 1).toUpperCase() ?? 'F'}</Text>
          </View>
          <View style={styles.profileMeta}>
            <Text style={styles.name}>{user?.name ?? 'FitMeet Demo'}</Text>
            <Text style={styles.email}>{user?.email ?? 'hello@fitmeet.fit'}</Text>
            <Text style={styles.location}>Zagreb | Region radius</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Email settings</Text>
          {preferenceRows.map((row) => (
            <View key={row.label} style={styles.preferenceRow}>
              <Text style={styles.preferenceLabel}>{row.label}</Text>
              <View style={row.value ? styles.toggleOn : styles.toggleOff}>
                <View style={row.value ? styles.toggleKnobOn : styles.toggleKnobOff} />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Next mobile slices</Text>
          {['Hub filters', 'Create event', 'Join and reminders', 'Messages sync'].map((item) => (
            <View key={item} style={styles.todoRow}>
              <Ionicons name="checkmark-circle-outline" size={18} color={palette.accent} />
              <Text style={styles.todoText}>{item}</Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => {
            void logout()
            router.replace('/welcome')
          }}
          style={styles.logoutButton}
        >
          <Ionicons name="log-out-outline" size={18} color="#ff9b9b" />
          <Text style={styles.logoutLabel}>Exit demo session</Text>
        </Pressable>
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
  title: {
    color: palette.text,
    fontSize: 30,
    fontWeight: '800',
  },
  profileCard: {
    backgroundColor: palette.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: palette.panelRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: palette.text,
    fontSize: 28,
    fontWeight: '800',
  },
  profileMeta: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  email: {
    color: palette.textMuted,
    fontSize: 14,
  },
  location: {
    color: palette.textDim,
    fontSize: 13,
  },
  section: {
    backgroundColor: palette.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 17,
    fontWeight: '800',
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preferenceLabel: {
    color: palette.textMuted,
    fontSize: 15,
    flex: 1,
    paddingRight: spacing.md,
  },
  toggleOn: {
    width: 50,
    height: 30,
    borderRadius: 999,
    backgroundColor: palette.accent,
    justifyContent: 'center',
    paddingHorizontal: 4,
    alignItems: 'flex-end',
  },
  toggleOff: {
    width: 50,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#303a56',
    justifyContent: 'center',
    paddingHorizontal: 4,
    alignItems: 'flex-start',
  },
  toggleKnobOn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#041109',
  },
  toggleKnobOff: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#dbe1ff',
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  todoText: {
    color: palette.textMuted,
    fontSize: 14,
  },
  logoutButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.18)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: spacing.xl,
  },
  logoutLabel: {
    color: '#ff9b9b',
    fontSize: 15,
    fontWeight: '700',
  },
})
