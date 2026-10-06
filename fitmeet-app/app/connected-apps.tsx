import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import * as WebBrowser from 'expo-web-browser'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { api } from '@/src/lib/api'
import { clearStravaCodeCallback, setStravaCodeCallback } from '@/src/lib/strava-bridge'
import { clearHuaweiCodeCallback, setHuaweiCodeCallback } from '@/src/lib/huawei-bridge'
import { HUAWEI_STATUS_MESSAGE } from '@/src/components/LaunchChecks'
import { palette, spacing } from '@/src/theme'

WebBrowser.maybeCompleteAuthSession()

const CLIENT_ID = Constants.expoConfig?.extra?.stravaClientId ?? '234864'
const REDIRECT_URI = 'https://fitmeet.fit/strava-callback'

const HUAWEI_CLIENT_ID = '118410313'
const HUAWEI_REDIRECT_URI = 'https://fitmeet.fit/huawei-callback'
const HUAWEI_SCOPES = [
  'openid',
  'https://www.huawei.com/healthkit/activityrecord.read',
  'https://www.huawei.com/healthkit/activity.read',
].join(' ')

interface Connection {
  provider: string
  priority: number
  connected_at: string | null
  last_synced_at: string | null
  // active | revoked | insufficient_scope | unavailable (see ProviderConnection on the API)
  status?: string
}

const PROVIDERS = [
  { key: 'strava', label: 'Strava', color: '#FC4C02', available: true },
  { key: 'garmin', label: 'Garmin', color: '#00799B', available: false },
  // Huawei brand rules: always "HUAWEI Health" (caps), with the official logo.
  { key: 'huawei', label: 'HUAWEI Health', color: '#C7000B', available: true },
] as const

const PROVIDER_LOGO: Record<string, number> = {
  huawei: require('../assets/brand/huawei-health.png'),
}

// What FitMeet reads from each provider — shown before and after authorizing.
const DATA_READ: Record<string, string> = {
  strava: 'Reads your completed activities',
  huawei: 'Reads your workout records (activity records) only',
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'never'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function ConnectedAppsScreen() {
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const handledCodeRef = useRef<string | null>(null)
  const handledHuaweiCodeRef = useRef<string | null>(null)

  function load() {
    api.get('/connections')
      .then(({ data }) => {
        const list: Connection[] = data.data ?? []
        setConnections(list)
        // Live check so a revocation / switched-off HUAWEI Health Kit shows up immediately.
        if (list.some(c => c.provider === 'huawei')) {
          api.post('/huawei/verify')
            .then(({ data: v }) => setConnections(prev => prev.map(c => c.provider === 'huawei' ? { ...c, status: v.status } : c)))
            .catch(() => {})
        }
      })
      .catch(() => setConnections([]))
      .finally(() => setLoading(false))
  }

  // Deep-link auth returns from Strava/Huawei land back on this screen while
  // finishConnect()'s POST is still in flight in the background (fired from
  // the strava-callback/huawei-callback route, not awaited before it
  // navigates back here). Refetching on focus is right in general, but firing
  // it while that POST is still pending raced it — whichever response arrived
  // last won, so the button sometimes got stuck showing "Connect" until a
  // second tap. Skipping the focus refetch while busy leaves finishConnect's
  // own post-completion load() as the single source of truth.
  useFocusEffect(useCallback(() => { if (!busy) load() }, [busy]))

  useEffect(() => {
    setStravaCodeCallback((code) => {
      if (handledCodeRef.current === code) return
      handledCodeRef.current = code
      finishConnect(code)
    })
    return clearStravaCodeCallback
  }, [])

  useEffect(() => {
    setHuaweiCodeCallback((code) => {
      if (handledHuaweiCodeRef.current === code) return
      handledHuaweiCodeRef.current = code
      finishConnectHuawei(code)
    })
    return clearHuaweiCodeCallback
  }, [])

  async function finishConnect(code: string) {
    setBusy('strava')
    try {
      const { data } = await api.post('/strava/connect', { code })
      Alert.alert('Connected', `Strava connected — synced ${data.synced} training(s).`)
      load()
    } catch {
      Alert.alert('Error', 'Could not connect Strava. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  async function connectStrava() {
    setBusy('strava')
    try {
      const authUrl =
        `https://www.strava.com/oauth/mobile/authorize` +
        `?client_id=${CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=code` +
        `&approval_prompt=auto` +
        `&scope=read,read_all,activity:read_all`

      const result = await WebBrowser.openAuthSessionAsync(authUrl, 'fitmeet://')

      if (result.type !== 'success' || !result.url) {
        setBusy(null)
        return
      }

      const codeMatch = result.url.match(/[?&]code=([^&]+)/)
      const code = codeMatch ? codeMatch[1] : null
      if (!code || handledCodeRef.current === code) { setBusy(null); return }

      handledCodeRef.current = code
      await finishConnect(code)
    } catch {
      setBusy(null)
      Alert.alert('Error', 'Could not connect to Strava. Please try again.')
    }
  }

  async function resyncStrava() {
    setBusy('strava-resync')
    try {
      const { data } = await api.post('/strava/resync')
      Alert.alert('Resynced', `Refreshed ${data.synced} training(s) with full detail.`)
      load()
    } catch {
      Alert.alert('Error', 'Could not resync Strava. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  function disconnectStrava() {
    Alert.alert('Disconnect Strava?', 'Your already-synced trainings stay in your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          setBusy('strava')
          try {
            await api.delete('/strava/connect')
            setConnections(prev => prev.filter(c => c.provider !== 'strava'))
          } catch {
            Alert.alert('Error', 'Could not disconnect Strava. Please try again.')
          } finally {
            setBusy(null)
          }
        },
      },
    ])
  }

  async function finishConnectHuawei(code: string) {
    setBusy('huawei')
    try {
      const { data } = await api.post('/huawei/connect', { code, source: 'app' })
      const problem = data.status && data.status !== 'active' ? HUAWEI_STATUS_MESSAGE[data.status] : null
      if (problem) {
        // e.g. a required permission was unchecked on the consent screen (checklist 3.4)
        Alert.alert('HUAWEI Health connected, sync not available', problem, [
          { text: 'Later', style: 'cancel' },
          { text: 'Re-authorize', onPress: () => connectHuawei() },
        ])
      } else {
        Alert.alert('Connected', `HUAWEI Health connected — synced ${data.synced} training(s).`)
      }
      load()
    } catch {
      Alert.alert('Error', 'Could not connect HUAWEI Health. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  async function connectHuawei() {
    setBusy('huawei')
    try {
      const authUrl =
        `https://oauth-login.cloud.huawei.com/oauth2/v3/authorize` +
        `?response_type=code&client_id=${HUAWEI_CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(HUAWEI_REDIRECT_URI)}` +
        `&scope=${encodeURIComponent(HUAWEI_SCOPES)}` +
        `&access_type=offline`

      const result = await WebBrowser.openAuthSessionAsync(authUrl, 'fitmeet://')

      if (result.type !== 'success' || !result.url) {
        setBusy(null)
        return
      }

      // Huawei codes are base64 (+ / =) and arrive percent-encoded in the redirect URL —
      // decode before posting, or the token exchange fails. Also keeps the dedupe below
      // matching the already-decoded code from the huawei-callback deep-link route.
      const codeMatch = result.url.match(/[?&]code=([^&]+)/)
      const code = codeMatch ? decodeURIComponent(codeMatch[1]) : null
      if (!code || handledHuaweiCodeRef.current === code) { setBusy(null); return }

      handledHuaweiCodeRef.current = code
      await finishConnectHuawei(code)
    } catch {
      setBusy(null)
      Alert.alert('Error', 'Could not connect to HUAWEI Health. Please try again.')
    }
  }

  async function resyncHuawei() {
    setBusy('huawei-resync')
    try {
      const { data } = await api.post('/huawei/resync')
      Alert.alert('Resynced', `Refreshed ${data.synced} training(s) with full detail.`)
      load()
    } catch (e: unknown) {
      const status = (e as { response?: { data?: { status?: string } } })?.response?.data?.status
      Alert.alert('HUAWEI Health', (status && HUAWEI_STATUS_MESSAGE[status]) || 'Could not resync HUAWEI Health. Please try again.')
      load()
    } finally {
      setBusy(null)
    }
  }

  // Revoking in FitMeet (checklist 3.2): the user decides what happens to imported
  // trainings, and gets a confirmation that FitMeet no longer has access.
  async function doDisconnectHuawei(keepTrainings: boolean) {
    setBusy('huawei')
    try {
      const { data } = await api.delete('/huawei/connect', { data: { keep_trainings: keepTrainings, source: 'app' } })
      setConnections(prev => prev.filter(c => c.provider !== 'huawei'))
      Alert.alert(
        'HUAWEI Health disconnected',
        'FitMeet no longer has access to your HUAWEI Health data. ' +
          (data?.trainings_deleted ? `${data.trainings_deleted} imported training(s) were deleted.` : 'Trainings already imported were kept.'),
      )
    } catch {
      Alert.alert('Error', 'Could not disconnect HUAWEI Health. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  function disconnectHuawei() {
    Alert.alert(
      'Disconnect HUAWEI Health?',
      'FitMeet will stop reading your HUAWEI Health data and the authorization will be revoked. Keep the trainings already imported?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete trainings', style: 'destructive', onPress: () => doDisconnectHuawei(false) },
        { text: 'Keep trainings', onPress: () => doDisconnectHuawei(true) },
      ],
    )
  }

  const PROVIDER_HANDLERS: Record<string, { connect: () => void; resync: () => void; disconnect: () => void }> = {
    strava: { connect: connectStrava, resync: resyncStrava, disconnect: disconnectStrava },
    huawei: { connect: connectHuawei, resync: resyncHuawei, disconnect: disconnectHuawei },
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </Pressable>
        <Text style={styles.heading}>Connected apps</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Sync your training history automatically into the Log tab under Meet.
        </Text>

        {loading ? (
          <ActivityIndicator color={palette.accent} style={{ marginTop: spacing.lg }} />
        ) : (
          PROVIDERS.map(p => {
            const connection = connections.find(c => c.provider === p.key)
            const isBusy = busy === p.key
            const isResyncing = busy === `${p.key}-resync`
            const anyBusy = busy !== null
            const problem = connection?.status && connection.status !== 'active' ? connection.status : null
            const logo = PROVIDER_LOGO[p.key]

            return (
              <View key={p.key} style={styles.row}>
                <View style={styles.rowInfo}>
                  {logo ? (
                    <Image source={logo} style={styles.logo} accessibilityLabel={p.label} />
                  ) : (
                    <View style={[styles.dot, { backgroundColor: `${p.color}22` }]}>
                      <View style={[styles.dotInner, { backgroundColor: p.color }]} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.providerName}>{p.label}</Text>
                    <Text style={[styles.providerStatus, problem ? { color: '#f87171' } : null]}>
                      {!p.available
                        ? 'Coming soon'
                        : problem
                          ? 'Sync paused — action needed'
                          : connection
                            ? `Authorized · last synced ${timeAgo(connection.last_synced_at)}`
                            : 'Not connected'}
                    </Text>
                    {p.available && DATA_READ[p.key] ? <Text style={styles.dataRead}>{DATA_READ[p.key]}</Text> : null}
                  </View>
                </View>

                {problem && HUAWEI_STATUS_MESSAGE[problem] ? (
                  <View style={styles.warning}>
                    <Ionicons name="warning-outline" size={16} color="#f87171" />
                    <Text style={styles.warningText}>{HUAWEI_STATUS_MESSAGE[problem]}</Text>
                  </View>
                ) : null}

                {p.available && (
                  connection ? (
                    <View style={styles.actions}>
                      {problem ? (
                        <Pressable style={[styles.connectBtn, { flex: 1, backgroundColor: p.color }]} onPress={PROVIDER_HANDLERS[p.key].connect} disabled={anyBusy}>
                          {isBusy && <ActivityIndicator size="small" color="#fff" />}
                          <Text style={styles.connectBtnText}>Reconnect</Text>
                        </Pressable>
                      ) : (
                        <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={PROVIDER_HANDLERS[p.key].resync} disabled={anyBusy}>
                          {isResyncing ? <ActivityIndicator size="small" color={palette.textMuted} /> : <Ionicons name="refresh-outline" size={14} color={palette.textMuted} />}
                          <Text style={styles.secondaryBtnText}>Resync</Text>
                        </Pressable>
                      )}
                      <Pressable style={[styles.secondaryBtn, { flex: 1 }]} onPress={PROVIDER_HANDLERS[p.key].disconnect} disabled={anyBusy}>
                        {isBusy ? <ActivityIndicator size="small" color={palette.textMuted} /> : <Ionicons name="checkmark" size={14} color={p.color} />}
                        <Text style={styles.secondaryBtnText}>Disconnect</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable style={[styles.connectBtn, { backgroundColor: p.color }]} onPress={PROVIDER_HANDLERS[p.key].connect} disabled={isBusy}>
                      {isBusy && <ActivityIndicator size="small" color="#fff" />}
                      <Text style={styles.connectBtnText}>Connect</Text>
                    </Pressable>
                  )
                )}
              </View>
            )
          })
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: palette.bg },
  topBar:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, paddingBottom: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, color: palette.text, fontSize: 20, fontWeight: '800', textAlign: 'center' },

  content: { padding: spacing.md, gap: spacing.md },
  subtitle: { color: palette.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 4 },

  row: {
    gap: 12,
    backgroundColor: palette.panel, borderRadius: 18,
    borderWidth: 1, borderColor: palette.line, padding: spacing.md,
  },
  rowInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dotInner: { width: 10, height: 10, borderRadius: 5 },
  providerName: { color: palette.text, fontSize: 15, fontWeight: '700' },
  providerStatus: { color: palette.textDim, fontSize: 12, marginTop: 2 },
  logo: { width: 36, height: 36, borderRadius: 9 },
  dataRead: { color: palette.textDim, fontSize: 11, marginTop: 2 },
  warning: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: 10, borderRadius: 10, backgroundColor: 'rgba(248,113,113,0.08)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.35)' },
  warningText: { flex: 1, color: palette.text, fontSize: 12, lineHeight: 17 },

  actions: { flexDirection: 'row', gap: 8 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: palette.line,
  },
  secondaryBtnText: { color: palette.textMuted, fontSize: 12, fontWeight: '700' },
  connectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10,
  },
  connectBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
})
