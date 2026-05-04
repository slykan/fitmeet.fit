import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { api } from '@/src/lib/api'
import { parseGpxText } from '@/src/lib/gpx'
import { clearStravaCodeCallback, setStravaCodeCallback } from '@/src/lib/strava-bridge'
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
  onImport: (gpxText: string, routeName?: string) => void
}

export function StravaRoutePicker({ visible, onClose, onImport }: Props) {
  const [step, setStep] = useState<'connect' | 'loading' | 'routes'>('connect')
  const [routes, setRoutes] = useState<StravaRoute[]>([])
  const [importToken, setImportToken] = useState<string | null>(null)
  const [loadingRoute, setLoadingRoute] = useState<number | null>(null)
  const handledCodeRef = useRef<string | null>(null)

  useEffect(() => {
    if (!visible) return

    setStravaCodeCallback((code) => {
      handledCodeRef.current = code
      loadRoutes(code).catch(() => {
        setStep('connect')
        Alert.alert('Error', 'Could not connect to Strava. Please try again.')
      })
    })

    return clearStravaCodeCallback
  }, [visible])

  function reset() {
    setStep('connect')
    setRoutes([])
    setImportToken(null)
    setLoadingRoute(null)
    handledCodeRef.current = null
  }

  async function loadRoutes(code: string) {
    setStep('loading')
    const { data } = await api.post('/strava/routes', { code })
    setImportToken(data.import_token)
    setRoutes(data.data ?? [])
    setStep('routes')
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
      if (handledCodeRef.current === code) return

      await loadRoutes(code)
    } catch (e) {
      setStep('connect')
      Alert.alert('Error', 'Could not connect to Strava. Please try again.')
    }
  }

  async function importRoute(route: StravaRoute) {
    if (!importToken) return
    setLoadingRoute(route.id)
    try {
      const { data } = await api.post(`/strava/routes/${route.id}/gpx`, { import_token: importToken })
      const gpxText = data.gpx as string
      parseGpxText(gpxText) // validate
      onImport(gpxText, route.name)
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
                <Text style={styles.stravaLogoText}>STRAVA</Text>
              </View>
              <Text style={styles.connectTitle}>Connect your Strava account</Text>
              <Text style={styles.connectSub}>
                Pick a route from your Strava library. The GPX will be imported automatically.
              </Text>
              <Pressable style={styles.stravaBtn} onPress={connectStrava}>
                <Text style={styles.stravaMiniMark}>STRAVA</Text>
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
  stravaLogoText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  connectTitle: { color: palette.text, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  connectSub: { color: palette.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  stravaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FC4C02', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  stravaMiniMark: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  stravaBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  routesLabel: { color: palette.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.line },
  routeName: { color: palette.text, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  routeMeta: { color: palette.textMuted, fontSize: 12 },
  emptyText: { color: palette.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 20 },
})
