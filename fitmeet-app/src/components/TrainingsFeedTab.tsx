import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native'

import { api } from '@/src/lib/api'
import { CATEGORIES } from '@/src/lib/categories'
import { palette, spacing } from '@/src/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrainingUser { id: number; name: string; avatar: string | null }

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
  is_mine: boolean
  user: TrainingUser | null
}

interface TrainingTotals {
  count: number
  distance_m: number
  duration_s: number
  elevation_gain: number
  calories: number
}

interface TrainingDetailStat {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string
}

type Scope = 'friends' | 'mine'

// ─── Constants & helpers ────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.emoji])
)

const PROVIDER_LABEL: Record<string, string> = {
  strava: 'Strava',
  garmin: 'Garmin',
  huawei: 'Health',
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

function buildTrainingDetails(t: TrainingItem): TrainingDetailStat[] {
  const avgSpeed = formatTrainingSpeed(t.avg_speed_mps, t.category.value)
  const maxSpeed = formatTrainingSpeed(t.max_speed_mps, t.category.value)
  const details: (TrainingDetailStat | false)[] = [
    t.avg_heartrate != null && { icon: 'heart-outline', label: 'Avg HR', value: `${Math.round(t.avg_heartrate)} bpm` },
    t.max_heartrate != null && { icon: 'heart-outline', label: 'Max HR', value: `${Math.round(t.max_heartrate)} bpm` },
    t.avg_watts != null && { icon: 'flash-outline', label: 'Avg power', value: `${Math.round(t.avg_watts)} W` },
    t.max_watts != null && { icon: 'flash-outline', label: 'Max power', value: `${Math.round(t.max_watts)} W` },
    t.avg_cadence != null && { icon: 'speedometer-outline', label: 'Cad.', value: `${Math.round(t.avg_cadence)} rpm` },
    t.calories != null && { icon: 'flame-outline', label: 'Cal.', value: `${Math.round(t.calories)} kcal` },
    avgSpeed != null && { icon: 'trending-up-outline', label: 'Avg sp.', value: avgSpeed },
    maxSpeed != null && { icon: 'speedometer-outline', label: 'Max sp.', value: maxSpeed },
    t.kilojoules != null && { icon: 'flash-outline', label: 'Energy', value: `${Math.round(t.kilojoules)} kJ` },
    t.suffer_score != null && { icon: 'pulse-outline', label: 'Effort', value: `${Math.round(t.suffer_score)}` },
    t.gear_name != null && { icon: 'pricetag-outline', label: 'Gear', value: t.gear_name },
  ]
  return details.filter((d): d is TrainingDetailStat => d !== false)
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TrainingsFeedTab() {
  const [trainings, setTrainings] = useState<TrainingItem[]>([])
  const [totals, setTotals] = useState<TrainingTotals | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const [scope, setScope] = useState<Scope>('friends')
  const [category, setCategory] = useState('')
  const [month, setMonth] = useState(0)
  const [year, setYear] = useState(0)
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
  const [showFilter, setShowFilter] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const activeFilterCount = (scope === 'mine' ? 1 : 0) + (category ? 1 : 0) + (month ? 1 : 0) + (year ? 1 : 0)

  const load = useCallback(async (pageNum = 1) => {
    if (pageNum === 1) setLoading(true)
    else setLoadingMore(true)
    try {
      const params: Record<string, unknown> = { page: pageNum, per_page: 20, scope }
      if (category) params.category = category
      if (month) params.month = month
      if (year) params.year = year
      const { data } = await api.get('/trainings', { params })
      const incoming: TrainingItem[] = data.data ?? []
      setTrainings(prev => pageNum === 1 ? incoming : [...prev, ...incoming])
      setTotals(data.totals ?? null)
      setPage(pageNum)
      setLastPage(data.meta?.last_page ?? pageNum)
    } catch {
      if (pageNum === 1) { setTrainings([]); setTotals(null) }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [scope, category, month, year])

  useEffect(() => { load(1) }, [load])

  const hasMore = page < lastPage

  function toggleExpanded(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function confirmDeleteTraining(training: TrainingItem) {
    Alert.alert(
      'Delete training',
      'Delete this training? This only removes it from FitMeet, not from Strava/Huawei.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            setDeletingId(training.id)
            try {
              await api.delete(`/trainings/${training.id}`)
              setTrainings(prev => prev.filter(t => t.id !== training.id))
            } catch {
              Alert.alert('Error', 'Could not delete training.')
            } finally {
              setDeletingId(null)
            }
          },
        },
      ],
    )
  }

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
      <View style={styles.headerRow}>
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
        <Pressable style={styles.connectBtn} onPress={() => router.push('/connected-apps' as never)}>
          <Ionicons name="link-outline" size={16} color={palette.accent} />
        </Pressable>
      </View>

      {showFilter && (
        <View style={styles.filterDropdownThin}>
          <Text style={styles.filterSectionLabel}>Show</Text>
          <View style={styles.filterRow}>
            <Pressable style={[styles.filterChip, scope === 'friends' && styles.filterChipActive]} onPress={() => setScope('friends')}>
              <Text style={[styles.filterLabel, scope === 'friends' && styles.filterLabelActive]}>Everyone</Text>
            </Pressable>
            <Pressable style={[styles.filterChip, scope === 'mine' && styles.filterChipActive]} onPress={() => setScope('mine')}>
              <Text style={[styles.filterLabel, scope === 'mine' && styles.filterLabelActive]}>Just me</Text>
            </Pressable>
          </View>

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
    </View>
  )

  return (
    <FlatList
      style={{ flex: 1 }}
      data={trainings}
      keyExtractor={t => String(t.id)}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      onEndReachedThreshold={0.5}
      onEndReached={() => { if (hasMore && !loadingMore && !loading) load(page + 1) }}
      ListFooterComponent={loadingMore ? (
        <ActivityIndicator color={palette.accent} style={{ paddingVertical: spacing.lg }} />
      ) : null}
      ListEmptyComponent={!loading ? (
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: spacing.xl }}>
          <Text style={styles.emptyText}>
            {scope === 'mine' ? 'No trainings synced yet.' : 'No trainings yet. Yours and friends’ synced workouts will show up here.'}
          </Text>
          <Pressable style={styles.createRouteBtn} onPress={() => router.push('/connected-apps' as never)}>
            <Ionicons name="link-outline" size={16} color={palette.accent} />
            <Text style={styles.createRouteBtnText}>Connect an app</Text>
          </Pressable>
        </View>
      ) : null}
      renderItem={({ item: training }) => {
        const details = buildTrainingDetails(training)
        const expanded = expandedIds.has(training.id)
        const emoji = CATEGORY_EMOJI[training.category.value] ?? '🏋️'
        return (
          <View style={styles.eventCard}>
            <View style={styles.eventTop}>
              {training.user && !training.is_mine ? (
                training.user.avatar
                  ? <Image source={{ uri: training.user.avatar }} style={styles.eventBadge} />
                  : (
                    <View style={styles.eventBadge}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: palette.accent }}>
                        {training.user.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )
              ) : (
                <View style={styles.eventBadge}><Text style={{ fontSize: 22 }}>{emoji}</Text></View>
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.eventTitle} numberOfLines={1}>
                  {training.user && !training.is_mine ? `${training.user.name} — ` : ''}{training.name ?? training.category.label}
                </Text>
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
              {training.is_mine && (
                <Pressable
                  style={styles.trainingDeleteBtn}
                  onPress={() => confirmDeleteTraining(training)}
                  disabled={deletingId === training.id}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={16} color={palette.textDim} />
                </Pressable>
              )}
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
      }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
    />
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingTop: spacing.md, flexGrow: 1 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  connectBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(108,255,47,0.1)',
    borderWidth: 1, borderColor: 'rgba(108,255,47,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },

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
  filterBtnActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  filterBtnLabel: { color: palette.text, fontSize: 13, fontWeight: '700' },
  filterBtnLabelActive: { color: '#031109' },
  filterBadge: {
    backgroundColor: '#031109', borderRadius: 999,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  filterBadgeText: { color: palette.accent, fontSize: 11, fontWeight: '800' },
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
  filterLabel: { color: palette.text, fontSize: 12, fontWeight: '700' },
  filterLabelActive: { color: '#031109' },

  emptyText: { color: palette.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: spacing.xl },

  eventCard: {
    backgroundColor: palette.panel, borderRadius: 22,
    borderWidth: 1, borderColor: palette.line, padding: spacing.md, gap: 10,
    overflow: 'hidden',
  },
  trainingDeleteBtn: { padding: 6 },
  eventTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eventBadge: {
    width: 46, height: 46, borderRadius: 14,
    backgroundColor: palette.panelRaised, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
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

  details: { gap: 5 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  detailText: { color: palette.textMuted, fontSize: 13 },

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
})
