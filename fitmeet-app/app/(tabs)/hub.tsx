import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'

import { EmptyEvents } from '@/src/components/EmptyEvents'
import { HubMapCard } from '@/src/components/HubMapCard'
import { WeatherBadge } from '@/src/components/WeatherBadge'
import { CATEGORIES } from '@/src/lib/categories'
import { api } from '@/src/lib/api'
import { cloudLabel, CurrentWeather, fetchCurrentWeather } from '@/src/lib/weather'
import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'

interface EventItem {
  id: number
  title: string
  category: { value: string; label: string }
  location: { lat: number; lng: number; address: string | null }
  schedule: { start_at: string; timezone: string; duration_minutes: number | null }
  activity: { distance_km: number | null; elevation_gain: number | null }
  participants_count: number
  max_participants: number | null
  status: string
  is_full: boolean
  is_joined: boolean
  image_url: string | null
}

const RADIUS_OPTIONS = [
  { label: 'Nearby', km: 50 },
  { label: 'City', km: 200 },
  { label: 'Region', km: 500 },
  { label: 'All', km: null },
] as const

const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.emoji]),
)

function formatDate(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

function isPast(iso: string) {
  return new Date(iso).getTime() <= Date.now()
}

export default function HubScreen() {
  const tabBarHeight = useBottomTabBarHeight()
  const user = useAuthStore((s) => s.user)
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [radiusIdx, setRadiusIdx] = useState(0)
  const [categories, setCategories] = useState<Set<string>>(new Set())
  const [goingOnly,   setGoingOnly]   = useState(false)
  const [myOnly,      setMyOnly]      = useState(false)
  const [pastOnly,    setPastOnly]    = useState(false)
  const [reminderIds, setReminderIds] = useState<Set<number>>(new Set())
  const [showWind, setShowWind] = useState(true)
  const [showClouds, setShowClouds] = useState(true)
  const [weather, setWeather] = useState<CurrentWeather | null>(null)
  const [mapTouching, setMapTouching] = useState(false)
  const [weatherCenter, setWeatherCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [mapWasMoved, setMapWasMoved] = useState(false)

  const mapCenter = (() => {
    const lat = user?.home?.lat ?? user?.location?.lat
    const lng = user?.home?.lng ?? user?.location?.lng
    if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng }
    const first = events[0]
    if (first) return { lat: first.location.lat, lng: first.location.lng }
    return { lat: 45.5511, lng: 18.6939 }
  })()

  const mapEvents = useMemo(() => events.map((ev) => ({
    id: ev.id,
    title: ev.title,
    lat: ev.location.lat,
    lng: ev.location.lng,
    emoji: CATEGORY_EMOJI[ev.category.value] ?? '📍',
    cancelled: ev.status === 'cancelled',
  })), [events])

  const effectiveWeatherCenter = weatherCenter ?? mapCenter

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      const radius = RADIUS_OPTIONS[radiusIdx]?.km
      if (radius) params.radius_km = radius
      if (pastOnly) params.past = 1

      let source = '/events'
      if (goingOnly) source = '/events/joined'
      else if (myOnly) source = '/events/my'

      const { data } = await api.get(source, { params })
      const all: EventItem[] = data.data ?? []
      setEvents(
        categories.size > 0 && !goingOnly && !myOnly
          ? all.filter((ev) => categories.has(ev.category.value))
          : all,
      )
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [radiusIdx, goingOnly, myOnly, pastOnly, categories])

  useFocusEffect(useCallback(() => {
    fetchEvents()
    api.get('/events/my-reminders').then(({ data }) => {
      const ids = new Set<number>(Object.keys(data.data ?? {}).map(Number).filter(Boolean))
      setReminderIds(ids)
    }).catch(() => {})
  }, [fetchEvents]))

  useEffect(() => {
    if (mapWasMoved) return
    setWeatherCenter(null)
  }, [mapCenter.lat, mapCenter.lng, mapWasMoved])

  useEffect(() => {
    fetchCurrentWeather(effectiveWeatherCenter.lat, effectiveWeatherCenter.lng).then(setWeather).catch(() => setWeather(null))
  }, [effectiveWeatherCenter.lat, effectiveWeatherCenter.lng])

  function toggleCategory(value: string) {
    setCategories((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const weatherLabel = weather
    ? weather.precipitation > 0
      ? `${weather.precipitation} mm`
      : cloudLabel(weather.cloudCover)
    : null

  function shareEvent(ev: EventItem) {
    const d = new Date(ev.schedule.start_at)
    const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    Share.share({
      title: ev.title,
      message: [
        ev.title,
        `📅 ${date} · ${time}`,
        ev.location.address ? `📍 ${ev.location.address}` : null,
        `👥 ${ev.participants_count} joined`,
        '',
        `Join on FitMeet 👉 https://fitmeet.fit/events/share?id=${ev.id}`,
      ].filter(Boolean).join('\n'),
    })
  }

  const renderEvent = ({ item: ev }: { item: EventItem }) => {
    const past = isPast(ev.schedule.start_at)
    const cancelled = ev.status === 'cancelled'
    const emoji = CATEGORY_EMOJI[ev.category.value] ?? '📍'
    const hasReminder = reminderIds.has(ev.id)

    return (
      <Pressable
        onPress={() => router.push(`/event/${ev.id}` as never)}
        style={[styles.eventCard, cancelled && styles.eventCardCancelled, past && styles.eventCardPast]}
      >
        {ev.image_url ? <Image source={{ uri: ev.image_url }} style={styles.eventImage} resizeMode="cover" /> : null}
        <View style={styles.eventTop}>
          <View style={[styles.eventBadge, cancelled && styles.eventBadgeCancelled]}>
            <Text style={styles.eventEmoji}>{emoji}</Text>
          </View>
          <View style={styles.eventMeta}>
            <Text style={styles.eventTitle} numberOfLines={1}>{ev.title}</Text>
            <Text style={styles.eventCategory}>
              {ev.category.label}
              {ev.is_joined ? ' · Going' : ''}
              {cancelled ? ' · Cancelled' : ''}
              {ev.is_full && !cancelled ? ' · Full' : ''}
            </Text>
          </View>
          {hasReminder && <Ionicons name="alarm-outline" size={14} color="#58beff" style={{ marginRight: 4 }} />}
          <Pressable hitSlop={12} onPress={() => shareEvent(ev)}>
            <Ionicons name="share-social-outline" size={18} color={palette.textDim} />
          </Pressable>
        </View>
        <View style={styles.eventDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={12} color={palette.textDim} />
            <Text style={styles.detailText}>{formatDate(ev.schedule.start_at)}</Text>
          </View>
          <WeatherBadge
            lat={ev.location.lat}
            lng={ev.location.lng}
            isoDate={ev.schedule.start_at.slice(0, 10)}
            hour={new Date(ev.schedule.start_at).getHours()}
          />
          {ev.location.address ? (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={12} color={palette.textDim} />
              <Text style={styles.detailText} numberOfLines={1}>{ev.location.address}</Text>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Ionicons name="people-outline" size={12} color={palette.textDim} />
            <Text style={styles.detailText}>
              {ev.participants_count} joined{ev.max_participants ? ` · max ${ev.max_participants}` : ''}
            </Text>
          </View>
          {(ev.activity.distance_km || ev.activity.elevation_gain) ? (
            <View style={styles.detailRow}>
              <Ionicons name="flash-outline" size={12} color={palette.accent} />
              <Text style={styles.detailText}>
                {[
                  ev.activity.distance_km && `${ev.activity.distance_km} km`,
                  ev.activity.elevation_gain && `↑${ev.activity.elevation_gain} m`,
                ].filter(Boolean).join(' · ')}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    )
  }

  const header = (
    <View>
      <View style={styles.topArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Hub</Text>
            <Text style={styles.title}>Nearby energy</Text>
          </View>
          <Pressable style={styles.refreshChip} onPress={fetchEvents}>
            <Ionicons name="refresh-outline" size={16} color={palette.accent} />
            <Text style={styles.refreshLabel}>Refresh</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <Pressable style={[styles.chip, categories.size === 0 && styles.chipActive]} onPress={() => setCategories(new Set())}>
            <Text style={[styles.chipLabel, categories.size === 0 && styles.chipLabelActive]}>All interests</Text>
          </Pressable>
          {CATEGORIES.map((cat) => {
            const active = categories.has(cat.value)
            return (
              <Pressable key={cat.value} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleCategory(cat.value)}>
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{cat.emoji} {cat.label}</Text>
              </Pressable>
            )
          })}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {RADIUS_OPTIONS.map((r, i) => (
            <Pressable key={r.label} style={[styles.chip, styles.radiusChip, radiusIdx === i && styles.chipRadius]} onPress={() => setRadiusIdx(i)}>
              <Text style={[styles.chipLabel, radiusIdx === i && styles.chipLabelRadius]}>{r.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {[
            { label: 'Going', active: goingOnly, onPress: () => { setGoingOnly((v) => !v); setMyOnly(false) } },
            { label: 'My', active: myOnly, onPress: () => { setMyOnly((v) => !v); setGoingOnly(false) } },
            { label: 'Past', active: pastOnly, onPress: () => setPastOnly((v) => !v) },
          ].map((f) => (
            <Pressable key={f.label} style={[styles.chip, f.active && styles.chipActive]} onPress={f.onPress}>
              <Text style={[styles.chipLabel, f.active && styles.chipLabelActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {weather && (
            <>
              <View style={styles.weatherChip}>
                <Ionicons name="thermometer-outline" size={13} color={palette.textMuted} />
                <Text style={styles.weatherChipText}>{weather.temperature}°</Text>
              </View>
              <View style={styles.weatherChip}>
                <View style={{ transform: [{ rotate: `${(weather.windDir + 180) % 360}deg` }] }}>
                  <Ionicons name="arrow-up-outline" size={13} color={palette.textMuted} />
                </View>
                <Text style={styles.weatherChipText}>{weather.windSpeed} km/h</Text>
              </View>
              <View style={styles.weatherChip}>
                <Ionicons name="sunny-outline" size={13} color={palette.textMuted} />
                <Text style={styles.weatherChipText}>UV {weather.uvIndex}</Text>
              </View>
              {weatherLabel ? (
                <View style={styles.weatherChip}>
                  <Ionicons name="cloudy-outline" size={13} color={palette.textMuted} />
                  <Text style={styles.weatherChipText}>{weatherLabel}</Text>
                </View>
              ) : null}
            </>
          )}
          <Pressable style={[styles.chip, showWind && styles.chipWeatherOn]} onPress={() => setShowWind((v) => !v)}>
            <Ionicons name="flag-outline" size={13} color={showWind ? palette.accent : palette.textMuted} />
            <Text style={[styles.chipLabel, showWind && styles.chipLabelWeatherOn]}>Wind</Text>
          </Pressable>
          <Pressable style={[styles.chip, showClouds && styles.chipWeatherOn]} onPress={() => setShowClouds((v) => !v)}>
            <Ionicons name="cloud-outline" size={13} color={showClouds ? palette.accent : palette.textMuted} />
            <Text style={[styles.chipLabel, showClouds && styles.chipLabelWeatherOn]}>Clouds</Text>
          </Pressable>
        </ScrollView>
      </View>

      <View style={styles.mapWrap}>
        <HubMapCard
          center={mapCenter}
          events={mapEvents}
          weather={weather}
          showWind={showWind}
          showClouds={showClouds}
          height={300}
          onEventPress={(id) => router.push(`/event/${id}` as never)}
          fitToEvents={!mapWasMoved}
          onMapTouchStart={() => {
            setMapTouching(true)
          }}
          onMapTouchEnd={() => setMapTouching(false)}
          onMapCenterChange={(center) => {
            setMapWasMoved(true)
            setWeather(null)
            setWeatherCenter(center)
          }}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {goingOnly ? 'Going' : myOnly ? 'My events' : 'Events near you'}
        </Text>
        {!loading ? <Text style={styles.sectionCount}>{events.length}</Text> : null}
      </View>
    </View>
  )

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={loading ? [] : events}
        keyExtractor={(ev) => String(ev.id)}
        renderItem={renderEvent}
        scrollEnabled={!mapTouching}
        contentContainerStyle={[styles.listContent, { paddingBottom: tabBarHeight + 8 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator color={palette.accent} style={{ paddingVertical: spacing.xl }} />
            : <EmptyEvents variant="hub" />
        }
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  topArea: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 8 },
  mapWrap: { paddingHorizontal: spacing.lg, paddingVertical: 10 },
  listContent: { gap: spacing.md },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  eyebrow: { color: palette.accent, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  title: { color: palette.text, fontSize: 30, fontWeight: '800' },
  refreshChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshLabel: { color: palette.text, fontSize: 13, fontWeight: '700' },

  filterRow: { gap: 6, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: palette.panelRaised,
    borderWidth: 1,
    borderColor: palette.line,
  },
  chipActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  radiusChip: { minWidth: 78, justifyContent: 'center' },
  chipLabel: { color: palette.text, fontWeight: '700', fontSize: 12 },
  chipLabelActive: { color: '#031109' },
  chipRadius: { borderColor: 'rgba(0,168,255,0.5)', backgroundColor: 'rgba(0,168,255,0.08)' },
  chipLabelRadius: { color: '#58beff' },
  chipWeatherOn: { borderColor: `${palette.accent}55`, backgroundColor: `${palette.accent}14` },
  chipLabelWeatherOn: { color: palette.accent },

  weatherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  weatherChipText: { color: palette.text, fontSize: 12, fontWeight: '700' },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: { color: palette.text, fontSize: 18, fontWeight: '800' },
  sectionCount: {
    color: palette.accent,
    fontSize: 13,
    fontWeight: '800',
    backgroundColor: 'rgba(108,255,47,0.1)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  emptyWrap: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { color: palette.textMuted, fontSize: 14 },

  eventCard: {
    backgroundColor: palette.panel,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    gap: 12,
    overflow: 'hidden',
  },
  eventImage: { width: '100%', height: 160, borderRadius: 14, marginBottom: 4 },
  eventCardCancelled: { borderColor: 'rgba(248,113,113,0.35)', opacity: 0.7 },
  eventCardPast: { opacity: 0.6 },
  eventTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  eventBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: palette.panelRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventBadgeCancelled: { borderWidth: 1, borderColor: 'rgba(248,113,113,0.4)' },
  eventEmoji: { fontSize: 24 },
  eventMeta: { flex: 1, gap: 3 },
  eventTitle: { color: palette.text, fontSize: 16, fontWeight: '800' },
  eventCategory: { color: palette.textMuted, fontSize: 13 },
  eventDetails: { gap: 5 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { color: palette.textDim, fontSize: 12, flex: 1 },
})
