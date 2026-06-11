import { Ionicons } from '@expo/vector-icons'
import * as AppleAuthentication from 'expo-apple-authentication'
import { Link, router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { TurnstileModal } from '@/src/components/TurnstileModal'
import { signInWithGoogleNative, useGoogleBrowserAuth } from '@/src/lib/google-signin'
import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'

// ─── Google OAuth config ──────────────────────────────────────────────────────
// Setup: Google Cloud Console → Credentials → Create Android OAuth client
//   Package name:  com.anonymous.fitmeetapp
//   SHA-1:  run in terminal:
//     keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
// Then paste the Android Client ID below:
// Desktop/installed OAuth client — works for dev builds via PKCE flow
WebBrowser.maybeCompleteAuthSession()

export default function LoginScreen() {
  const login            = useAuthStore((s) => s.login)
  const loginWithGoogle  = useAuthStore((s) => s.loginWithGoogle)
  const loginWithStrava  = useAuthStore((s) => s.loginWithStrava)
  const loginWithApple   = useAuthStore((s) => s.loginWithApple)
  const hasHydrated      = useAuthStore((s) => s.hasHydrated)
  const token            = useAuthStore((s) => s.token)
  const user             = useAuthStore((s) => s.user)

  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [submitting,    setSubmitting]     = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [showCaptcha,   setShowCaptcha]   = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [stravaLoading, setStravaLoading] = useState(false)
  const [appleLoading,  setAppleLoading]  = useState(false)

  useEffect(() => {
    if (!hasHydrated || !token) return
    router.replace(user?.onboarding_complete ? '/(tabs)/hub' : '/onboarding')
  }, [hasHydrated, token, user?.onboarding_complete])

  async function handleStravaPress() {
    setStravaLoading(true)
    setError(null)
    try {
      const STRAVA_CLIENT_ID = '234864'
      const REDIRECT_URI = 'https://fitmeet.fit/strava-callback'
      const authUrl =
        `https://www.strava.com/oauth/mobile/authorize` +
        `?client_id=${STRAVA_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=code&approval_prompt=auto&scope=read,profile:read_all`
      const result = await WebBrowser.openAuthSessionAsync(authUrl, 'fitmeet://')
      if (result.type !== 'success' || !result.url) return
      const match = result.url.match(/[?&]code=([^&]+)/)
      const code = match ? decodeURIComponent(match[1]) : null
      if (!code) return
      await loginWithStrava(code)
      const user = useAuthStore.getState().user
      router.replace(user?.onboarding_complete ? '/(tabs)/hub' : '/onboarding')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Strava login failed.')
    } finally {
      setStravaLoading(false)
    }
  }

  async function handleApplePress() {
    setAppleLoading(true)
    setError(null)
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      })
      if (!credential.identityToken) throw new Error('No identity token.')
      await loginWithApple(credential.identityToken, credential.fullName)
      const user = useAuthStore.getState().user
      router.replace(user?.onboarding_complete ? '/(tabs)/hub' : '/onboarding')
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string }
      if (err?.code !== 'ERR_REQUEST_CANCELED') {
        setError(err?.message ?? 'Apple sign-in failed.')
      }
    } finally {
      setAppleLoading(false)
    }
  }

  const disabled = useMemo(
    () => !email.trim() || !password.trim() || submitting || googleLoading,
    [email, password, submitting, googleLoading],
  )

  // ─── Google auth session ──────────────────────────────────────────────────
  const [request, response, promptAsync] = useGoogleBrowserAuth()

  useEffect(() => {
    if (response?.type !== 'success') return
    const accessToken = response.authentication?.accessToken
    if (!accessToken) return

    setGoogleLoading(true)
    setError(null)
    loginWithGoogle(accessToken)
      .then(() => {
        const user = useAuthStore.getState().user
        router.replace(user?.onboarding_complete ? '/(tabs)/hub' : '/onboarding')
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Google login failed.'))
      .finally(() => setGoogleLoading(false))
  }, [response, loginWithGoogle])

  async function handleGooglePress() {
    setGoogleLoading(true)
    setError(null)

    try {
      if (Platform.OS === 'android') {
        const accessToken = await signInWithGoogleNative()
        if (!accessToken) return

        await loginWithGoogle(accessToken)
        const user = useAuthStore.getState().user
        router.replace(user?.onboarding_complete ? '/(tabs)/hub' : '/onboarding')
        return
      }

      await promptAsync()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google login failed.')
    } finally {
      setGoogleLoading(false)
    }
  }

  // ─── Email login (called after Turnstile resolves) ────────────────────────
  async function handleLoginWithToken(turnstileToken: string) {
    setShowCaptcha(false)
    setSubmitting(true)
    setError(null)
    try {
      await login({ email: email.trim(), password, turnstileToken })
      const user = useAuthStore.getState().user
      router.replace(user?.onboarding_complete ? '/(tabs)/hub' : '/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>

        <View style={styles.header}>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>Find your people. Move together.</Text>
        </View>

        {/* Apple button — iOS only */}
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={18}
            style={[styles.appleBtn, appleLoading && styles.disabledBtn]}
            onPress={handleApplePress}
          />
        )}

        {/* Google button */}
        <Pressable
          style={[styles.googleBtn, (googleLoading || (Platform.OS !== 'android' && !request)) && styles.disabledBtn]}
          onPress={handleGooglePress}
          disabled={googleLoading || (Platform.OS !== 'android' && !request)}
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

        {/* Strava button */}
        <Pressable
          style={[styles.stravaBtn, stravaLoading && styles.disabledBtn]}
          onPress={handleStravaPress}
          disabled={stravaLoading}
        >
          {stravaLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.stravaMark}>STRAVA</Text>
              <Text style={styles.stravaLabel}>Continue with Strava</Text>
            </>
          )}
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email form */}
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
          onPress={() => setShowCaptcha(true)}
          style={[styles.primaryBtn, disabled && styles.primaryBtnDisabled]}
        >
          <Text style={styles.primaryLabel}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Text>
        </Pressable>

        <Link href="/register" asChild>
          <Pressable style={styles.secondaryBtn}>
            <Text style={styles.secondaryLabel}>Don't have an account? Register</Text>
          </Pressable>
        </Link>

      </View>

      <TurnstileModal
        visible={showCaptcha}
        onToken={handleLoginWithToken}
        onDismiss={() => setShowCaptcha(false)}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: palette.bg },
  container: { flex: 1, padding: spacing.lg, gap: spacing.md },
  header:    { gap: 6, marginTop: spacing.xl },
  title:    { color: palette.text, fontSize: 30, lineHeight: 36, fontWeight: '800' },
  subtitle: { color: palette.textMuted, fontSize: 15 },

  appleBtn: { width: '100%', height: 54 },
  googleBtn: {
    height: 54, borderRadius: 18,
    backgroundColor: palette.panel,
    borderWidth: 1, borderColor: palette.line,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  googleLabel: { color: palette.text, fontSize: 15, fontWeight: '700' },
  stravaBtn: { height: 52, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(252,76,2,0.1)', borderWidth: 1, borderColor: 'rgba(252,76,2,0.35)' },
  stravaMark: { color: '#FC4C02', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  stravaLabel: { color: '#FC4C02', fontSize: 15, fontWeight: '700' },
  disabledBtn: { opacity: 0.5 },

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
  errorText: { color: '#ff8b8b', fontSize: 14, lineHeight: 20 },

  primaryBtn: {
    marginTop: spacing.md, height: 56, borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center', justifyContent: 'center',
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
