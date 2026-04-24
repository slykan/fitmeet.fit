import { LinearGradient } from 'expo-linear-gradient'
import { Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

import { palette, spacing } from '@/src/theme'

const steps = [
  {
    title: 'Sign in',
    body: 'Set your interests, radius and home base so nearby events actually feel nearby.',
    icon: 'person-circle-outline',
  },
  {
    title: 'Create or join',
    body: 'Add the sport, time, route and share-ready details that make it easy to say yes.',
    icon: 'calendar-clear-outline',
  },
  {
    title: 'Invite friends',
    body: 'Chat together, get reminders and keep the whole plan in sync before meetup time.',
    icon: 'chatbubbles-outline',
  },
]

export default function WelcomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <LinearGradient colors={['#0d2d14', '#07111b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroGlow} />
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Ionicons name="radio-outline" size={22} color={palette.accent} />
            </View>
            <Text style={styles.brandText}>FitMeet mobile</Text>
          </View>
          <Text style={styles.title}>Find your people. Move together.</Text>
          <Text style={styles.subtitle}>
            The mobile app is starting as a focused companion for Hub, Meet, notifications and messages.
          </Text>
        </View>

        <View style={styles.storyCard}>
          {steps.map((step, index) => (
            <View key={step.title} style={[styles.stepRow, index < steps.length - 1 && styles.stepDivider]}>
              <View style={styles.stepIcon}>
                <Ionicons name={step.icon as never} size={20} color={palette.accent} />
              </View>
              <View style={styles.stepTextWrap}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepBody}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <Link href="/login" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryLabel}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#03110a" />
            </Pressable>
          </Link>
          <Text style={styles.helper}>
            We can wire real auth next. For now the mobile shell is ready to explore and iterate.
          </Text>
        </View>
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
  hero: {
    position: 'relative',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    opacity: 0.9,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 11, 24, 0.9)',
  },
  brandText: {
    color: palette.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: palette.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    paddingHorizontal: spacing.lg,
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 16,
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  storyCard: {
    backgroundColor: palette.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: spacing.lg,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  stepDivider: {
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  stepIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.panelRaised,
  },
  stepTextWrap: {
    flex: 1,
    gap: 6,
  },
  stepTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '700',
  },
  stepBody: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  actions: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  primaryButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: palette.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryLabel: {
    color: '#041109',
    fontSize: 16,
    fontWeight: '800',
  },
  helper: {
    color: palette.textMuted,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
  },
})
