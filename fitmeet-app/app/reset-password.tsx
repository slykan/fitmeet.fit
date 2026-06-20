import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
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

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ token?: string; email?: string }>()
  const token = typeof params.token === 'string' ? params.token : ''
  const email = typeof params.email === 'string' ? params.email : ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const disabled = useMemo(
    () => !token || !email || password.length < 8 || password !== confirm || submitting,
    [token, email, password, confirm, submitting],
  )

  async function handleSubmit() {
    setSubmitting(true)
    setMessage(null)
    setError(null)

    try {
      const { data } = await api.post('/auth/reset-password', {
        token,
        email,
        password,
        password_confirmation: confirm,
      })
      setMessage(data?.message ?? 'Password has been reset. You can sign in now.')
    } catch (err) {
      setError(errorMessage(err, 'Could not reset password. Please request a new link.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Pressable style={styles.backBtn} onPress={() => router.replace('/login')}>
          <Ionicons name="chevron-back" size={18} color={palette.text} />
          <Text style={styles.backText}>Sign in</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>{email || 'This reset link is invalid or incomplete.'}</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>New password</Text>
            <View>
              <TextInput
                style={[styles.input, styles.inputWithIcon]}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                placeholder="Min 8 characters"
                placeholderTextColor={palette.textDim}
              />
              <Pressable
                style={styles.eyeBtn}
                onPress={() => setShowPassword(value => !value)}
                hitSlop={10}
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={palette.textDim} />
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              style={[styles.input, confirm.length > 0 && confirm !== password && styles.inputError]}
              secureTextEntry={!showPassword}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat password"
              placeholderTextColor={palette.textDim}
            />
          </View>
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
            <Text style={styles.primaryLabel}>Reset password</Text>
          )}
        </Pressable>

        {message ? (
          <Pressable style={styles.secondaryBtn} onPress={() => router.replace('/login')}>
            <Text style={styles.secondaryLabel}>Back to sign in</Text>
          </Pressable>
        ) : null}
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
  inputWithIcon: { paddingRight: 48 },
  inputError: { borderColor: '#ff6b6b' },
  eyeBtn: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
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
