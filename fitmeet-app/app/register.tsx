import { Ionicons } from '@expo/vector-icons'
import * as Google from 'expo-auth-session/providers/google'
import { Link, router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { TurnstileModal } from '@/src/components/TurnstileModal'
import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'

const ANDROID_CLIENT_ID = '206851995035-0cn2pik52tpaprm9hsshss7uhehab2h0.apps.googleusercontent.com'
const WEB_CLIENT_ID     = '206851995035-0cn2pik52tpaprm9hsshss7uhehab2h0.apps.googleusercontent.com'

WebBrowser.maybeCompleteAuthSession()

export default function RegisterScreen() {
  const register        = useAuthStore((s) => s.register)
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle)

  const [name,        setName]        = useState('')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [showCaptcha, setShowCaptcha] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const disabled =
    submitting || googleLoading ||
    !name.trim() || !email.trim() ||
    password.length < 8 || password !== confirm

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: ANDROID_CLIENT_ID,
    webClientId:     WEB_CLIENT_ID,
  })

  useEffect(() => {
    if (response?.type !== 'success') return
    const accessToken = response.authentication?.accessToken
    if (!accessToken) return

    setGoogleLoading(true)
    setError(null)
    loginWithGoogle(accessToken)
      .then(() => router.replace('/onboarding'))
      .catch(err => setError(err instanceof Error ? err.message : 'Google login failed.'))
      .finally(() => setGoogleLoading(false))
  }, [response, loginWithGoogle])

  async function handleRegisterWithToken(turnstileToken: string) {
    setShowCaptcha(false)
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setSubmitting(true)
    setError(null)
    try {
      await register({ name: name.trim(), email: email.trim(), password, turnstileToken })
      router.replace('/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <Text style={styles.brand}>FITMEET</Text>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join FitMeet today</Text>
        </View>

        {/* Google button */}
        <Pressable
          style={[styles.googleBtn, (googleLoading || !request) && styles.disabledBtn]}
          onPress={() => promptAsync()}
          disabled={googleLoading || !request}
        >
          {googleLoading ? (
            <ActivityIndicator size="small" color={palette.text} />
          ) : (
            <>
              <Ionicons name="logo-google" size={18} color="#EA4335" />
              <Text style={styles.googleLabel}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or register with email</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email form */}
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
          onPress={() => setShowCaptcha(true)}
          style={[styles.primaryBtn, disabled && styles.primaryBtnDisabled]}
        >
          <Text style={styles.primaryLabel}>
            {submitting ? 'Creating account…' : 'Create account'}
          </Text>
        </Pressable>

        <Link href="/login" asChild>
          <Pressable style={styles.secondaryBtn}>
            <Text style={styles.secondaryLabel}>Already have an account? Sign in</Text>
          </Pressable>
        </Link>

      </ScrollView>

      <TurnstileModal
        visible={showCaptcha}
        onToken={handleRegisterWithToken}
        onDismiss={() => setShowCaptcha(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: palette.bg },
  container: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  header:    { gap: 6, marginTop: spacing.xl },
  brand: {
    color: palette.accent, fontSize: 13, fontWeight: '800',
    letterSpacing: 2, textTransform: 'uppercase',
  },
  title:    { color: palette.text, fontSize: 30, lineHeight: 36, fontWeight: '800' },
  subtitle: { color: palette.textMuted, fontSize: 15 },

  googleBtn: {
    height: 54, borderRadius: 18,
    backgroundColor: palette.panel,
    borderWidth: 1, borderColor: palette.line,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  googleLabel:  { color: palette.text, fontSize: 15, fontWeight: '700' },
  disabledBtn:  { opacity: 0.5 },

  divider:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: palette.line },
  dividerText: { color: palette.textDim, fontSize: 12, fontWeight: '600' },

  form:  { gap: spacing.md },
  field: { gap: 8 },
  label: { color: palette.text, fontSize: 14, fontWeight: '600' },
  input: {
    height: 54, borderRadius: 18,
    backgroundColor: palette.panel,
    borderWidth: 1, borderColor: palette.line,
    paddingHorizontal: spacing.md,
    color: palette.text, fontSize: 16,
  },
  inputError: { borderColor: '#ff6b6b' },
  errorText:  { color: '#ff8b8b', fontSize: 14, lineHeight: 20 },

  primaryBtn: {
    height: 56, borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 'auto',
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryLabel: { color: '#041109', fontSize: 16, fontWeight: '800' },

  secondaryBtn: {
    height: 50, borderRadius: 18, borderWidth: 1,
    borderColor: palette.line, backgroundColor: palette.panel,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  secondaryLabel: { color: palette.text, fontSize: 14, fontWeight: '600' },
})
