import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import * as FileSystem from 'expo-file-system/legacy'
import { ElevationChart } from '@/src/components/ElevationChart'
import { EventMapCard } from '@/src/components/EventMapCard'
import { WikiPhotosStrip } from '@/src/components/WikiPhotosStrip'
import { CATEGORIES } from '@/src/lib/categories'
import { api } from '@/src/lib/api'
import { enrichGpxWithElevation, fetchElevationProfile, parseGpxText } from '@/src/lib/gpx'
import type { GpxParsed } from '@/src/lib/gpx'
import { analyzeRouteSurface, type SurfaceAnalysis } from '@/src/lib/route-surface'
import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'

interface RouteDetail {
  id: number
  title: string
  category: { value: string; label: string }
  stats: {
    distance_km: number | null
    elevation_gain: number | null
    max_grade: number | null
    max_downgrade: number | null
  }
  location: {
    start_lat: number | null
    start_lng: number | null
    area_label: string | null
  }
  views_count: number
  creator?: { id: number; name: string } | null
  waypoints?: [number, number][] | null
}

const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.emoji])
)

function statsFromProfile(profile: GpxParsed['elevationProfile']) {
  let elevGain = 0
  let maxGrade = 0
  let maxDowngrade = 0
  let uphillKm = 0
  let downhillKm = 0

  for (let i = 1; i < profile.length; i++) {
    const distKm = profile[i].km - profile[i - 1].km
    const eleM = profile[i].ele - profile[i - 1].ele
    if (eleM > 0) elevGain += eleM
    if (distKm > 0) {
      const grade = (eleM / (distKm * 1000)) * 100
      if (grade > maxGrade) maxGrade = grade
      if (grade < maxDowngrade) maxDowngrade = grade
      if (grade > 0) uphillKm += distKm
      if (grade < 0) downhillKm += distKm
    }
  }

  return {
    elevGain: Math.round(elevGain),
    maxGrade: Math.round(maxGrade * 10) / 10,
    maxDowngrade: Math.round(maxDowngrade * 10) / 10,
    uphillKm: Math.round(uphillKm * 10) / 10,
    downhillKm: Math.round(downhillKm * 10) / 10,
  }
}

function withProfileStats(parsed: GpxParsed): GpxParsed {
  if (parsed.elevationProfile.length < 2) return parsed
  const stats = statsFromProfile(parsed.elevationProfile)
  return {
    ...parsed,
    elevGain: parsed.elevGain || stats.elevGain,
    maxGrade: parsed.maxGrade || stats.maxGrade,
    maxDowngrade: parsed.maxDowngrade || stats.maxDowngrade,
  }
}

export default function RouteViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { user } = useAuthStore()
  const [route, setRoute] = useState<RouteDetail | null>(null)
  const [gpx, setGpx] = useState<GpxParsed | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapEnabled, setMapEnabled] = useState(false)
  const [surfaceAnalysis, setSurfaceAnalysis] = useState<SurfaceAnalysis | null>(null)
  const [surfaceLoading, setSurfaceLoading] = useState(false)
  const [surfaceChecked, setSurfaceChecked] = useState(false)

  async function deleteRoute() {
    if (!route) return
    Alert.alert('Delete route', 'Delete this route permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/routes/${id}`)
            router.back()
          } catch {
            Alert.alert('Error', 'Could not delete route.')
          }
        },
      },
    ])
  }

  async function openGpxDownload() {
    if (!id || !route) return
    try {
      const baseUrl = api.defaults.baseURL ?? 'https://api.fitmeet.fit/api'
      const token = useAuthStore.getState().token
      const filename = `${route.title.trim().replace(/\s+/g, '-')}.gpx`
      const fileUri = FileSystem.cacheDirectory + filename
      await FileSystem.downloadAsync(`${baseUrl}/routes/${id}/gpx`, fileUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      const raw = await FileSystem.readAsStringAsync(fileUri)
      const enriched = await enrichGpxWithElevation(raw)
      await FileSystem.writeAsStringAsync(fileUri, enriched)
      if (Platform.OS === 'ios') {
        await Share.share({ url: fileUri })
      } else {
        const perms = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync()
        if (!perms.granted) return
        const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
          perms.directoryUri, filename, 'application/gpx+xml',
        )
        await FileSystem.writeAsStringAsync(destUri, enriched)
        Alert.alert('GPX saved', `${filename} saved to selected folder.`)
      }
    } catch {
      Alert.alert('GPX route', 'Could not download GPX file.')
    }
  }

  async function shareRoute() {
    if (!route) return
    const url = `https://fitmeet.fit/routes/view?id=${route.id}`
    await Share.share({
      title: route.title,
      message: [
        route.title,
        distanceKm != null ? `${distanceKm} km` : null,
        elevGain != null ? `${elevGain} m elevation` : null,
        '',
        url,
      ].filter(Boolean).join('\n'),
    })
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setSurfaceAnalysis(null)
      setSurfaceLoading(false)
      setSurfaceChecked(false)
      try {
        const { data } = await api.get(`/routes/${id}`)
        const loaded = data.data as RouteDetail
        if (cancelled) return
        setRoute(loaded)

        const gpxResponse = await api.get(`/routes/${id}/gpx`, { responseType: 'text' })
        let parsed = parseGpxText(gpxResponse.data)
        if (parsed.elevationProfile.length < 2 && parsed.track.length >= 2) {
          try {
            const profile = await fetchElevationProfile(parsed.track)
            parsed = { ...parsed, ...profile }
          } catch {}
        }
        const parsedWithStats = withProfileStats(parsed)
        if (!cancelled) setGpx(parsedWithStats)
        if (!cancelled) setSurfaceLoading(true)
        analyzeRouteSurface(parsedWithStats.track)
          .then((analysis) => {
            if (!cancelled) setSurfaceAnalysis(analysis)
          })
          .catch(() => {})
          .finally(() => {
            if (!cancelled) {
              setSurfaceLoading(false)
              setSurfaceChecked(true)
            }
          })
      } catch {
        if (!cancelled) setError('Route not found.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color={palette.accent} style={{ marginTop: spacing.xl }} />
      </SafeAreaView>
    )
  }

  if (!route || error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color={palette.text} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.emptyText}>{error ?? 'Route not found.'}</Text>
        </View>
      </SafeAreaView>
    )
  }

  const emoji = CATEGORY_EMOJI[route.category.value] ?? '📍'
  const distanceKm = gpx?.distanceKm ?? route.stats.distance_km
  const elevGain = gpx?.elevGain ?? route.stats.elevation_gain
  const maxGrade = gpx?.maxGrade ?? route.stats.max_grade
  const maxDowngrade = gpx?.maxDowngrade ?? route.stats.max_downgrade
  const profileStats = gpx?.elevationProfile.length ? statsFromProfile(gpx.elevationProfile) : null
  const surfaceMixText = surfaceAnalysis?.summary.length
    ? surfaceAnalysis.summary.map(item => `${item.percent}% ${item.label.toLowerCase()}`).join(' - ')
    : null
  const showSurfaceSection = Boolean(gpx?.track.length && (surfaceLoading || surfaceChecked || surfaceAnalysis?.summary.length))

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} scrollEnabled={!mapEnabled}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={palette.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.emoji}>{emoji}</Text>
          <View style={styles.headerText}>
            <Text style={styles.title}>{route.title}</Text>
            <Text style={styles.meta}>{route.category.label}{route.views_count ? ` · ${route.views_count} views` : ''}</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.shareBtn} onPress={shareRoute}>
            <Ionicons name="share-social-outline" size={17} color={palette.text} />
            <Text style={styles.shareBtnText}>Share</Text>
          </Pressable>
          {user && route.creator?.id === user.id && (
            <Pressable
              style={styles.editBtn}
              onPress={() => router.push(`/route/draw?id=${route.id}` as never)}
            >
              <Ionicons name="pencil-outline" size={17} color={palette.accent} />
              <Text style={styles.editBtnText}>Edit</Text>
            </Pressable>
          )}
          {user && (route.creator?.id === user.id || user.is_admin) && (
            <Pressable
              style={styles.deleteBtn}
              onPress={deleteRoute}
            >
              <Ionicons name="trash-outline" size={17} color="#f87171" />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          )}
        </View>

        <Pressable style={styles.downloadBtn} onPress={openGpxDownload}>
          <Ionicons name="download-outline" size={17} color={palette.accent} />
          <Text style={styles.downloadText}>Download GPX</Text>
        </Pressable>

        {route.location.area_label ? (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={14} color={palette.textDim} />
            <Text style={styles.detailText}>{route.location.area_label}</Text>
          </View>
        ) : null}

        <View style={styles.statsGrid}>
          {[
            ['Distance', distanceKm != null ? `${distanceKm} km` : '-'],
            ['Elevation', elevGain != null ? `${elevGain} m` : '-'],
            ['Max uphill', maxGrade != null ? `${maxGrade}%` : '-'],
            ['Max downhill', maxDowngrade != null ? `${Math.abs(maxDowngrade)}%` : '-'],
            ['Uphill distance', profileStats ? `${profileStats.uphillKm} km` : '-'],
            ['Downhill distance', profileStats ? `${profileStats.downhillKm} km` : '-'],
          ].map(([label, value]) => (
            <View key={label} style={styles.statCard}>
              <Text style={styles.statLabel}>{label}</Text>
              <Text style={styles.statValue}>{value}</Text>
            </View>
          ))}
        </View>

        {route.location.start_lat != null && route.location.start_lng != null ? (
          <EventMapCard
            lat={route.location.start_lat}
            lng={route.location.start_lng}
            emoji={emoji}
            elevationSegments={gpx?.coloredSegments}
            surfaceSegments={surfaceAnalysis?.segments}
            onMapEnabledChange={setMapEnabled}
          />
        ) : null}

        {showSurfaceSection ? (
          <View style={styles.surfaceSection}>
            <Text style={styles.surfaceMixText}>
              Surface mix:{' '}
              <Text style={styles.surfaceMixMuted}>
                {surfaceMixText ?? (surfaceLoading ? 'checking road surface...' : 'surface data unavailable')}
              </Text>
            </Text>
            {surfaceAnalysis?.summary.length ? (
              <View style={styles.surfaceGrid}>
                {surfaceAnalysis.summary.map(item => (
                  <View key={item.kind} style={styles.surfaceCard}>
                    <View style={styles.surfaceLabelRow}>
                      <View style={[styles.surfaceSwatch, { backgroundColor: item.color }]} />
                      <Text style={styles.surfaceLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>{item.label}</Text>
                    </View>
                    <Text style={styles.surfaceMeta} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{item.distanceKm} km · {item.percent}%</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {gpx && gpx.elevationProfile.length >= 2 ? <ElevationChart profile={gpx.elevationProfile} /> : null}

        {gpx?.track.length ? <WikiPhotosStrip track={gpx.track} /> : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  backText: { color: palette.text, fontSize: 14, fontWeight: '700' },
  header: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  headerText: { flex: 1, minWidth: 0 },
  emoji: {
    width: 50, height: 50, borderRadius: 16,
    backgroundColor: palette.panelRaised,
    textAlign: 'center', textAlignVertical: 'center',
    fontSize: 24,
  },
  title: { color: palette.text, fontSize: 24, lineHeight: 30, fontWeight: '900' },
  meta: { color: palette.textMuted, fontSize: 13, marginTop: 3 },
  actionRow: { flexDirection: 'row', gap: 8 },
  editBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(108,255,47,0.1)',
    borderWidth: 1, borderColor: 'rgba(108,255,47,0.28)',
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 7,
  },
  editBtnText: { color: palette.accent, fontSize: 13, fontWeight: '900' },
  deleteBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
    alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 7,
  },
  deleteBtnText: { color: '#f87171', fontSize: 13, fontWeight: '900' },
  shareBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  shareBtnText: { color: palette.text, fontSize: 13, fontWeight: '900' },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(108,255,47,0.28)',
    backgroundColor: 'rgba(108,255,47,0.08)',
    borderRadius: 14,
    paddingVertical: 11,
  },
  downloadText: { color: palette.accent, fontSize: 14, fontWeight: '800' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  detailText: { color: palette.textDim, fontSize: 13, flex: 1 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    width: '48%',
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 16,
    padding: 12,
  },
  statLabel: { color: palette.textMuted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  statValue: { color: palette.text, fontSize: 18, fontWeight: '900', marginTop: 4 },
  surfaceSection: { gap: 8 },
  surfaceMixText: { color: palette.text, fontSize: 13, fontWeight: '900' },
  surfaceMixMuted: { color: palette.textMuted, fontWeight: '700' },
  surfaceGrid: { flexDirection: 'row', flexWrap: 'nowrap', gap: 6 },
  surfaceCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 8,
  },
  surfaceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  surfaceSwatch: { width: 18, height: 7, borderRadius: 999 },
  surfaceLabel: { color: palette.text, fontSize: 10, fontWeight: '800', flex: 1 },
  surfaceMeta: { color: palette.textMuted, fontSize: 9.5, marginTop: 4 },
  emptyText: { color: palette.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: spacing.xl },
})
