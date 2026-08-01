import { Ionicons } from '@expo/vector-icons'
import { EmptyEvents } from '@/src/components/EmptyEvents'
import { EventCommentsPreview } from '@/src/components/EventCommentsPreview'
import { InProgressBadge } from '@/src/components/InProgressBadge'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, Share,
  StyleSheet, Text, TextInput, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'

import { api } from '@/src/lib/api'
import { CalendarModal } from '@/src/components/CalendarModal'
import { CATEGORIES } from '@/src/lib/categories'
import { WeatherBadge } from '@/src/components/WeatherBadge'
import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'
import { fetchEventWeatherSnapshots, type EventWeatherSnapshot } from '@/src/lib/event-weather-snapshots'
import { sortEventsBySchedule } from '@/src/lib/event-order'
import { fetchGpxActivityStats, type GpxActivityStats } from '@/src/lib/gpx-activity-stats'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventItem {
  id: number
  title: string
  category: { value: string; label: string }
  location: { lat: number | null; lng: number | null; address: string | null }
  schedule: { start_at: string; timezone: string; duration_minutes: number | null }
  activity: { distance_km: number | null; elevation_gain: number | null; gpx_url?: string | null }
  participants_count: number
  max_participants: number | null
  status: string
  is_full: boolean
  is_joined: boolean
  is_organizer: boolean
  is_in_progress: boolean
  skill_level: string | null
  image_url: string | null
  views_count: number
  comments_count: number
}

interface UserItem {
  id: number
  name: string
  email: string
  avatar: string | null
  skill_level: string | null
  categories: string[]
  home: { city: string | null; country: string | null }
  friendship_status: 'friends' | 'pending_sent' | 'pending_received' | null
  events_count: number
  created_at?: string | null
  beer_score?: number
  beer_top_tier?: string | null
}

type PeopleSort = 'latest' | 'name' | 'beer' | 'events'
type RouteSort = 'new' | 'popular' | 'distance_asc' | 'distance_desc' | 'elevation_asc' | 'elevation_desc'

interface RouteItem {
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
}

interface TrainingItem {
  id: number
  provider: string
  category: { value: string; label: string }
  name: string | null
  started_at: string
  duration_s: number | null
  distance_m: number | null
  elevation_gain: number | null
  avg_heartrate: number | null
  max_heartrate: number | null
  avg_watts: number | null
  max_watts: number | null
  avg_cadence: number | null
  calories: number | null
  avg_speed_mps: number | null
  max_speed_mps: number | null
  kilojoules: number | null
  suffer_score: number | null
  gear_name: string | null
  description: string | null
  is_merged: boolean
}

interface TrainingTotals {
  count: number
  distance_m: number
  duration_s: number
  elevation_gain: number
  calories: number
}

const PEOPLE_SORT_OPTIONS: { key: PeopleSort; label: string }[] = [
  { key: 'latest', label: 'New' },
  { key: 'name',   label: 'Name' },
  { key: 'beer',   label: 'Beer' },
  { key: 'events', label: 'Events' },
]

const PEOPLE_SORT_DEFAULT_DIR: Record<PeopleSort, 'asc' | 'desc'> = {
  latest: 'desc',
  name:   'asc',
  beer:   'desc',
  events: 'desc',
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RADIUS_OPTIONS = [
  { label: 'All',    km: null },
  { label: '50 km',  km: 50 },
  { label: '200 km', km: 200 },
  { label: '500 km', km: 500 },
] as const

const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.emoji])
)

const PROVIDER_LABEL: Record<string, string> = {
  strava: 'Strava',
  garmin: 'Garmin',
  huawei: 'Huawei Health',
}

const PROVIDER_COLOR: Record<string, string> = {
  strava: '#FC4C02',
  garmin: '#00799B',
  huawei: '#C7000B',
}

const MONTHS = [
  { value: 0, label: 'All' },
  { value: 1, label: 'Jan' }, { value: 2, label: 'Feb' }, { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' }, { value: 5, label: 'May' }, { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' }, { value: 8, label: 'Aug' }, { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' }, { value: 11, label: 'Nov' }, { value: 12, label: 'Dec' },
] as const

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [0, ...Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i)]

const PACE_CATEGORIES = new Set(['running', 'hiking'])

function formatTrainingDuration(seconds: number | null): string | null {
  if (!seconds) return null
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m} min`
}

function formatTrainingDistance(meters: number | null): string | null {
  if (!meters) return null
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
}

function formatTrainingDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTrainingSpeed(mps: number | null, category: string): string | null {
  if (!mps) return null
  if (PACE_CATEGORIES.has(category)) {
    const secPerKm = 1000 / mps
    const m = Math.floor(secPerKm / 60)
    const s = Math.round(secPerKm % 60)
    return `${m}:${String(s).padStart(2, '0')} /km`
  }
  return `${(mps * 3.6).toFixed(1)} km/h`
}

interface TrainingDetailStat {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
}

function buildTrainingDetails(t: TrainingItem): TrainingDetailStat[] {
  const avgSpeed = formatTrainingSpeed(t.avg_speed_mps, t.category.value)
  const maxSpeed = formatTrainingSpeed(t.max_speed_mps, t.category.value)
  const details: (TrainingDetailStat | false)[] = [
    t.avg_heartrate != null && { icon: 'heart-outline', label: 'Avg heart rate', value: `${Math.round(t.avg_heartrate)} bpm` },
    t.max_heartrate != null && { icon: 'heart-outline', label: 'Max heart rate', value: `${Math.round(t.max_heartrate)} bpm` },
    t.avg_watts != null && { icon: 'flash-outline', label: 'Avg power', value: `${Math.round(t.avg_watts)} W` },
    t.max_watts != null && { icon: 'flash-outline', label: 'Max power', value: `${Math.round(t.max_watts)} W` },
    t.avg_cadence != null && { icon: 'speedometer-outline', label: 'Cadence', value: `${Math.round(t.avg_cadence)} rpm` },
    t.calories != null && { icon: 'flame-outline', label: 'Calories', value: `${Math.round(t.calories)} kcal` },
    avgSpeed != null && { icon: 'trending-up-outline', label: 'Avg speed', value: avgSpeed },
    maxSpeed != null && { icon: 'trending-up-outline', label: 'Max speed', value: maxSpeed },
    t.kilojoules != null && { icon: 'flash-outline', label: 'Energy', value: `${Math.round(t.kilojoules)} kJ` },
    t.suffer_score != null && { icon: 'pulse-outline', label: 'Relative effort', value: `${Math.round(t.suffer_score)}` },
    t.gear_name != null && { icon: 'pricetag-outline', label: 'Gear', value: t.gear_name },
  ]
  return details.filter((d): d is TrainingDetailStat => d !== false)
}

type SortKey = 'soonest' | 'views' | 'joined'
type SortDirection = 'asc' | 'desc'

const SORT_OPTIONS: Array<{ key: SortKey; label: string; icon: string }> = [
  { key: 'soonest', label: 'Event date',  icon: 'calendar-outline' },
  { key: 'views',  label: 'Most viewed', icon: 'eye-outline' },
  { key: 'joined', label: 'Most joined', icon: 'people-outline' },
]

const ROUTE_SORT_OPTIONS: Array<{ key: RouteSort; label: string; icon: string }> = [
  { key: 'new', label: 'Newest', icon: 'sparkles-outline' },
  { key: 'popular', label: 'Popular', icon: 'eye-outline' },
  { key: 'distance_asc', label: 'Shortest', icon: 'resize-outline' },
  { key: 'distance_desc', label: 'Longest', icon: 'resize-outline' },
  { key: 'elevation_asc', label: 'Least climb', icon: 'trending-up-outline' },
  { key: 'elevation_desc', label: 'Most climb', icon: 'trending-up-outline' },
]

const ROUTE_DISTANCE_FILTERS = [
  { label: 'Any', min: null, max: null },
  { label: '< 10 km', min: null, max: 10 },
  { label: '10-30 km', min: 10, max: 30 },
  { label: '30-80 km', min: 30, max: 80 },
  { label: '80+ km', min: 80, max: null },
] as const

const ROUTE_ELEVATION_FILTERS = [
  { label: 'Any climb', min: null, max: null },
  { label: '< 300 m', min: null, max: 300 },
  { label: '300-1000 m', min: 300, max: 1000 },
  { label: '1000+ m', min: 1000, max: null },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }
}

function isPast(iso: string) {
  return new Date(iso).getTime() <= Date.now()
}

const COUNTRY_CODE_BY_NAME: Record<string, string> = {
  croatia: 'HR',
  hrvatska: 'HR',
  slovenia: 'SI',
  slovenija: 'SI',
  serbia: 'RS',
  srbija: 'RS',
  bosnia: 'BA',
  'bosnia and herzegovina': 'BA',
  'bosna i hercegovina': 'BA',
  montenegro: 'ME',
  'crna gora': 'ME',
  austria: 'AT',
  austrija: 'AT',
  germany: 'DE',
  njemacka: 'DE',
  italy: 'IT',
  italija: 'IT',
  hungary: 'HU',
  madarska: 'HU',
  france: 'FR',
  francuska: 'FR',
  spain: 'ES',
  spanjolska: 'ES',
  'united kingdom': 'GB',
  uk: 'GB',
  'united states': 'US',
  usa: 'US',
}

function countryFlag(country?: string | null) {
  const raw = country?.trim()
  if (!raw) return null

  const normalized = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const code = /^[a-z]{2}$/i.test(raw)
    ? raw.toUpperCase()
    : COUNTRY_CODE_BY_NAME[normalized]

  if (!code || !/^[A-Z]{2}$/.test(code)) return null

  return String.fromCodePoint(
    ...code.split('').map((char) => 127397 + char.charCodeAt(0)),
  )
}

// ─── Events Tab ───────────────────────────────────────────────────────────────

function EventsTab() {
  const user = useAuthStore((s) => s.user)
  const [events,     setEvents]     = useState<EventItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState(1)
  const [lastPage,   setLastPage]   = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [radiusKm,   setRadiusKm]   = useState<number | null>(null)
  const [goingOnly,   setGoingOnly]   = useState(false)
  const [friendsOnly, setFriendsOnly] = useState(false)
  const [myOnly,      setMyOnly]      = useState(false)
  const [pastOnly,    setPastOnly]    = useState(false)
  const [reminderIds, setReminderIds] = useState<Set<number>>(new Set())
  const [showFilter, setShowFilter] = useState(false)
  const [showSort, setShowSort] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('soonest')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [weatherSnapshots, setWeatherSnapshots] = useState<Record<number, EventWeatherSnapshot | null>>({})
  const [gpxStats, setGpxStats] = useState<Record<number, GpxActivityStats>>({})
  const discoveryLat = user?.home?.lat ?? user?.location?.lat ?? null
  const discoveryLng = user?.home?.lng ?? user?.location?.lng ?? null

  // Prefill category + radius filters from the user's profile settings
  useEffect(() => {
    setSelectedCategories(new Set(user?.categories ?? []))
  }, [user?.categories])

  useEffect(() => {
    if (user?.radius_km == null) return
    setRadiusKm(user.radius_km >= 9999 ? null : user.radius_km)
  }, [user?.radius_km])

  function toggleCategory(value: string) {
    setSelectedCategories(prev => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const load = useCallback(async (pageNum = 1) => {
    if (pageNum === 1) setLoading(true)
    else setLoadingMore(true)
    try {
      let url = '/events'
      const params: Record<string, unknown> = { page: pageNum, per_page: 100 }
      if (sortKey !== 'soonest') {
        params.sort = sortKey
        params.order = sortDirection
      }
      if (pastOnly) params.past = 1
      if (goingOnly) {
        url = '/events/joined'
      } else if (myOnly) {
        url = '/events/my'
      } else {
        if (selectedCategories.size > 0) params.category = Array.from(selectedCategories).join(',')
        if (radiusKm) {
          params.radius_km = radiusKm
          if (typeof discoveryLat === 'number' && typeof discoveryLng === 'number') {
            params.lat = discoveryLat
            params.lng = discoveryLng
          }
        }
        if (friendsOnly) params.friends_only = 1
      }
      const { data } = await api.get(url, { params })
      const incoming: EventItem[] = data.data ?? []
      setEvents(prev => {
        const merged = pageNum === 1 ? incoming : [...prev, ...incoming]
        return sortKey === 'soonest'
          ? sortEventsBySchedule(merged, { pastOnly, direction: sortDirection })
          : merged
      })
      setPage(pageNum)
      setLastPage(data.meta?.last_page ?? 1)
    } catch {}
    finally { setLoading(false); setLoadingMore(false) }
  }, [selectedCategories, radiusKm, goingOnly, friendsOnly, myOnly, pastOnly, sortKey, sortDirection, discoveryLat, discoveryLng])

  useFocusEffect(useCallback(() => { load() }, [load]))
  useEffect(() => {
    api.get('/events/my-reminders').then(({ data }) => {
      const ids = new Set<number>(Object.keys(data.data ?? {}).map(Number).filter(Boolean))
      setReminderIds(ids)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const targets = events.filter((event) => event.activity.gpx_url)

    if (targets.length === 0) {
      setGpxStats({})
      return
    }

    let cancelled = false
    const token = useAuthStore.getState().token

    Promise.all(
      targets.map(async (event) => ({
        id: event.id,
        stats: await fetchGpxActivityStats(event.activity.gpx_url!, token).catch(() => null),
      })),
    ).then((entries) => {
      if (cancelled) return
      const next: Record<number, GpxActivityStats> = {}
      for (const entry of entries) {
        if (entry.stats) next[entry.id] = entry.stats
      }
      setGpxStats(next)
    }).catch(() => {
      if (!cancelled) setGpxStats({})
    })

    return () => {
      cancelled = true
    }
  }, [events])

  useEffect(() => {
    const weatherEligibleIds = events
      .filter((event) => event.location.lat != null && event.location.lng != null)
      .map((event) => event.id)

    if (weatherEligibleIds.length === 0) {
      setWeatherSnapshots({})
      return
    }

    let cancelled = false

    fetchEventWeatherSnapshots(weatherEligibleIds)
      .then((data) => {
        if (!cancelled) setWeatherSnapshots(data)
      })
      .catch(() => {
        if (!cancelled) setWeatherSnapshots({})
      })

    return () => {
      cancelled = true
    }
  }, [events])

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

  const activeFilterCount =
    (selectedCategories.size > 0 ? 1 : 0) + (radiusKm !== null ? 1 : 0) +
    (goingOnly ? 1 : 0) + (friendsOnly ? 1 : 0) + (myOnly ? 1 : 0) + (pastOnly ? 1 : 0)

  const activeSort = SORT_OPTIONS.find(option => option.key === sortKey) ?? SORT_OPTIONS[0]

  function handleSortPress(key: SortKey) {
    if (sortKey === key) {
      setSortDirection(direction => direction === 'desc' ? 'asc' : 'desc')
      return
    }

    setSortKey(key)
    setSortDirection(key === 'soonest' ? 'asc' : 'desc')
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.filterToolbar}>
        <Pressable
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => { setShowFilter(v => !v); setShowSort(false) }}
        >
          <Ionicons name="options-outline" size={15} color={activeFilterCount > 0 ? '#031109' : palette.text} />
          <Text style={[styles.filterBtnLabel, activeFilterCount > 0 && styles.filterBtnLabelActive]}>Filter</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={[styles.filterBtn, styles.sortBtn, showSort && styles.sortBtnActive]}
          onPress={() => { setShowSort(v => !v); setShowFilter(false) }}
        >
          <Ionicons name="swap-vertical-outline" size={15} color={showSort ? '#031109' : palette.text} />
          <Text style={[styles.filterBtnLabel, showSort && styles.filterBtnLabelActive]}>Sort</Text>
          <Ionicons
            name={sortDirection === 'desc' ? 'arrow-down-outline' : 'arrow-up-outline'}
            size={13}
            color={showSort ? '#031109' : palette.accent}
          />
        </Pressable>
      </View>

      {showFilter && (
        <View style={styles.filterDropdown}>
          <Text style={styles.filterSectionLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <Pressable style={[styles.filterChip, selectedCategories.size === 0 && styles.filterChipActive]} onPress={() => setSelectedCategories(new Set())}>
              <Text style={[styles.filterLabel, selectedCategories.size === 0 && styles.filterLabelActive]}>All</Text>
            </Pressable>
            {CATEGORIES.map(cat => (
              <Pressable
                key={cat.value}
                style={[styles.filterChip, selectedCategories.has(cat.value) && styles.filterChipActive]}
                onPress={() => toggleCategory(cat.value)}
              >
                <Text style={[styles.filterLabel, selectedCategories.has(cat.value) && styles.filterLabelActive]}>
                  {cat.emoji} {cat.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.filterSectionLabel}>Distance</Text>
          <View style={styles.filterRow}>
            {RADIUS_OPTIONS.map(r => (
              <Pressable
                key={String(r.km)}
                style={[styles.filterChip, radiusKm === r.km && styles.radiusChipActive]}
                onPress={() => setRadiusKm(r.km)}
              >
                <Text style={[styles.filterLabel, radiusKm === r.km && styles.radiusLabelActive]}>{r.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.filterSectionLabel}>Show</Text>
          <View style={styles.filterRow}>
            {[
              { label: 'Going',   active: goingOnly,   toggle: () => { setGoingOnly(v => !v); setFriendsOnly(false); setMyOnly(false) } },
              { label: 'Friends', active: friendsOnly, toggle: () => { setFriendsOnly(v => !v); setGoingOnly(false); setMyOnly(false) } },
              { label: 'My',      active: myOnly,      toggle: () => { setMyOnly(v => !v); setGoingOnly(false) } },
              { label: 'Past',    active: pastOnly,    toggle: () => setPastOnly(v => !v) },
            ].map(f => (
              <Pressable key={f.label} style={[styles.filterChip, f.active && styles.filterChipActive]} onPress={f.toggle}>
                <Text style={[styles.filterLabel, f.active && styles.filterLabelActive]}>{f.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {showSort && (
        <View style={styles.filterDropdown}>
          <Text style={styles.filterSectionLabel}>Sort</Text>
          <View style={styles.sortList}>
            {SORT_OPTIONS.map(option => {
              const active = option.key === activeSort.key
              return (
                <Pressable
                  key={option.key}
                  style={[styles.sortOption, active && styles.sortOptionActive]}
                  onPress={() => handleSortPress(option.key)}
                >
                  <Ionicons
                    name={option.icon as keyof typeof Ionicons.glyphMap}
                    size={15}
                    color={active ? '#031109' : palette.textMuted}
                  />
                  <Text style={[styles.sortOptionText, active && styles.sortOptionTextActive]}>
                    {option.label}
                  </Text>
                  {active && (
                    <Ionicons
                      name={sortDirection === 'desc' ? 'arrow-down-outline' : 'arrow-up-outline'}
                      size={14}
                      color="#031109"
                    />
                  )}
                </Pressable>
              )
            })}
          </View>
        </View>
      )}

      {loading && <ActivityIndicator color={palette.accent} style={{ paddingVertical: spacing.xl }} />}
      {!loading && events.length === 0 && (
        <EmptyEvents variant="meet" />
      )}

      {!loading && events.map(ev => {
        const past        = isPast(ev.schedule.start_at)
        const cancelled   = ev.status === 'cancelled'
        const hasReminder = reminderIds.has(ev.id)
        const { date, time } = formatDate(ev.schedule.start_at)
        const emoji = CATEGORY_EMOJI[ev.category.value] ?? '📍'

        const activityDistanceKm = gpxStats[ev.id]?.distanceKm ?? ev.activity.distance_km
        const activityElevGain = gpxStats[ev.id]?.elevGain ?? ev.activity.elevation_gain

        return (
          <Pressable
            key={ev.id}
            onPress={() => router.push(`/event/${ev.id}` as never)}
            style={[
              styles.eventCard,
              cancelled && styles.eventCardCancelled,
              (past || cancelled) && styles.eventCardMuted,
            ]}
          >
            {ev.image_url ? (
              <Image source={{ uri: ev.image_url }} style={styles.eventImage} resizeMode="cover" />
            ) : null}
            {/* Top row */}
            <View style={styles.eventTop}>
              <View style={styles.eventBadge}>
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <Text style={[styles.eventTitle, { flex: 1 }]} numberOfLines={1}>{ev.title}</Text>
                  {ev.is_in_progress && <InProgressBadge />}
                </View>
                <View style={styles.tagRow}>
                  <View style={styles.catTag}>
                    <Text style={styles.catTagText}>{ev.category.label}</Text>
                  </View>
                  {ev.skill_level && (
                    <Text style={styles.skillText}>{ev.skill_level}</Text>
                  )}
                  {cancelled && <Text style={styles.cancelText}>Cancelled</Text>}
                  {ev.is_full && !cancelled && <Text style={styles.fullText}>Full</Text>}
                  {past && !cancelled && <Text style={styles.pastText}>Past</Text>}
                  {hasReminder && <Ionicons name="alarm-outline" size={14} color="#58beff" />}
                </View>
              </View>
              <Pressable onPress={(e) => { e.stopPropagation(); shareEvent(ev) }} hitSlop={8}>
                <Ionicons name="share-outline" size={18} color={palette.textDim} />
              </Pressable>
            </View>

            {/* Details */}
            <View style={styles.details}>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={12} color={palette.textDim} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailText}>{date}</Text>
                  <Text style={styles.detailText}>
                    {time}{ev.schedule.duration_minutes ? ` · ${ev.schedule.duration_minutes} min` : ''}
                  </Text>
                </View>
              </View>
              {ev.location.lat != null && ev.location.lng != null && (
                <WeatherBadge
                  lat={ev.location.lat}
                  lng={ev.location.lng}
                  isoDate={ev.schedule.start_at.slice(0, 10)}
                  hour={new Date(ev.schedule.start_at).getHours()}
                  weather={weatherSnapshots[ev.id] ?? null}
                />
              )}
              {ev.location.address ? (
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={12} color={palette.textDim} />
                  <Text style={[styles.detailText, { flex: 1 }]} numberOfLines={1}>
                    {ev.location.address}
                  </Text>
                </View>
              ) : null}
              <View style={styles.detailRow}>
                <Ionicons name="people-outline" size={12} color={palette.textDim} />
                <Text style={styles.detailText}>
                  {ev.participants_count} joined
                  {ev.max_participants ? ` · max ${ev.max_participants}` : ''}
                  {ev.is_joined ? ' · ✓ Going' : ''}
                </Text>
              </View>
              {(activityDistanceKm != null || activityElevGain != null) ? (
                <View style={styles.detailRow}>
                  <Ionicons name="flash-outline" size={12} color={palette.accent} />
                  <Text style={styles.detailText}>
                    {[
                      activityDistanceKm != null && `${activityDistanceKm} km`,
                      activityElevGain != null && `↑${activityElevGain} m`,
                    ].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              ) : null}
              {ev.views_count > 0 && (
                <View style={styles.detailRow}>
                  <Ionicons name="eye-outline" size={12} color={palette.textDim} />
                  <Text style={styles.detailText}>{ev.views_count} seen</Text>
                </View>
              )}
              <EventCommentsPreview eventId={ev.id} count={ev.comments_count ?? 0} />
            </View>
          </Pressable>
        )
      })}

      {!loading && events.length > 0 && page < lastPage && (
        <Pressable
          style={styles.loadMoreBtn}
          onPress={() => load(page + 1)}
          disabled={loadingMore}
        >
          {loadingMore
            ? <ActivityIndicator size="small" color={palette.accent} />
            : <Text style={styles.loadMoreText}>Load more</Text>
          }
        </Pressable>
      )}
    </View>
  )
}

// ─── Routes Tab ───────────────────────────────────────────────────────────────

function RoutesTab() {
  const user = useAuthStore((s) => s.user)
  const [routes, setRoutes] = useState<RouteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const qRef = useRef('')
  const [category, setCategory] = useState('')
  const [radiusKm, setRadiusKm] = useState<number | null>(null)
  const [distanceFilter, setDistanceFilter] = useState(0)
  const [elevationFilter, setElevationFilter] = useState(0)
  const [sortKey, setSortKey] = useState<RouteSort>('new')
  const [showFilter, setShowFilter] = useState(false)
  const [showSort, setShowSort] = useState(false)
  const discoveryLat = user?.home?.lat ?? user?.location?.lat ?? null
  const discoveryLng = user?.home?.lng ?? user?.location?.lng ?? null

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const distance = ROUTE_DISTANCE_FILTERS[distanceFilter]
      const elevation = ROUTE_ELEVATION_FILTERS[elevationFilter]
      const params: Record<string, unknown> = { per_page: 100, sort: sortKey }
      if (qRef.current.trim()) params.q = qRef.current.trim()
      if (category) params.category = category
      if (distance.min != null) params.distance_min = distance.min
      if (distance.max != null) params.distance_max = distance.max
      if (elevation.min != null) params.elevation_min = elevation.min
      if (elevation.max != null) params.elevation_max = elevation.max
      if (radiusKm && typeof discoveryLat === 'number' && typeof discoveryLng === 'number') {
        params.lat = discoveryLat
        params.lng = discoveryLng
        params.radius_km = radiusKm
      }
      const { data } = await api.get('/routes', { params })
      setRoutes(data.data ?? [])
    } catch {
      setRoutes([])
    } finally {
      setLoading(false)
    }
  }, [category, discoveryLat, discoveryLng, distanceFilter, elevationFilter, radiusKm, sortKey])

  useFocusEffect(useCallback(() => { load() }, [load]))

  useEffect(() => {
    qRef.current = q
    const t = setTimeout(() => load(), q ? 300 : 0)
    return () => clearTimeout(t)
  }, [q, load])

  const activeFilterCount =
    (category ? 1 : 0) + (radiusKm !== null ? 1 : 0) + (distanceFilter ? 1 : 0) + (elevationFilter ? 1 : 0)
  const activeSort = ROUTE_SORT_OPTIONS.find(option => option.key === sortKey) ?? ROUTE_SORT_OPTIONS[0]

  return (
    <View style={{ gap: spacing.md }}>
      <Pressable
        style={styles.createRouteBtn}
        onPress={() => router.push('/route/draw' as never)}
      >
        <Ionicons name="pencil-outline" size={16} color={palette.accent} />
        <Text style={styles.createRouteBtnText}>Create new route</Text>
      </Pressable>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={palette.textDim} />
        <TextInput
          style={styles.searchInput}
          value={q}
          onChangeText={setQ}
          placeholder="Search routes…"
          placeholderTextColor={palette.textDim}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {q.length > 0 && (
          <Pressable onPress={() => setQ('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={palette.textDim} />
          </Pressable>
        )}
      </View>

      <View style={styles.filterToolbar}>
        <Pressable
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => { setShowFilter(v => !v); setShowSort(false) }}
        >
          <Ionicons name="options-outline" size={15} color={activeFilterCount > 0 ? '#031109' : palette.text} />
          <Text style={[styles.filterBtnLabel, activeFilterCount > 0 && styles.filterBtnLabelActive]}>Filter</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={[styles.filterBtn, styles.sortBtn, showSort && styles.sortBtnActive]}
          onPress={() => { setShowSort(v => !v); setShowFilter(false) }}
        >
          <Ionicons name="swap-vertical-outline" size={15} color={showSort ? '#031109' : palette.text} />
          <Text style={[styles.filterBtnLabel, showSort && styles.filterBtnLabelActive]}>{activeSort.label}</Text>
        </Pressable>
      </View>

      {showFilter && (
        <View style={styles.filterDropdown}>
          <Text style={styles.filterSectionLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <Pressable style={[styles.filterChip, !category && styles.filterChipActive]} onPress={() => setCategory('')}>
              <Text style={[styles.filterLabel, !category && styles.filterLabelActive]}>All</Text>
            </Pressable>
            {CATEGORIES.map(cat => (
              <Pressable key={cat.value} style={[styles.filterChip, category === cat.value && styles.filterChipActive]} onPress={() => setCategory(v => v === cat.value ? '' : cat.value)}>
                <Text style={[styles.filterLabel, category === cat.value && styles.filterLabelActive]}>{cat.emoji} {cat.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.filterSectionLabel}>Near me</Text>
          <View style={styles.filterRow}>
            {RADIUS_OPTIONS.map(r => (
              <Pressable key={String(r.km)} style={[styles.filterChip, radiusKm === r.km && styles.radiusChipActive]} onPress={() => setRadiusKm(r.km)}>
                <Text style={[styles.filterLabel, radiusKm === r.km && styles.radiusLabelActive]}>{r.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.filterSectionLabel}>Route distance</Text>
          <View style={styles.filterRow}>
            {ROUTE_DISTANCE_FILTERS.map((item, index) => (
              <Pressable key={item.label} style={[styles.filterChip, distanceFilter === index && styles.filterChipActive]} onPress={() => setDistanceFilter(index)}>
                <Text style={[styles.filterLabel, distanceFilter === index && styles.filterLabelActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.filterSectionLabel}>Elevation</Text>
          <View style={styles.filterRow}>
            {ROUTE_ELEVATION_FILTERS.map((item, index) => (
              <Pressable key={item.label} style={[styles.filterChip, elevationFilter === index && styles.filterChipActive]} onPress={() => setElevationFilter(index)}>
                <Text style={[styles.filterLabel, elevationFilter === index && styles.filterLabelActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {showSort && (
        <View style={styles.filterDropdown}>
          <Text style={styles.filterSectionLabel}>Sort</Text>
          <View style={styles.sortList}>
            {ROUTE_SORT_OPTIONS.map(option => {
              const active = option.key === sortKey
              return (
                <Pressable key={option.key} style={[styles.sortOption, active && styles.sortOptionActive]} onPress={() => setSortKey(option.key)}>
                  <Ionicons name={option.icon as keyof typeof Ionicons.glyphMap} size={15} color={active ? '#031109' : palette.textMuted} />
                  <Text style={[styles.sortOptionText, active && styles.sortOptionTextActive]}>{option.label}</Text>
                </Pressable>
              )
            })}
          </View>
        </View>
      )}

      {loading && <ActivityIndicator color={palette.accent} style={{ paddingVertical: spacing.xl }} />}
      {!loading && routes.length === 0 && <Text style={styles.emptyText}>No routes found.</Text>}

      {!loading && routes.map(route => {
        const emoji = CATEGORY_EMOJI[route.category.value] ?? '📍'
        return (
          <Pressable key={route.id} style={styles.eventCard} onPress={() => router.push(`/route/${route.id}` as never)}>
            <View style={styles.eventTop}>
              <View style={styles.eventBadge}><Text style={{ fontSize: 22 }}>{emoji}</Text></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.eventTitle} numberOfLines={1}>{route.title}</Text>
                <View style={styles.tagRow}>
                  <View style={styles.catTag}><Text style={styles.catTagText}>{route.category.label}</Text></View>
                  {route.views_count > 0 && <Text style={styles.skillText}>{route.views_count} views</Text>}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.textDim} />
            </View>
            <View style={styles.details}>
              {route.location.area_label ? (
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={12} color={palette.textDim} />
                  <Text style={[styles.detailText, { flex: 1 }]} numberOfLines={1}>{route.location.area_label}</Text>
                </View>
              ) : null}
              <View style={styles.detailRow}>
                <Ionicons name="flash-outline" size={12} color={palette.accent} />
                <Text style={styles.detailText}>
                  {[
                    route.stats.distance_km != null && `${route.stats.distance_km} km`,
                    route.stats.elevation_gain != null && `↑${route.stats.elevation_gain} m`,
                    route.stats.max_grade != null && `▲ ${route.stats.max_grade}%`,
                    route.stats.max_downgrade != null && `▼ ${Math.abs(route.stats.max_downgrade)}%`,
                  ].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

// ─── Trainings Tab ────────────────────────────────────────────────────────────

function TrainingsTab() {
  const [trainings, setTrainings] = useState<TrainingItem[]>([])
  const [totals, setTotals] = useState<TrainingTotals | null>(null)
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [month, setMonth] = useState(0)
  const [year, setYear] = useState(0)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [showFilter, setShowFilter] = useState(false)

  const activeFilterCount = (category ? 1 : 0) + (month ? 1 : 0) + (year ? 1 : 0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      if (category) params.category = category
      if (month) params.month = month
      if (year) params.year = year
      const { data } = await api.get('/trainings', { params })
      setTrainings(data.data ?? [])
      setTotals(data.totals ?? null)
    } catch {
      setTrainings([])
      setTotals(null)
    } finally {
      setLoading(false)
    }
  }, [category, month, year])

  useFocusEffect(useCallback(() => { load() }, [load]))

  function toggleExpanded(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Pressable
        style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
        onPress={() => setShowFilter(v => !v)}
      >
        <Ionicons name="options-outline" size={15} color={activeFilterCount > 0 ? '#031109' : palette.text} />
        <Text style={[styles.filterBtnLabel, activeFilterCount > 0 && styles.filterBtnLabelActive]}>Filter</Text>
        {activeFilterCount > 0 && (
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
          </View>
        )}
      </Pressable>

      {showFilter && (
        <View style={styles.filterDropdownThin}>
          <Text style={styles.filterSectionLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <Pressable style={[styles.filterChip, !category && styles.filterChipActive]} onPress={() => setCategory('')}>
              <Text style={[styles.filterLabel, !category && styles.filterLabelActive]}>All</Text>
            </Pressable>
            {CATEGORIES.map(cat => (
              <Pressable key={cat.value} style={[styles.filterChip, category === cat.value && styles.filterChipActive]} onPress={() => setCategory(v => v === cat.value ? '' : cat.value)}>
                <Text style={[styles.filterLabel, category === cat.value && styles.filterLabelActive]}>{cat.emoji} {cat.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.filterSectionLabel}>Month</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {MONTHS.map(m => (
              <Pressable key={m.value} style={[styles.filterChip, month === m.value && styles.filterChipActive]} onPress={() => setMonth(m.value)}>
                <Text style={[styles.filterLabel, month === m.value && styles.filterLabelActive]}>{m.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.filterSectionLabel}>Year</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {YEARS.map(y => (
              <Pressable key={y} style={[styles.filterChip, year === y && styles.filterChipActive]} onPress={() => setYear(y)}>
                <Text style={[styles.filterLabel, year === y && styles.filterLabelActive]}>{y === 0 ? 'All years' : y}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {!loading && totals && totals.count > 0 && (
        <View style={styles.totalsCard}>
          <View style={styles.totalStat}>
            <Ionicons name="barbell-outline" size={16} color={palette.accent} />
            <View>
              <Text style={styles.totalStatValue}>{totals.count}</Text>
              <Text style={styles.totalStatLabel}>{totals.count === 1 ? 'Training' : 'Trainings'}</Text>
            </View>
          </View>
          {formatTrainingDistance(totals.distance_m) && (
            <View style={styles.totalStat}>
              <Ionicons name="flash-outline" size={16} color={palette.accent} />
              <View>
                <Text style={styles.totalStatValue}>{formatTrainingDistance(totals.distance_m)}</Text>
                <Text style={styles.totalStatLabel}>Distance</Text>
              </View>
            </View>
          )}
          {formatTrainingDuration(totals.duration_s) && (
            <View style={styles.totalStat}>
              <Ionicons name="time-outline" size={16} color={palette.accent} />
              <View>
                <Text style={styles.totalStatValue}>{formatTrainingDuration(totals.duration_s)}</Text>
                <Text style={styles.totalStatLabel}>Time</Text>
              </View>
            </View>
          )}
          {totals.elevation_gain > 0 && (
            <View style={styles.totalStat}>
              <Ionicons name="triangle-outline" size={16} color={palette.accent} />
              <View>
                <Text style={styles.totalStatValue}>{Math.round(totals.elevation_gain)} m</Text>
                <Text style={styles.totalStatLabel}>Elevation</Text>
              </View>
            </View>
          )}
          {totals.calories > 0 && (
            <View style={styles.totalStat}>
              <Ionicons name="flame-outline" size={16} color={palette.accent} />
              <View>
                <Text style={styles.totalStatValue}>{Math.round(totals.calories)} kcal</Text>
                <Text style={styles.totalStatLabel}>Calories</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {loading && <ActivityIndicator color={palette.accent} style={{ paddingVertical: spacing.xl }} />}

      {!loading && trainings.length === 0 && (
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: spacing.xl }}>
          <Text style={styles.emptyText}>No trainings synced yet.</Text>
          <Pressable style={styles.createRouteBtn} onPress={() => router.push('/connected-apps' as never)}>
            <Ionicons name="link-outline" size={16} color={palette.accent} />
            <Text style={styles.createRouteBtnText}>Connect an app</Text>
          </Pressable>
        </View>
      )}

      {!loading && trainings.map(training => {
        const details = buildTrainingDetails(training)
        const expanded = expandedIds.has(training.id)
        const emoji = CATEGORY_EMOJI[training.category.value] ?? '🏋️'
        return (
          <View key={training.id} style={styles.eventCard}>
            <View style={styles.eventTop}>
              <View style={styles.eventBadge}><Text style={{ fontSize: 22 }}>{emoji}</Text></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.eventTitle} numberOfLines={1}>{training.name ?? training.category.label}</Text>
                <View style={styles.tagRow}>
                  <View style={styles.catTag}><Text style={styles.catTagText}>{training.category.label}</Text></View>
                  <Text style={[styles.providerText, { color: PROVIDER_COLOR[training.provider] ?? palette.textDim }]}>
                    {PROVIDER_LABEL[training.provider] ?? training.provider}
                  </Text>
                  {training.is_merged && (
                    <View style={styles.mergedRow}>
                      <Ionicons name="layers-outline" size={11} color={palette.textDim} />
                      <Text style={styles.skillText}>merged</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            <View style={styles.details}>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={12} color={palette.textDim} />
                <Text style={styles.detailText}>{formatTrainingDate(training.started_at)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="flash-outline" size={12} color={palette.accent} />
                <Text style={styles.detailText}>
                  {[
                    formatTrainingDistance(training.distance_m),
                    formatTrainingDuration(training.duration_s),
                    training.elevation_gain != null && training.elevation_gain > 0 ? `↑${Math.round(training.elevation_gain)} m` : null,
                  ].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </View>

            {details.length > 0 && (
              <Pressable style={styles.detailsToggle} onPress={() => toggleExpanded(training.id)}>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={palette.accent} />
                <Text style={styles.detailsToggleText}>{expanded ? 'Hide details' : `Show details (${details.length})`}</Text>
              </Pressable>
            )}

            {expanded && (
              <View style={styles.detailsExpanded}>
                {training.description ? <Text style={styles.descriptionText}>{training.description}</Text> : null}
                <View style={styles.detailsGrid}>
                  {details.map(d => (
                    <View key={d.label} style={styles.detailsGridItem}>
                      <Ionicons name={d.icon} size={13} color={palette.accent} />
                      <Text style={styles.detailsGridText}>{d.label}: <Text style={styles.detailsGridValue}>{d.value}</Text></Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )
      })}
    </View>
  )
}

// ─── People Tab ───────────────────────────────────────────────────────────────

function PeopleTab() {
  const [users,        setUsers]        = useState<UserItem[]>([])
  const [search,       setSearch]       = useState('')
  const [loading,      setLoading]      = useState(true)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [page,         setPage]         = useState(1)
  const [lastPage,     setLastPage]     = useState(1)
  const [acting,       setActing]       = useState<number | null>(null)
  const [zoomAvatar,   setZoomAvatar]   = useState<string | null>(null)
  const [sort,         setSort]         = useState<PeopleSort>('latest')
  const [direction,    setDirection]    = useState<'asc' | 'desc'>('desc')
  const [showSort,     setShowSort]     = useState(false)
  const [friendsOnly,  setFriendsOnly]  = useState(false)

  const load = useCallback((q: string, s: PeopleSort, d: 'asc' | 'desc', fo: boolean, pageNum = 1) => {
    if (pageNum === 1) setLoading(true)
    else setLoadingMore(true)

    const params: Record<string, string> = {
      sort: s,
      direction: d,
      page: String(pageNum),
      per_page: '30',
    }
    if (q) params.search = q
    if (fo) params.friends_only = '1'
    api.get('/users', { params })
      .then(({ data }) => {
        const incoming: UserItem[] = data.data ?? []
        setUsers(current => {
          if (pageNum === 1) return incoming
          const seen = new Set(current.map(user => user.id))
          return [...current, ...incoming.filter(user => !seen.has(user.id))]
        })
        setPage(data.meta?.current_page ?? pageNum)
        setLastPage(data.meta?.last_page ?? pageNum)
      })
      .finally(() => {
        setLoading(false)
        setLoadingMore(false)
      })
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(search, sort, direction, friendsOnly, 1), 400)
    return () => clearTimeout(t)
  }, [search, sort, direction, friendsOnly, load])

  function handleSortSelect(key: PeopleSort) {
    if (key === sort) {
      const newDir = direction === 'desc' ? 'asc' : 'desc'
      setDirection(newDir)
    } else {
      setSort(key)
      setDirection(PEOPLE_SORT_DEFAULT_DIR[key])
    }
    setShowSort(false)
  }

  async function handleAdd(userId: number) {
    setActing(userId)
    try {
      await api.post(`/friends/request/${userId}`)
      setUsers(u => u.map(x => x.id === userId ? { ...x, friendship_status: 'pending_sent' } : x))
    } catch {}
    finally { setActing(null) }
  }

  async function handleCancel(userId: number) {
    setActing(userId)
    try {
      await api.delete(`/friends/cancel/${userId}`)
      setUsers(u => u.map(x => x.id === userId ? { ...x, friendship_status: null } : x))
    } catch {}
    finally { setActing(null) }
  }

  async function handleRemove(userId: number) {
    Alert.alert('Remove friend', 'Remove this person from your friends list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setActing(userId)
          try {
            await api.delete(`/friends/${userId}`)
            setUsers(u => u.map(x => x.id === userId ? { ...x, friendship_status: null } : x))
          } catch {}
          finally { setActing(null) }
        },
      },
    ])
  }

  const activeSortLabel = PEOPLE_SORT_OPTIONS.find(o => o.key === sort)?.label ?? 'New'
  const hasMore = page < lastPage

  function loadNextPage() {
    if (loading || loadingMore || !hasMore) return
    load(search, sort, direction, friendsOnly, page + 1)
  }

  async function handleInvite() {
    api.post('/me/invite-tap').catch(() => {})
    Share.share({
      message: 'Join me on FitMeet — find sports events and active people near you! 💪 https://fitmeet.fit',
    })
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Pressable style={styles.inviteBtn} onPress={handleInvite}>
        <Ionicons name="person-add-outline" size={16} color={palette.accent} />
        <Text style={styles.inviteBtnText}>Invite friends to FitMeet</Text>
        <Ionicons name="share-outline" size={15} color={palette.accent} />
      </Pressable>

      <View style={styles.peopleControls}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={palette.textDim} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name…"
            placeholderTextColor={palette.textDim}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.peopleFilterRow}>
          <Pressable
            style={[styles.filterBtn, friendsOnly && styles.sortBtnActive]}
            onPress={() => setFriendsOnly(v => !v)}
          >
            <Ionicons name="people-outline" size={15} color={friendsOnly ? '#031109' : palette.accent} />
            <Text style={[styles.filterBtnLabel, friendsOnly && styles.filterBtnLabelActive]}>Friends</Text>
          </Pressable>
          <Pressable
            style={[styles.filterBtn, styles.sortBtn, showSort && styles.sortBtnActive]}
            onPress={() => setShowSort(v => !v)}
          >
            <Ionicons name="swap-vertical-outline" size={15} color={showSort ? '#031109' : palette.text} />
            <Text style={[styles.filterBtnLabel, showSort && styles.filterBtnLabelActive]}>{activeSortLabel}</Text>
            <Ionicons
              name={direction === 'desc' ? 'arrow-down-outline' : 'arrow-up-outline'}
              size={13}
              color={showSort ? '#031109' : palette.accent}
            />
          </Pressable>
        </View>
      </View>

      {showSort && (
        <View style={styles.sortList}>
          {PEOPLE_SORT_OPTIONS.map(opt => {
            const active = opt.key === sort
            return (
              <Pressable
                key={opt.key}
                style={[styles.sortOption, active && styles.sortOptionActive]}
                onPress={() => handleSortSelect(opt.key)}
              >
                <Text style={[styles.sortOptionText, active && styles.sortOptionTextActive]}>{opt.label}</Text>
                {active && (
                  <Ionicons
                    name={direction === 'desc' ? 'arrow-down-outline' : 'arrow-up-outline'}
                    size={13}
                    color="#031109"
                  />
                )}
              </Pressable>
            )
          })}
        </View>
      )}

      {loading && <ActivityIndicator color={palette.accent} style={{ paddingVertical: spacing.xl }} />}
      {!loading && users.length === 0 && (
        <Text style={styles.emptyText}>No people found.</Text>
      )}

      {/* Avatar zoom modal */}
      <Modal visible={!!zoomAvatar} transparent animationType="fade" onRequestClose={() => setZoomAvatar(null)}>
        <Pressable style={styles.avatarZoomOverlay} onPress={() => setZoomAvatar(null)}>
          {zoomAvatar && (
            <Image source={{ uri: zoomAvatar }} style={styles.avatarZoomImg} resizeMode="cover" />
          )}
        </Pressable>
      </Modal>

      {!loading && users.map((u, index) => (
        <Pressable key={u.id} style={styles.userCard} onPress={() => router.push(`/user/${u.id}` as never)}>
          <Pressable
            style={styles.userAvatar}
            onPress={() => u.avatar ? setZoomAvatar(u.avatar) : null}
            disabled={!u.avatar}
          >
            {u.avatar
              ? <Image source={{ uri: u.avatar }} style={styles.userAvatarImg} />
              : <Text style={styles.userAvatarText}>{u.name.charAt(0).toUpperCase()}</Text>
            }
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.userNameRow}>
              <Text style={styles.userName} numberOfLines={1}>{u.name}</Text>
              {countryFlag(u.home.country) && (
                <Text style={styles.countryFlag}>{countryFlag(u.home.country)}</Text>
              )}
              {(u.beer_score ?? 0) > 0 && (
                <View style={styles.beerBadge}>
                  <Ionicons name="beer-outline" size={9} color="#f6c65b" />
                  <Text style={styles.beerBadgeCount}>×{u.beer_score}</Text>
                </View>
              )}
              {index === 0 && (
                <View style={styles.newUserBadge}>
                  <Text style={styles.newUserBadgeText}>Just landed</Text>
                </View>
              )}
            </View>
            {(u.home.city || u.home.country) && (
              <Text style={styles.userLocation}>
                {[u.home.city, u.home.country].filter(Boolean).join(', ')}
              </Text>
            )}
            {u.events_count > 0 && (
              <Text style={styles.userEvents}>
                <Text style={{ color: palette.accent }}>{u.events_count}</Text> events
              </Text>
            )}
            {u.categories.length > 0 && (
              <Text style={styles.userCategories} numberOfLines={1}>
                {u.categories.slice(0, 4).map(c => CATEGORY_EMOJI[c] ?? '').join(' ')}
              </Text>
            )}
          </View>

          {u.friendship_status === 'friends' ? (
            <Pressable
              style={[styles.friendBtn, styles.friendBtnActive]}
              disabled={acting === u.id}
              onPress={() => handleRemove(u.id)}
            >
              <Text style={styles.friendBtnActiveText}>{acting === u.id ? '…' : '✓ Friends'}</Text>
            </Pressable>
          ) : u.friendship_status === 'pending_sent' ? (
            <Pressable
              style={styles.friendBtn}
              disabled={acting === u.id}
              onPress={() => handleCancel(u.id)}
            >
              <Text style={styles.friendBtnText}>{acting === u.id ? '…' : 'Sent'}</Text>
            </Pressable>
          ) : u.friendship_status === 'pending_received' ? (
            <View style={styles.friendBtn}>
              <Text style={styles.friendBtnText}>Received</Text>
            </View>
          ) : (
            <Pressable
              style={styles.friendBtn}
              disabled={acting === u.id}
              onPress={() => handleAdd(u.id)}
            >
              <Text style={styles.friendBtnText}>{acting === u.id ? '…' : '+ Add'}</Text>
            </Pressable>
          )}
        </Pressable>
      ))}

      {!loading && users.length > 0 && hasMore && (
        <Pressable style={styles.loadMoreBtn} onPress={loadNextPage} disabled={loadingMore}>
          {loadingMore ? (
            <ActivityIndicator color={palette.accent} />
          ) : (
            <Text style={styles.loadMoreText}>Load more</Text>
          )}
        </Pressable>
      )}
    </View>
  )
}

// ─── Market Tab ───────────────────────────────────────────────────────────────

interface MarketItem {
  id: number
  type: 'sell' | 'buy'
  title: string
  price: number
  currency: string
  condition: 'new' | 'used' | 'like_new' | null
  category: { value: string; label: string }
  status: string
  location: { city: string | null; country: string | null }
  images: string[]
  seller: { id: number; name: string }
  is_mine: boolean
  views_count?: number
  saves_count?: number
  is_saved?: boolean
}

const CAT_EMOJI = Object.fromEntries(CATEGORIES.map(c => [c.value, c.emoji]))
const CONDITION_LABEL_MAP: Record<string, string> = { new: 'New', used: 'Used', like_new: 'Like new' }
type MarketType = '' | 'sell' | 'buy'
type MarketCond = '' | 'new' | 'used' | 'like_new'

function MarketTab() {
  const [items, setItems] = useState<MarketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<MarketType>('')
  const [category, setCategory] = useState('')
  const [condition, setCondition] = useState<MarketCond>('')
  const [search, setSearch] = useState('')
  const [showCats, setShowCats] = useState(false)
  const [savedOnly, setSavedOnly] = useState(false)
  const [myOnly, setMyOnly] = useState(false)
  const [soldOnly, setSoldOnly] = useState(false)
  const searchRef = useRef('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (savedOnly) {
        const { data } = await api.get('/market/saved')
        setItems(data.data ?? [])
      } else {
        const params: Record<string, string> = {}
        if (typeFilter) params.type = typeFilter
        if (category) params.category = category
        if (condition) params.condition = condition
        if (searchRef.current.trim()) params.search = searchRef.current.trim()
        if (myOnly) params.my = '1'
        if (soldOnly) params.status = 'sold'
        const { data } = await api.get('/market', { params })
        setItems(data.data ?? [])
      }
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [typeFilter, category, condition, savedOnly, myOnly, soldOnly])

  useFocusEffect(useCallback(() => { load() }, [load]))

  useEffect(() => {
    searchRef.current = search
    const t = setTimeout(() => load(), search ? 350 : 0)
    return () => clearTimeout(t)
  }, [search, load])

  async function handleToggleSave(e: { stopPropagation: () => void }, item: MarketItem) {
    e.stopPropagation()
    try {
      const { data } = await api.post(`/market/${item.id}/save`)
      setItems(prev => prev.map(i =>
        i.id === item.id
          ? { ...i, is_saved: data.is_saved, saves_count: (i.saves_count ?? 0) + (data.is_saved ? 1 : -1) }
          : i
      ))
    } catch {}
  }

  const activeCat = CATEGORIES.find(c => c.value === category)

  const marketFilterCount =
    (typeFilter ? 1 : 0) + (category ? 1 : 0) + (condition ? 1 : 0) + (savedOnly ? 1 : 0) + (myOnly ? 1 : 0) + (soldOnly ? 1 : 0)

  return (
    <View style={{ gap: spacing.md }}>

      {/* Toolbar: Filter + Post */}
      <View style={styles.filterToolbar}>
        <Pressable
          style={[styles.filterBtn, marketFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setShowCats(v => !v)}
        >
          <Ionicons name="options-outline" size={15} color={marketFilterCount > 0 ? '#031109' : palette.text} />
          <Text style={[styles.filterBtnLabel, marketFilterCount > 0 && styles.filterBtnLabelActive]}>Filter</Text>
          {marketFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{marketFilterCount}</Text>
            </View>
          )}
        </Pressable>
        <Pressable style={styles.createBtn} onPress={() => router.push('/market/create' as never)}>
          <Ionicons name="add" size={22} color="#041109" />
        </Pressable>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={palette.textDim} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search title or description…"
          placeholderTextColor={palette.textDim}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={palette.textDim} />
          </Pressable>
        )}
      </View>

      {/* Filter dropdown */}
      {showCats && (
        <View style={styles.filterDropdown}>

          <Text style={styles.filterSectionLabel}>Type</Text>
          <View style={styles.filterRow}>
            {([['', 'All'], ['sell', 'Selling'], ['buy', 'Buying']] as [MarketType, string][]).map(([v, label]) => (
              <Pressable
                key={v}
                style={[styles.filterChip, !savedOnly && typeFilter === v && styles.filterChipActive]}
                onPress={() => { setTypeFilter(v); setSavedOnly(false) }}
              >
                <Text style={[styles.filterLabel, !savedOnly && typeFilter === v && styles.filterLabelActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.filterSectionLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterRow, { flexWrap: 'nowrap' }]}>
            <Pressable
              style={[styles.filterChip, !category && styles.filterChipActive]}
              onPress={() => setCategory('')}
            >
              <Text style={[styles.filterLabel, !category && styles.filterLabelActive]}>All</Text>
            </Pressable>
            {CATEGORIES.map(cat => (
              <Pressable
                key={cat.value}
                style={[styles.filterChip, category === cat.value && styles.filterChipActive]}
                onPress={() => setCategory(category === cat.value ? '' : cat.value)}
              >
                <Text style={[styles.filterLabel, category === cat.value && styles.filterLabelActive]}>
                  {cat.emoji} {cat.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {typeFilter !== 'buy' && (
            <>
              <Text style={styles.filterSectionLabel}>Condition</Text>
              <View style={styles.filterRow}>
                {([['', 'Any'], ['new', 'New'], ['like_new', 'Like new'], ['used', 'Used']] as [MarketCond, string][]).map(([v, label]) => (
                  <Pressable
                    key={v}
                    style={[styles.filterChip, condition === v && styles.filterChipActive]}
                    onPress={() => setCondition(v)}
                  >
                    <Text style={[styles.filterLabel, condition === v && styles.filterLabelActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <Text style={styles.filterSectionLabel}>My Ads / Saved</Text>
          <View style={styles.filterRow}>
            <Pressable
              style={[styles.filterChip, myOnly && styles.filterChipActive]}
              onPress={() => { setMyOnly(v => !v); setSavedOnly(false) }}
            >
              <Ionicons name={myOnly ? 'person' : 'person-outline'} size={13} color={myOnly ? '#031109' : palette.text} />
              <Text style={[styles.filterLabel, myOnly && styles.filterLabelActive]}>My Ads</Text>
            </Pressable>
            <Pressable
              style={[styles.filterChip, savedOnly && { backgroundColor: 'rgba(248,113,113,0.12)', borderColor: 'rgba(248,113,113,0.4)' }]}
              onPress={() => { setSavedOnly(v => !v); setMyOnly(false) }}
            >
              <Ionicons name={savedOnly ? 'heart' : 'heart-outline'} size={13} color={savedOnly ? '#f87171' : palette.text} />
              <Text style={[styles.filterLabel, savedOnly && { color: '#f87171' }]}>Saved only</Text>
            </Pressable>
          </View>

          <Text style={styles.filterSectionLabel}>Status</Text>
          <View style={styles.filterRow}>
            <Pressable
              style={[styles.filterChip, soldOnly && { backgroundColor: 'rgba(248,113,113,0.12)', borderColor: 'rgba(248,113,113,0.4)' }]}
              onPress={() => setSoldOnly(v => !v)}
            >
              <Ionicons name={soldOnly ? 'checkmark-circle' : 'checkmark-circle-outline'} size={13} color={soldOnly ? '#f87171' : palette.text} />
              <Text style={[styles.filterLabel, soldOnly && { color: '#f87171' }]}>Sold</Text>
            </Pressable>
          </View>

        </View>
      )}

      {/* Content */}
      {loading ? (
        <ActivityIndicator color={palette.accent} style={{ marginTop: 24 }} />
      ) : items.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
          <Text style={{ fontSize: 40 }}>🏪</Text>
          <Text style={{ color: palette.text, fontWeight: '800', fontSize: 15 }}>No listings yet</Text>
          <Text style={{ color: palette.textMuted, fontSize: 13, textAlign: 'center' }}>
            {typeFilter === 'buy' ? 'No requests posted yet.' : 'Be the first to list your gear.'}
          </Text>
          <Pressable
            style={[styles.createRouteBtn, { marginTop: 8, paddingHorizontal: 20 }]}
            onPress={() => router.push('/market/create' as never)}
          >
            <Ionicons name="add" size={16} color={palette.accent} />
            <Text style={styles.createRouteBtnText}>{typeFilter === 'buy' ? 'Post request' : 'List something'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {items.map(item => (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/market/${item.id}` as never)}
              style={[styles.eventCard, item.type === 'buy' && { borderColor: 'rgba(96,165,250,0.35)' }]}
            >
              {item.type === 'buy' ? (
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ backgroundColor: 'rgba(96,165,250,0.15)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ color: '#60a5fa', fontSize: 10, fontWeight: '900' }}>WANTED</Text>
                    </View>
                    <Text style={{ color: palette.textMuted, fontSize: 12 }}>{item.category.label}</Text>
                  </View>
                  <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
                  {item.price > 0 && (
                    <Text style={{ color: '#60a5fa', fontSize: 14, fontWeight: '800' }}>
                      up to {item.price.toFixed(0)} {item.currency}
                    </Text>
                  )}
                  {(item.location.city || item.location.country) && (
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={12} color={palette.textDim} />
                      <Text style={styles.detailText}>
                        {[item.location.city, item.location.country].filter(Boolean).join(', ')}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {item.images[0] ? (
                    <View>
                      <Image source={{ uri: item.images[0] }} style={styles.eventImage} resizeMode="cover" />
                      {item.status === 'sold' && (
                        <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderRadius: 14 }}>
                          <Text style={{ color: '#f87171', fontWeight: '900', fontSize: 16, borderWidth: 1.5, borderColor: '#f87171', paddingHorizontal: 12, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(248,113,113,0.1)' }}>SOLD</Text>
                        </View>
                      )}
                      {item.condition && (
                        <View style={{ position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(5,8,22,0.82)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                          <Text style={{ color: item.condition === 'new' ? '#4ade80' : item.condition === 'like_new' ? palette.accent : palette.textMuted, fontSize: 10, fontWeight: '900' }}>
                            {CONDITION_LABEL_MAP[item.condition]}
                          </Text>
                        </View>
                      )}
                      {!item.is_mine && (
                        <Pressable
                          onPress={e => handleToggleSave(e, item)}
                          style={{ position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(5,8,22,0.7)', alignItems: 'center', justifyContent: 'center' }}
                          hitSlop={6}
                        >
                          <Ionicons
                            name={item.is_saved ? 'heart' : 'heart-outline'}
                            size={15}
                            color={item.is_saved ? '#f87171' : '#fff'}
                          />
                        </Pressable>
                      )}
                    </View>
                  ) : (
                    <View style={{ height: 100, borderRadius: 14, backgroundColor: palette.panelRaised, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 36 }}>{CAT_EMOJI[item.category.value] ?? '🏷️'}</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <Text style={[styles.eventTitle, { flex: 1, minHeight: 44, lineHeight: 22 }]} numberOfLines={2}>{item.title}</Text>
                    <Text style={{ color: palette.accent, fontSize: 16, fontWeight: '900' }}>
                      {item.price.toFixed(0)} <Text style={{ fontSize: 12, fontWeight: '700' }}>{item.currency}</Text>
                    </Text>
                  </View>
                  <View style={styles.tagRow}>
                    <View style={styles.catTag}>
                      <Text style={styles.catTagText}>{CAT_EMOJI[item.category.value]} {item.category.label}</Text>
                    </View>
                    {(item.location.city || item.location.country) && (
                      <View style={styles.detailRow}>
                        <Ionicons name="location-outline" size={12} color={palette.textDim} />
                        <Text style={styles.detailText} numberOfLines={1}>
                          {[item.location.city, item.location.country].filter(Boolean).join(', ')}
                        </Text>
                      </View>
                    )}
                    {(item.views_count ?? 0) > 0 && (
                      <View style={styles.detailRow}>
                        <Ionicons name="eye-outline" size={11} color={palette.textDim} />
                        <Text style={styles.detailText}>{item.views_count}</Text>
                      </View>
                    )}
                    {!item.is_mine && (
                      <View style={styles.detailRow}>
                        <Ionicons
                          name={item.is_saved ? 'heart' : 'heart-outline'}
                          size={11}
                          color={item.is_saved ? '#f87171' : palette.textDim}
                        />
                        {(item.saves_count ?? 0) > 0 && (
                          <Text style={[styles.detailText, item.is_saved && { color: '#f87171' }]}>
                            {item.saves_count}
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const TAB_LABELS: Record<'events' | 'routes' | 'trainings' | 'people' | 'market', string> = {
  events:    'Events',
  routes:    'Routes',
  trainings: 'Log',
  people:    'People',
  market:    'Market',
}

const TAB_ICONS: Record<'events' | 'routes' | 'trainings' | 'people' | 'market', keyof typeof Ionicons.glyphMap> = {
  events:    'calendar-outline',
  routes:    'map-outline',
  trainings: 'barbell-outline',
  people:    'people-outline',
  market:    'storefront-outline',
}

export default function MeetScreen() {
  const tabBarHeight = useBottomTabBarHeight()
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>()
  const [tab, setTab] = useState<'events' | 'people' | 'routes' | 'trainings' | 'market'>('events')
  const [showCalendar, setShowCalendar] = useState(false)

  useEffect(() => {
    if (initialTab === 'trainings') setTab('trainings')
  }, [initialTab])

  function handleHeaderPlus() {
    if (tab === 'events')    return router.push('/event/create' as never)
    if (tab === 'routes')    return router.push('/route/draw' as never)
    if (tab === 'trainings') return router.push('/connected-apps' as never)
    if (tab === 'market')    return router.push('/market/create' as never)
    // people → invite
    api.post('/me/invite-tap').catch(() => {})
    Share.share({
      message: 'Join me on FitMeet — find sports events and active people near you! 💪 https://fitmeet.fit',
    })
  }

  const plusIcon: Record<typeof tab, string> = {
    events:    'add',
    routes:    'pencil-outline',
    trainings: 'link-outline',
    people:    'person-add-outline',
    market:    'add',
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 8 }]} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Meet</Text>
            <Text style={styles.title}>
              {tab === 'events' ? 'New events'
                : tab === 'routes' ? 'Routes'
                : tab === 'trainings' ? 'Trainings'
                : tab === 'people' ? 'People'
                : 'Marketplace'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={styles.calendarBtn} onPress={() => setShowCalendar(true)}>
              <Ionicons name="calendar-outline" size={18} color={palette.accent} />
            </Pressable>
            <Pressable style={styles.calendarBtn} onPress={() => router.push('/moments' as never)}>
              <Ionicons name="images-outline" size={18} color={palette.accent} />
            </Pressable>
            <Pressable style={styles.createBtn} onPress={handleHeaderPlus}>
              <Ionicons name={plusIcon[tab] as keyof typeof Ionicons.glyphMap} size={tab === 'people' ? 18 : 22} color="#041109" />
            </Pressable>
          </View>
        </View>

        <CalendarModal visible={showCalendar} onClose={() => setShowCalendar(false)} />

        {/* Tab switcher */}
        <View style={styles.tabBar}>
          {(['events', 'routes', 'trainings', 'people', 'market'] as const).map(t => (
            <Pressable
              key={t}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
              onPress={() => setTab(t)}
            >
              <Ionicons name={TAB_ICONS[t]} size={16} color={tab === t ? '#031109' : palette.textMuted} />
              <Text style={[styles.tabLabel, styles.tabLabelSmall, tab === t && styles.tabLabelActive]} numberOfLines={1}>
                {TAB_LABELS[t]}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'events' ? <EventsTab />
          : tab === 'routes' ? <RoutesTab />
          : tab === 'trainings' ? <TrainingsTab />
          : tab === 'people' ? <PeopleTab />
          : <MarketTab />}

      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  content:  { padding: spacing.lg, gap: spacing.md },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: palette.accent, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  title:  { color: palette.text, fontSize: 20, fontWeight: '800' },
  createBtn: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  calendarBtn: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: 'rgba(108,255,47,0.1)',
    borderWidth: 1, borderColor: 'rgba(108,255,47,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },

  tabBar: {
    flexDirection: 'row', gap: 4, padding: 4,
    backgroundColor: palette.panel, borderRadius: 16,
    borderWidth: 1, borderColor: palette.line,
  },
  tabBtn:       { flex: 1, minWidth: 0, paddingVertical: 8, borderRadius: 12, alignItems: 'center', gap: 3 },
  tabBtnActive: { backgroundColor: palette.accent },
  tabLabel:     { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  tabLabelSmall: { fontSize: 10 },
  tabLabelActive: { color: '#031109' },

  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8,
  },
  createRouteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(108,255,47,0.28)',
    backgroundColor: 'rgba(108,255,47,0.07)',
  },
  createRouteBtnText: { color: palette.accent, fontSize: 14, fontWeight: '800' },
  filterToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  filterBtnActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  sortBtn: { marginLeft: 'auto' },
  sortBtnActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  filterBtnLabel: { color: palette.text, fontSize: 13, fontWeight: '700' },
  filterBtnLabelActive: { color: '#031109' },
  filterBadge: {
    backgroundColor: '#031109', borderRadius: 999,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  filterBadgeText: { color: palette.accent, fontSize: 11, fontWeight: '800' },
  filterDropdown: {
    backgroundColor: palette.panelRaised, borderRadius: 18,
    borderWidth: 1, borderColor: palette.line, padding: 14, gap: 8,
  },
  filterDropdownThin: {
    backgroundColor: palette.panelRaised, borderRadius: 16,
    borderWidth: 1, borderColor: palette.line, padding: 10, gap: 4,
  },
  filterSectionLabel: {
    color: palette.textMuted, fontSize: 11, fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4,
  },
  filterRow: { gap: 8, flexDirection: 'row', flexWrap: 'wrap' },
  filterChip: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line,
  },
  filterChipActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  radiusChipActive: { borderColor: 'rgba(0,168,255,0.6)', backgroundColor: 'rgba(0,168,255,0.08)' },
  filterLabel: { color: palette.text, fontSize: 12, fontWeight: '700' },
  filterLabelActive: { color: '#031109' },
  radiusLabelActive: { color: '#58beff' },
  sortList: { gap: 8 },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
  },
  sortOptionActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  sortOptionText: { color: palette.text, fontSize: 13, fontWeight: '800', flex: 1 },
  sortOptionTextActive: { color: '#031109' },

  emptyText: { color: palette.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: spacing.xl },
  loadMoreBtn: { alignItems: 'center', paddingVertical: 16, marginTop: 4 },
  loadMoreText: { color: palette.accent, fontSize: 14, fontWeight: '700' },

  // Event card
  eventCard: {
    backgroundColor: palette.panel, borderRadius: 22,
    borderWidth: 1, borderColor: palette.line, padding: spacing.md, gap: 10,
    overflow: 'hidden',
  },
  eventImage: { width: '100%', height: 160, borderRadius: 14, marginBottom: 4 },
  eventCardCancelled: { borderColor: 'rgba(248,113,113,0.35)' },
  eventCardMuted:     { opacity: 0.65 },
  eventTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eventBadge: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: palette.panelRaised, alignItems: 'center', justifyContent: 'center',
  },
  eventTitle: { color: palette.text, fontSize: 15, fontWeight: '800' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' },
  catTag: {
    backgroundColor: 'rgba(108,255,47,0.1)', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(108,255,47,0.3)',
  },
  catTagText:  { color: palette.accent, fontSize: 11, fontWeight: '700' },
  skillText:   { color: palette.textDim, fontSize: 11 },
  cancelText:  { color: '#f87171', fontSize: 11, fontWeight: '700' },
  fullText:    { color: '#f87171', fontSize: 11, fontWeight: '700' },
  pastText:    { color: '#58beff', fontSize: 11, fontWeight: '700' },

  details: { gap: 5 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  detailText: { color: palette.textDim, fontSize: 12 },

  // Trainings
  providerText: { fontSize: 11, fontWeight: '800' },
  mergedRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  totalsCard: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 16,
    backgroundColor: 'rgba(108,255,47,0.07)', borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(108,255,47,0.28)', padding: spacing.md,
  },
  totalStat: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  totalStatValue: { color: palette.text, fontSize: 14, fontWeight: '800' },
  totalStatLabel: { color: palette.textDim, fontSize: 11, marginTop: 1 },
  detailsToggle: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  detailsToggleText: { color: palette.accent, fontSize: 12, fontWeight: '700' },
  detailsExpanded: {
    gap: 8, marginTop: 4, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: palette.line,
  },
  descriptionText: { color: palette.textMuted, fontSize: 12, lineHeight: 17 },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailsGridItem: { flexDirection: 'row', alignItems: 'center', gap: 5, width: '46%' },
  detailsGridText: { color: palette.textDim, fontSize: 11, flexShrink: 1 },
  detailsGridValue: { color: palette.text, fontWeight: '700' },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: palette.panel, borderRadius: 16,
    borderWidth: 1, borderColor: palette.line,
    paddingHorizontal: spacing.md, height: 48,
  },
  searchInput: { flex: 1, color: palette.text, fontSize: 15 },

  // User card
  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: palette.panel, borderRadius: 20,
    borderWidth: 1, borderColor: palette.line, padding: spacing.md,
  },
  userAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  userAvatarImg:  { width: 44, height: 44, borderRadius: 22 },
  userAvatarText: { color: '#031109', fontSize: 18, fontWeight: '800' },
  avatarZoomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  avatarZoomImg:     { width: 280, height: 280, borderRadius: 140 },
  userNameRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  userName:       { color: palette.text, fontSize: 15, fontWeight: '700' },
  countryFlag:    { fontSize: 14, lineHeight: 18 },
  newUserBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(108,255,47,0.36)',
    backgroundColor: 'rgba(108,255,47,0.09)',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  newUserBadgeText: { color: palette.accent, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' },
  beerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 1,
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6,
    backgroundColor: 'rgba(246,198,91,0.1)',
    borderWidth: 1, borderColor: 'rgba(246,198,91,0.25)',
  },
  beerBadgeCount: { color: '#f6c65b', fontSize: 9, fontWeight: '800', marginLeft: 2 },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(108,255,47,0.25)',
    backgroundColor: 'rgba(108,255,47,0.06)',
  },
  inviteBtnText: { color: palette.accent, fontSize: 14, fontWeight: '700', flex: 1, textAlign: 'center' },
  peopleControls: { gap: 8 },
  peopleFilterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userLocation:   { color: palette.textMuted, fontSize: 12 },
  userEvents:     { color: palette.textMuted, fontSize: 12 },
  userCategories: { fontSize: 14, marginTop: 2 },

  friendBtn: {
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panelRaised,
  },
  friendBtnActive:     { borderColor: palette.accent, backgroundColor: 'rgba(108,255,47,0.1)' },
  friendBtnText:       { color: palette.textMuted, fontSize: 12, fontWeight: '700' },
  friendBtnActiveText: { color: palette.accent, fontSize: 12, fontWeight: '700' },

  marketSavedActive: { borderColor: 'rgba(248,113,113,0.4)', backgroundColor: 'rgba(248,113,113,0.08)' },
})
