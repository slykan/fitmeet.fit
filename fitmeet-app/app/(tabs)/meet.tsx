import { Ionicons } from '@expo/vector-icons'
import { EmptyEvents } from '@/src/components/EmptyEvents'
import { EventCommentsPreview } from '@/src/components/EventCommentsPreview'
import { InProgressBadge } from '@/src/components/InProgressBadge'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventItem {
  id: number
  title: string
  category: { value: string; label: string }
  location: { lat: number | null; lng: number | null; address: string | null }
  schedule: { start_at: string; timezone: string; duration_minutes: number | null }
  activity: { distance_km: number | null; elevation_gain: number | null }
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

type SortKey = 'soonest' | 'views' | 'joined'
type SortDirection = 'asc' | 'desc'

const SORT_OPTIONS: Array<{ key: SortKey; label: string; icon: string }> = [
  { key: 'soonest', label: 'Event date',  icon: 'calendar-outline' },
  { key: 'views',  label: 'Most viewed', icon: 'eye-outline' },
  { key: 'joined', label: 'Most joined', icon: 'people-outline' },
]

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

// ─── Events Tab ───────────────────────────────────────────────────────────────

function EventsTab() {
  const user = useAuthStore((s) => s.user)
  const [events,     setEvents]     = useState<EventItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [page,       setPage]       = useState(1)
  const [lastPage,   setLastPage]   = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [category,   setCategory]   = useState('')
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
  const discoveryLat = user?.home?.lat ?? user?.location?.lat ?? null
  const discoveryLng = user?.home?.lng ?? user?.location?.lng ?? null

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
        if (category) params.category = category
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
  }, [category, radiusKm, goingOnly, friendsOnly, myOnly, pastOnly, sortKey, sortDirection, discoveryLat, discoveryLng])

  useFocusEffect(useCallback(() => { load() }, [load]))
  useEffect(() => {
    api.get('/events/my-reminders').then(({ data }) => {
      const ids = new Set<number>(Object.keys(data.data ?? {}).map(Number).filter(Boolean))
      setReminderIds(ids)
    }).catch(() => {})
  }, [])

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
    (category ? 1 : 0) + (radiusKm !== null ? 1 : 0) +
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
            <Pressable style={[styles.filterChip, !category && styles.filterChipActive]} onPress={() => setCategory('')}>
              <Text style={[styles.filterLabel, !category && styles.filterLabelActive]}>All</Text>
            </Pressable>
            {CATEGORIES.map(cat => (
              <Pressable
                key={cat.value}
                style={[styles.filterChip, category === cat.value && styles.filterChipActive]}
                onPress={() => setCategory(v => v === cat.value ? '' : cat.value)}
              >
                <Text style={[styles.filterLabel, category === cat.value && styles.filterLabelActive]}>
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
              {(ev.activity.distance_km || ev.activity.elevation_gain) ? (
                <View style={styles.detailRow}>
                  <Ionicons name="flash-outline" size={12} color={palette.accent} />
                  <Text style={styles.detailText}>
                    {[
                      ev.activity.distance_km    && `${ev.activity.distance_km} km`,
                      ev.activity.elevation_gain && `↑${ev.activity.elevation_gain} m`,
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

// ─── People Tab ───────────────────────────────────────────────────────────────

function PeopleTab() {
  const [users,        setUsers]        = useState<UserItem[]>([])
  const [search,       setSearch]       = useState('')
  const [loading,      setLoading]      = useState(true)
  const [acting,       setActing]       = useState<number | null>(null)
  const [zoomAvatar,   setZoomAvatar]   = useState<string | null>(null)
  const [sort,         setSort]         = useState<PeopleSort>('latest')
  const [direction,    setDirection]    = useState<'asc' | 'desc'>('desc')
  const [showSort,     setShowSort]     = useState(false)

  const load = useCallback((q: string, s: PeopleSort, d: 'asc' | 'desc') => {
    setLoading(true)
    const params: Record<string, string> = { sort: s, direction: d }
    if (q) params.search = q
    api.get('/users', { params })
      .then(({ data }) => setUsers(data.data ?? []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load('', sort, direction) }, [load])
  useEffect(() => {
    const t = setTimeout(() => load(search, sort, direction), 400)
    return () => clearTimeout(t)
  }, [search, sort, direction, load])

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

      <View style={styles.peopleSearchRow}>
        <View style={[styles.searchBar, { flex: 1 }]}>
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
        <View key={u.id} style={styles.userCard}>
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
        </View>
      ))}
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MeetScreen() {
  const tabBarHeight = useBottomTabBarHeight()
  const [tab, setTab] = useState<'events' | 'people'>('events')
  const [showCalendar, setShowCalendar] = useState(false)

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 8 }]} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Meet</Text>
            <Text style={styles.title}>New events</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable style={styles.calendarBtn} onPress={() => setShowCalendar(true)}>
              <Ionicons name="calendar-outline" size={18} color={palette.accent} />
            </Pressable>
            <Pressable style={styles.createBtn} onPress={() => router.push('/event/create' as never)}>
              <Ionicons name="add" size={22} color="#041109" />
            </Pressable>
          </View>
        </View>

        <CalendarModal visible={showCalendar} onClose={() => setShowCalendar(false)} />

        {/* Tab switcher */}
        <View style={styles.tabBar}>
          {(['events', 'people'] as const).map(t => (
            <Pressable
              key={t}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                {t === 'events' ? '📅 Events' : '👥 People'}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'events' ? <EventsTab /> : <PeopleTab />}

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
  tabBtn:       { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabBtnActive: { backgroundColor: palette.accent },
  tabLabel:     { color: palette.textMuted, fontSize: 14, fontWeight: '700' },
  tabLabelActive: { color: '#031109' },

  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8,
  },
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
  peopleSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
})
