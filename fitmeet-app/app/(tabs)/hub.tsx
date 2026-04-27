import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState, useCallback } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { api } from '@/src/lib/api'
import { CATEGORIES } from '@/src/lib/categories'
import { WeatherBadge } from '@/src/components/WeatherBadge'
import { palette, spacing } from '@/src/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

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
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RADIUS_OPTIONS = [
  { label: 'Nearby', km: 50 },
  { label: 'City',   km: 200 },
  { label: 'Region', km: 500 },
  { label: 'All',    km: null },
] as const

const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.emoji])
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

function isPast(iso: string) {
  return new Date(iso).getTime() <= Date.now()
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HubScreen() {
  const [events,     setEvents]     = useState<EventItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [radiusIdx,  setRadiusIdx]  = useState(0)
  const [categories, setCategories] = useState<Set<string>>(new Set())
  const [goingOnly,  setGoingOnly]  = useState(false)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = {}
      const radius = RADIUS_OPTIONS[radiusIdx]?.km
      if (radius) params.radius_km = radius

      const source = goingOnly ? '/events/joined' : '/events'
      const { data } = await api.get(source, { params })
      const all: EventItem[] = data.data ?? []

      setEvents(
        categories.size > 0
          ? all.filter(ev => categories.has(ev.category.value))
          : all
      )
    } catch {}
    finally { setLoading(false) }
  }, [radiusIdx, goingOnly, categories])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  function toggleCategory(value: string) {
    setCategories(prev => {
      const next = new Set(prev)
      next.has(value) ? next.delete(value) : next.add(value)
      return next
    })
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
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

        {/* Radar placeholder */}
        <View style={styles.radarCard}>
          <View style={styles.radarCircle} />
          <View style={styles.radarCircleMid} />
          <View style={styles.radarDot} />
          <View style={styles.radarOverlay}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {/* All */}
              <Pressable
                style={[styles.filterChip, categories.size === 0 && styles.filterChipActive]}
                onPress={() => setCategories(new Set())}
              >
                <Text style={[styles.filterLabel, categories.size === 0 && styles.filterLabelActive]}>
                  All interests
                </Text>
              </Pressable>
              {CATEGORIES.slice(0, 8).map(cat => {
                const active = categories.has(cat.value)
                return (
                  <Pressable
                    key={cat.value}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => toggleCategory(cat.value)}
                  >
                    <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                      {cat.emoji} {cat.label}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            {/* Radius + Going filters */}
            <View style={styles.bottomFilters}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.radiusRow}>
                {RADIUS_OPTIONS.map((r, i) => (
                  <Pressable
                    key={r.label}
                    style={[styles.radiusChip, radiusIdx === i && styles.radiusChipActive]}
                    onPress={() => setRadiusIdx(i)}
                  >
                    <Text style={[styles.radiusLabel, radiusIdx === i && styles.radiusLabelActive]}>
                      {r.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable
                style={[styles.goingChip, goingOnly && styles.goingChipActive]}
                onPress={() => setGoingOnly(v => !v)}
              >
                <Ionicons
                  name={goingOnly ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={14}
                  color={goingOnly ? '#031109' : palette.textMuted}
                />
                <Text style={[styles.goingLabel, goingOnly && styles.goingLabelActive]}>Going</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Section header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {goingOnly ? 'Events you joined' : 'Events near you'}
          </Text>
          {!loading && (
            <Text style={styles.sectionCount}>{events.length}</Text>
          )}
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={palette.accent} />
          </View>
        )}

        {/* Empty */}
        {!loading && events.length === 0 && (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No events found.</Text>
          </View>
        )}

        {/* Event cards */}
        {!loading && events.map(ev => {
          const past     = isPast(ev.schedule.start_at)
          const cancelled = ev.status === 'cancelled'
          const emoji    = CATEGORY_EMOJI[ev.category.value] ?? '📍'

          return (
            <View
              key={ev.id}
              style={[
                styles.eventCard,
                cancelled && styles.eventCardCancelled,
                past && styles.eventCardPast,
              ]}
            >
              <View style={styles.eventTop}>
                <View style={[styles.eventBadge, cancelled && styles.eventBadgeCancelled]}>
                  <Text style={styles.eventEmoji}>{emoji}</Text>
                </View>
                <View style={styles.eventMeta}>
                  <Text style={styles.eventTitle} numberOfLines={1}>{ev.title}</Text>
                  <Text style={styles.eventCategory}>
                    {ev.category.label}
                    {ev.is_joined ? ' · ✓ Going' : ''}
                    {cancelled ? ' · Cancelled' : ''}
                    {ev.is_full && !cancelled ? ' · Full' : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={palette.textDim} />
              </View>

              <View style={styles.eventDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="calendar-outline" size={12} color={palette.textDim} />
                  <Text style={styles.detailText}>{formatDate(ev.schedule.start_at)}</Text>
                </View>
                {ev.location.address ? (
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={12} color={palette.textDim} />
                    <Text style={styles.detailText} numberOfLines={1}>{ev.location.address}</Text>
                  </View>
                ) : null}
                <View style={styles.detailRow}>
                  <Ionicons name="people-outline" size={12} color={palette.textDim} />
                  <Text style={styles.detailText}>
                    {ev.participants_count} joined
                    {ev.max_participants ? ` · max ${ev.max_participants}` : ''}
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
              </View>

              <WeatherBadge
                lat={ev.location.lat}
                lng={ev.location.lng}
                isoDate={ev.schedule.start_at.slice(0, 10)}
                hour={new Date(ev.schedule.start_at).getHours()}
              />
            </View>
          )
        })}

      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  content:  { padding: spacing.lg, gap: spacing.lg },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { color: palette.accent, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  title:   { color: palette.text, fontSize: 30, fontWeight: '800' },
  refreshChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line,
    borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10,
  },
  refreshLabel: { color: palette.text, fontSize: 13, fontWeight: '700' },

  // Radar placeholder
  radarCard: {
    height: 280, borderRadius: 28, backgroundColor: '#060c1a',
    overflow: 'hidden', borderWidth: 1, borderColor: palette.line,
  },
  radarCircle: {
    position: 'absolute', width: 220, height: 220, borderRadius: 999,
    alignSelf: 'center', top: 10,
    borderWidth: 1, borderColor: 'rgba(108,255,47,0.12)',
    backgroundColor: 'rgba(108,255,47,0.04)',
  },
  radarCircleMid: {
    position: 'absolute', width: 140, height: 140, borderRadius: 999,
    alignSelf: 'center', top: 50,
    borderWidth: 1, borderColor: 'rgba(108,255,47,0.08)',
  },
  radarDot: {
    position: 'absolute', width: 8, height: 8, borderRadius: 999,
    alignSelf: 'center', top: 156,
    backgroundColor: palette.accent,
    shadowColor: palette.accent, shadowRadius: 8, shadowOpacity: 0.8, elevation: 6,
  },
  radarOverlay: {
    marginTop: 'auto', padding: spacing.md, gap: 10,
    backgroundColor: 'rgba(5,8,22,0.88)',
  },
  filterRow: { gap: 8 },
  filterChip: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: palette.panelRaised, borderWidth: 1, borderColor: palette.line,
  },
  filterChipActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  filterLabel: { color: palette.text, fontWeight: '700', fontSize: 12 },
  filterLabelActive: { color: '#031109' },

  bottomFilters: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radiusRow: { gap: 6 },
  radiusChip: {
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: palette.panelRaised, borderWidth: 1, borderColor: palette.line,
  },
  radiusChipActive: { borderColor: 'rgba(0,168,255,0.6)', backgroundColor: 'rgba(0,168,255,0.1)' },
  radiusLabel: { color: palette.textMuted, fontSize: 11, fontWeight: '700' },
  radiusLabelActive: { color: '#58beff' },
  goingChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: palette.panelRaised, borderWidth: 1, borderColor: palette.line,
  },
  goingChipActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  goingLabel: { color: palette.textMuted, fontSize: 11, fontWeight: '700' },
  goingLabelActive: { color: '#031109' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle:  { color: palette.text, fontSize: 18, fontWeight: '800' },
  sectionCount:  {
    color: palette.accent, fontSize: 13, fontWeight: '800',
    backgroundColor: 'rgba(108,255,47,0.1)',
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
  },

  loadingWrap: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyWrap:   { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText:   { color: palette.textMuted, fontSize: 14 },

  eventCard: {
    backgroundColor: palette.panel, borderRadius: 22,
    borderWidth: 1, borderColor: palette.line, padding: spacing.md, gap: 12,
  },
  eventCardCancelled: { borderColor: 'rgba(248,113,113,0.35)', opacity: 0.7 },
  eventCardPast:      { opacity: 0.6 },

  eventTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  eventBadge: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: palette.panelRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  eventBadgeCancelled: { borderWidth: 1, borderColor: 'rgba(248,113,113,0.4)' },
  eventEmoji:  { fontSize: 24 },
  eventMeta:   { flex: 1, gap: 3 },
  eventTitle:  { color: palette.text, fontSize: 16, fontWeight: '800' },
  eventCategory: { color: palette.textMuted, fontSize: 13 },

  eventDetails: { gap: 5 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { color: palette.textDim, fontSize: 12, flex: 1 },
})
