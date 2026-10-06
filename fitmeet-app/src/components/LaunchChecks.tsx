import { router } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { api } from '@/src/lib/api'
import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'

// Why HUAWEI Health sync stopped, in the user's terms (Huawei App Release Checklist 3.3–3.5).
export const HUAWEI_STATUS_MESSAGE: Record<string, string> = {
  revoked: 'FitMeet\'s access was cancelled in the HUAWEI Health app, so your trainings are no longer synced. Reconnect to resume.',
  insufficient_scope: 'Not all permissions were granted. Training sync needs both "Activity record" and "Activity" — reconnect and allow both.',
  unavailable: 'HUAWEI Health Kit is turned off or your data can\'t be accessed. Turn on HUAWEI Health Kit in the HUAWEI Health app (Me › Privacy management), then reconnect.',
}

const RECHECK_MS = 10 * 60 * 1000

// Checks that must happen when the app is launched (or brought back after a while):
//  1. renewed consent — if the Terms/Privacy Policy changed, the user must accept them
//     again before using FitMeet; declining signs the user out;
//  2. HUAWEI Health — a revocation in the HUAWEI Health app, missing permissions or a
//     switched-off HUAWEI Health Kit are reported right away with a way to reconnect.
export function LaunchChecks() {
  const token = useAuthStore(s => s.token)
  const needsConsent = useAuthStore(s => s.user?.needs_terms_consent ?? false)
  const refreshMe = useAuthStore(s => s.refreshMe)
  const logout = useAuthStore(s => s.logout)
  const [accepting, setAccepting] = useState(false)
  const lastHuaweiCheck = useRef(0)

  useEffect(() => {
    if (!token || needsConsent) return

    function checkHuawei() {
      if (Date.now() - lastHuaweiCheck.current < RECHECK_MS) return
      lastHuaweiCheck.current = Date.now()
      api.post('/huawei/verify')
        .then(({ data }) => {
          const message = HUAWEI_STATUS_MESSAGE[data?.status]
          if (!message) return
          Alert.alert('HUAWEI Health sync paused', message, [
            { text: 'Later', style: 'cancel' },
            { text: 'Reconnect', onPress: () => router.push('/connected-apps') },
          ])
        })
        .catch(() => {})
    }

    checkHuawei()
    const sub = AppState.addEventListener('change', state => { if (state === 'active') checkHuawei() })
    return () => sub.remove()
  }, [token, needsConsent])

  async function accept() {
    setAccepting(true)
    try {
      await api.post('/me/accept-terms')
      await refreshMe()
    } catch {
      Alert.alert('Error', 'Could not save your consent. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  function decline() {
    Alert.alert('Sign out?', 'FitMeet can\'t be used without accepting the Terms of Service and Privacy Policy.', [
      { text: 'Back', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { logout() } },
    ])
  }

  return (
    <Modal visible={Boolean(token) && needsConsent} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>We've updated our terms</Text>
          <Text style={styles.body}>
            Our Terms of Service and Privacy Policy have changed — including how we handle data from connected
            apps such as HUAWEI Health and Strava, where your data is stored, how long we keep it, and how you
            can export or delete it.
          </Text>
          <View style={styles.links}>
            <Pressable onPress={() => WebBrowser.openBrowserAsync('https://fitmeet.fit/terms')}>
              <Text style={styles.link}>Terms of Service</Text>
            </Pressable>
            <Pressable onPress={() => WebBrowser.openBrowserAsync('https://fitmeet.fit/privacy')}>
              <Text style={styles.link}>Privacy Policy</Text>
            </Pressable>
          </View>
          <Text style={styles.body}>Please review and accept them to continue using FitMeet.</Text>
          <Pressable style={styles.primary} onPress={accept} disabled={accepting}>
            {accepting ? <ActivityIndicator color="#041109" /> : <Text style={styles.primaryText}>I accept</Text>}
          </Pressable>
          <Pressable style={styles.secondary} onPress={decline} disabled={accepting}>
            <Text style={styles.secondaryText}>Decline and sign out</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: spacing.lg },
  card:          { backgroundColor: palette.panel, borderRadius: 18, borderWidth: 1, borderColor: palette.line, padding: spacing.lg, gap: spacing.md },
  title:         { color: palette.text, fontSize: 20, fontWeight: '800' },
  body:          { color: palette.textMuted, fontSize: 14, lineHeight: 20 },
  links:         { flexDirection: 'row', gap: spacing.lg },
  link:          { color: palette.accent, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  primary:       { backgroundColor: palette.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText:   { color: '#041109', fontWeight: '800', fontSize: 15 },
  secondary:     { borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: palette.line },
  secondaryText: { color: palette.textMuted, fontWeight: '600', fontSize: 14 },
})
