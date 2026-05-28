import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ElevationChart } from '@/src/components/ElevationChart'
import { EventMapCard } from '@/src/components/EventMapCard'
import { CATEGORIES } from '@/src/lib/categories'
import { api } from '@/src/lib/api'
import { fetchElevationProfile, parseGpxText } from '@/src/lib/gpx'
import type { GpxParsed } from '@/src/lib/gpx'
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

  for (let i = 1; i < profile.length; i++) {
    const distKm = profile[i].km - profile[i - 1].km
    const eleM = profile[i].ele - profile[i - 1].ele
    if (eleM > 0) elevGain += eleM
    if (distKm > 0) {
      const grade = (eleM / (distKm * 1000)) * 100
      if (grade > maxGrade) maxGrade = grade
      if (grade < maxDowngrade) maxDowngrade = grade
    }
  }

  return {
    elevGain: Math.round(elevGain),
    maxGrade: Math.round(maxGrade * 10) / 10,
    maxDowngrade: Math.round(maxDowngrade * 10) / 10,
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

  async function openGpxDownload() {
    if (!id) return
    const baseUrl = api.defaults.baseURL ?? 'https://api.fitmeet.fit/api'
    try {
      await Linking.openURL(`${baseUrl}/routes/${id}/gpx`)
    } catch {
      Alert.alert('GPX route', 'Could not open GPX file.')
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
        if (!cancelled) setGpx(withProfileStats(parsed))
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={palette.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.emoji}>{emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{route.title}</Text>
            <Text style={styles.meta}>{route.category.label}{route.views_count ? ` · ${route.views_count} views` : ''}</Text>
          </View>
          {user && route.creator?.id === user.id && (
            <Pressable
              style={styles.editBtn}
              onPress={() => router.push(`/route/draw?id=${route.id}` as never)}
              hitSlop={10}
            >
              <Ionicons name="pencil-outline" size={17} color={palette.accent} />
            </Pressable>
          )}
          <Pressable style={styles.shareBtn} onPress={shareRoute} hitSlop={10}>
            <Ionicons name="share-social-outline" size={19} color={palette.text} />
          </Pressable>
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
            coloredSegments={gpx?.coloredSegments}
          />
        ) : null}

        {gpx && gpx.elevationProfile.length >= 2 ? <ElevationChart profile={gpx.elevationProfile} /> : null}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  content: { padding: spacing.lg, gap: spacing.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  backText: { color: palette.text, fontSize: 14, fontWeight: '700' },
  header: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  emoji: {
    width: 50, height: 50, borderRadius: 16,
    backgroundColor: palette.panelRaised,
    textAlign: 'center', textAlignVertical: 'center',
    fontSize: 24,
  },
  title: { color: palette.text, fontSize: 22, fontWeight: '900' },
  meta: { color: palette.textMuted, fontSize: 13, marginTop: 3 },
  editBtn: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: 'rgba(108,255,47,0.1)',
    borderWidth: 1, borderColor: 'rgba(108,255,47,0.28)',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 6,
  },
  shareBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  emptyText: { color: palette.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: spacing.xl },
})
