import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import * as WebBrowser from 'expo-web-browser'
import { useState } from 'react'
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { api } from '@/src/lib/api'
import { parseGpxText } from '@/src/lib/gpx'
import { palette, spacing } from '@/src/theme'

WebBrowser.maybeCompleteAuthSession()

const CLIENT_ID = Constants.expoConfig?.extra?.stravaClientId ?? '234864'
const REDIRECT_URI = 'https://fitmeet.fit/strava-callback'

interface StravaRoute {
  id: number
  name: string
  distance: number
  elevation_gain: number
  type: number
  sub_type: number
}

interface Props {
  visible: boolean
  onClose: () => void
  onImport: (gpxText: string) => void
}

export function StravaRoutePicker({ visible, onClose, onImport }: Props) {
  const [step, setStep] = useState<'connect' | 'loading' | 'routes'>('connect')
  const [routes, setRoutes] = useState<StravaRoute[]>([])
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [athleteId, setAthleteId] = useState<number | null>(null)
  const [loadingRoute, setLoadingRoute] = useState<number | null>(null)

  function reset() {
    setStep('connect')
    setRoutes([])
    setAccessToken(null)
    setAthleteId(null)
    setLoadingRoute(null)
  }

  async function connectStrava() {
    setStep('loading')
    try {
      const authUrl =
        `https://www.strava.com/oauth/mobile/authorize` +
        `?client_id=${CLIENT_ID}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=code` +
        `&approval_prompt=auto` +
        `&scope=read,activity:read_all`

      const result = await WebBrowser.openAuthSessionAsync(authUrl, 'fitmeet://')

      if (result.type !== 'success' || !result.url) {
        setStep('connect')
        return
      }

      // result.url is fitmeet://strava-callback?code=...
      const codeMatch = result.url.match(/[?&]code=([^&]+)/)
      const code = codeMatch ? codeMatch[1] : null
      if (!code) { setStep('connect'); return }

      // Exchange code via our backend
      const { data } = await api.post('/strava/token', { code })
      const token: string = data.access_token
      const aid: number = data.athlete_id
      setAccessToken(token)
      setAthleteId(aid)

      // Fetch routes from Strava
      const res = await fetch(
        `https://www.strava.com/api/v3/athletes/${aid}/routes?per_page=30`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const routeData: StravaRoute[] = await res.json()
      setRoutes(routeData)
      setStep('routes')
    } catch (e) {
      setStep('connect')
      Alert.alert('Error', 'Could not connect to Strava. Please try again.')
    }
  }

  async function importRoute(route: StravaRoute) {
    if (!accessToken) return
    setLoadingRoute(route.id)
    try {
      const res = await fetch(
        `https://www.strava.com/api/v3/routes/${route.id}/export_gpx`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const gpxText = await res.text()
      parseGpxText(gpxText) // validate
      onImport(gpxText)
      reset()
      onClose()
    } catch {
      Alert.alert('Error', 'Could not download GPX for this route.')
    } finally {
      setLoadingRoute(null)
    }
  }

  function distanceLabel(meters: number) {
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose() }}>
      <Pressable style={styles.overlay} onPress={() => { reset(); onClose() }}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>

          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {step === 'routes' && (
                <Pressable onPress={() => setStep('connect')} hitSlop={8}>
                  <Ionicons name="arrow-back" size={20} color={palette.textMuted} />
                </Pressable>
              )}
              <Text style={styles.title}>Import from Strava</Text>
            </View>
            <Pressable onPress={() => { reset(); onClose() }} hitSlop={8}>
              <Ionicons name="close" size={20} color={palette.textMuted} />
            </Pressable>
          </View>

          {step === 'connect' && (
            <View style={styles.connectWrap}>
              <View style={styles.stravaLogo}>
                <Text style={{ fontSize: 28 }}>🚴</Text>
              </View>
              <Text style={styles.connectTitle}>Connect your Strava account</Text>
              <Text style={styles.connectSub}>
                Pick a route from your Strava library. The GPX will be imported automatically.
              </Text>
              <Pressable style={styles.stravaBtn} onPress={connectStrava}>
                <Ionicons name="bicycle-outline" size={18} color="#fff" />
                <Text style={styles.stravaBtnText}>Connect Strava</Text>
              </Pressable>
            </View>
          )}

          {step === 'loading' && (
            <View style={styles.connectWrap}>
              <ActivityIndicator size="large" color={palette.accent} />
              <Text style={styles.connectSub}>Connecting to Strava...</Text>
            </View>
          )}

          {step === 'routes' && (
            <>
              <Text style={styles.routesLabel}>{routes.length} routes found</Text>
              <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                {routes.length === 0 && (
                  <Text style={styles.emptyText}>No routes found. Create a route on Strava first.</Text>
                )}
                {routes.map((r) => (
                  <Pressable
                    key={r.id}
                    style={styles.routeRow}
                    onPress={() => importRoute(r)}
                    disabled={loadingRoute === r.id}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.routeName} numberOfLines={1}>{r.name}</Text>
                      <Text style={styles.routeMeta}>
                        {distanceLabel(r.distance)}
                        {r.elevation_gain > 0 ? ` · ↑${Math.round(r.elevation_gain)} m` : ''}
                      </Text>
                    </View>
                    {loadingRoute === r.id
                      ? <ActivityIndicator size="small" color={palette.accent} />
                      : <Ionicons name="download-outline" size={18} color={palette.accent} />
                    }
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  card: { backgroundColor: palette.panel, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: palette.line, padding: spacing.lg, gap: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: palette.text, fontSize: 18, fontWeight: '800' },

  connectWrap: { alignItems: 'center', gap: 12, paddingVertical: spacing.lg },
  stravaLogo: { width: 64, height: 64, borderRadius: 20, backgroundColor: '#FC4C02', alignItems: 'center', justifyContent: 'center' },
  connectTitle: { color: palette.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  connectSub: { color: palette.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  stravaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FC4C02', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  stravaBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  routesLabel: { color: palette.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line },
  routeName: { color: palette.text, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  routeMeta: { color: palette.textMuted, fontSize: 12 },
  emptyText: { color: palette.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 20 },
})
