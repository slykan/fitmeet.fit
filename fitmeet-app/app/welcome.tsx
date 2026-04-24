import { router } from 'expo-router'
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'

import { palette, spacing } from '@/src/theme'

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.brand}>FitMeet mobile</Text>
          <Text style={styles.title}>Find your people. Move together.</Text>
          <Text style={styles.subtitle}>
            Mobile shell is alive. Next up is real auth, Hub, Meet, messages and notifications.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What is ready</Text>
          <Text style={styles.cardBody}>Email login is wired. Tabs and app structure are in place.</Text>
        </View>

        <Pressable style={styles.primaryButton} onPress={() => router.push('/login')}>
          <Text style={styles.primaryLabel}>Open sign in</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  hero: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  brand: {
    color: palette.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    color: palette.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    borderRadius: 20,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.lg,
    gap: 8,
  },
  cardTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
  },
  cardBody: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  primaryButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  primaryLabel: {
    color: '#041109',
    fontSize: 16,
    fontWeight: '800',
  },
})
