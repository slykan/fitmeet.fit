import { Link, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useState } from 'react'

import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'

export default function RegisterScreen() {
  const register = useAuthStore((state) => state.register)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const disabled =
    submitting ||
    !name.trim() ||
    !email.trim() ||
    password.length < 8 ||
    password !== confirm

  async function handleRegister() {
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await register({ name: name.trim(), email: email.trim(), password })
      router.replace('/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.brand}>FITMEET</Text>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join FitMeet today</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={palette.textDim}
              autoCapitalize="words"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor={palette.textDim}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Min 8 characters"
              placeholderTextColor={palette.textDim}
              secureTextEntry
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              style={[styles.input, confirm.length > 0 && confirm !== password && styles.inputError]}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat password"
              placeholderTextColor={palette.textDim}
              secureTextEntry
            />
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          disabled={disabled}
          onPress={handleRegister}
          style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
        >
          <Text style={styles.primaryLabel}>{submitting ? 'Creating account…' : 'Create account'}</Text>
        </Pressable>

        <Link href="/login" asChild>
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryLabel}>Already have an account? Sign in</Text>
          </Pressable>
        </Link>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  header: { gap: 6, marginTop: spacing.xl },
  brand: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: { color: palette.text, fontSize: 30, lineHeight: 36, fontWeight: '800' },
  subtitle: { color: palette.textMuted, fontSize: 15 },
  form: { gap: spacing.md },
  field: { gap: 8 },
  label: { color: palette.text, fontSize: 14, fontWeight: '600' },
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
  inputError: { borderColor: '#ff6b6b' },
  errorText: { color: '#ff8b8b', fontSize: 14, lineHeight: 20 },
  primaryButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
  },
  primaryButtonDisabled: { opacity: 0.45 },
  primaryLabel: { color: '#041109', fontSize: 16, fontWeight: '800' },
  secondaryButton: {
    height: 50,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { color: palette.text, fontSize: 14, fontWeight: '600' },
})
