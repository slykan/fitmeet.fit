import { Link, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useMemo, useState } from 'react'
import * as Linking from 'expo-linking'

import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'

export default function LoginScreen() {
  const login = useAuthStore((state) => state.login)
  const refreshMe = useAuthStore((state) => state.refreshMe)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const disabled = useMemo(() => !email.trim() || !password.trim() || submitting, [email, password, submitting])

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Link href="/welcome" asChild>
          <Pressable style={styles.backButton}>
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
        </Link>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>Mobile alpha</Text>
          <Text style={styles.title}>Sign in to FitMeet</Text>
          <Text style={styles.subtitle}>
            Real auth is now wired for email login. Registration stays on web for the moment because it is protected by Cloudflare Turnstile.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor={palette.textDim}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor={palette.textDim}
            />
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          disabled={disabled}
          onPress={async () => {
            setSubmitting(true)
            setError(null)
            try {
              await login({ email: email.trim(), password })
              await refreshMe()
              router.replace('/(tabs)/hub')
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Login failed.')
            } finally {
              setSubmitting(false)
            }
          }}
          style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
        >
          <Text style={styles.primaryLabel}>{submitting ? 'Signing in...' : 'Sign In'}</Text>
        </Pressable>

        <Pressable
          onPress={() => Linking.openURL('https://fitmeet.fit/register')}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryLabel}>Create account on web</Text>
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
    gap: spacing.lg,
  },
  backButton: {
    minWidth: 64,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.panel,
    paddingHorizontal: 12,
  },
  backLabel: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '700',
  },
  header: {
    gap: 10,
    marginTop: spacing.md,
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
    lineHeight: 36,
    fontWeight: '800',
  },
  subtitle: {
    color: palette.textMuted,
    fontSize: 15,
    lineHeight: 23,
  },
  form: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  field: {
    gap: 8,
  },
  label: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    height: 54,
    borderRadius: 18,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: spacing.md,
    color: palette.text,
    fontSize: 16,
  },
  primaryButton: {
    marginTop: 'auto',
    height: 56,
    borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryLabel: {
    color: '#041109',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    height: 50,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    color: '#ff8b8b',
    fontSize: 14,
    lineHeight: 20,
  },
})
