import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { api } from '@/src/lib/api'
import { palette, spacing } from '@/src/theme'

function errorMessage(error: unknown, fallback: string) {
  const err = error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }
  return (
    err?.response?.data?.message ??
    Object.values(err?.response?.data?.errors ?? {})[0]?.[0] ??
    fallback
  )
}

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const disabled = useMemo(() => !email.trim() || submitting, [email, submitting])

  async function handleSubmit() {
    setSubmitting(true)
    setMessage(null)
    setError(null)

    try {
      const { data } = await api.post('/auth/forgot-password', { email: email.trim() })
      setMessage(data?.message ?? 'Password reset link sent. Check your email.')
    } catch (err) {
      setError(errorMessage(err, 'Could not send reset link. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={palette.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>Forgot password?</Text>
          <Text style={styles.subtitle}>Enter your email and we'll send a reset link.</Text>
        </View>

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

        {message ? <Text style={styles.successText}>{message}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          disabled={disabled}
          onPress={handleSubmit}
          style={[styles.primaryBtn, disabled && styles.primaryBtnDisabled]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#041109" />
          ) : (
            <Text style={styles.primaryLabel}>Send reset link</Text>
          )}
        </Pressable>

        <Pressable style={styles.secondaryBtn} onPress={() => router.replace('/login')}>
          <Text style={styles.secondaryLabel}>Back to sign in</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  container: { flex: 1, padding: spacing.lg, gap: spacing.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  backText: { color: palette.text, fontSize: 14, fontWeight: '700' },
  header: { gap: 6, marginTop: spacing.xl },
  title: { color: palette.text, fontSize: 30, lineHeight: 36, fontWeight: '800' },
  subtitle: { color: palette.textMuted, fontSize: 15, lineHeight: 21 },
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
  successText: { color: palette.accent, fontSize: 14, lineHeight: 20 },
  errorText: { color: '#ff8b8b', fontSize: 14, lineHeight: 20 },
  primaryBtn: {
    height: 56,
    borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryLabel: { color: '#041109', fontSize: 16, fontWeight: '800' },
  secondaryBtn: {
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
