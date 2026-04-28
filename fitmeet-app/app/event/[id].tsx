import { Ionicons } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Image, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { WeatherBadge } from '@/src/components/WeatherBadge'
import { CATEGORIES } from '@/src/lib/categories'
import { api } from '@/src/lib/api'
import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Participant { id: number; name: string; avatar: string | null }

interface EventDetail {
  id: number
  title: string
  description: string | null
  category: { value: string; label: string }
  location: { lat: number | null; lng: number | null; address: string | null }
  schedule: { start_at: string; timezone: string; duration_minutes: number | null }
  activity: {
    distance_km: number | null
    elevation_gain: number | null
    pace: string | null
    max_grade: number | null
    max_downgrade: number | null
  }
  participants_count: number
  max_participants: number | null
  status: string
  is_full: boolean
  is_joined: boolean
  is_organizer: boolean
  image_url: string | null
  gpx_path: string | null
  organizer: Participant | null
  participants: Participant[]
  skill_level: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.emoji])
)

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function Avatar({ user, size = 32 }: { user: Participant; size?: number }) {
  if (user.avatar) {
    return (
      <Image
        source={{ uri: user.avatar }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    )
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: palette.accent,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#041109', fontSize: size * 0.4, fontWeight: '800' }}>
        {user.name.charAt(0).toUpperCase()}
      </Text>
    </View>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const me = useAuthStore(s => s.user)

  const [event,   setEvent]   = useState<EventDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting,  setActing]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api.get(`/events/${id}`)
      .then(({ data }) => setEvent(data.data))
      .catch(() => setError('Could not load event.'))
      .finally(() => setLoading(false))
  }, [id])

  async function join() {
    if (!event) return
    setActing(true)
    try {
      await api.post(`/events/${event.id}/join`)
      const { data } = await api.get(`/events/${event.id}`)
      setEvent(data.data)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not join.'
      Alert.alert('Error', msg)
    } finally { setActing(false) }
  }

  async function leave() {
    if (!event) return
    Alert.alert('Leave event', 'Are you sure you want to leave?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          setActing(true)
          try {
            await api.post(`/events/${event.id}/leave`)
            const { data } = await api.get(`/events/${event.id}`)
            setEvent(data.data)
          } catch {
            Alert.alert('Error', 'Could not leave event.')
          } finally { setActing(false) }
        },
      },
    ])
  }

  async function cancelEvent() {
    if (!event) return
    Alert.alert('Cancel event', 'This cannot be undone. Cancel this event?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel event', style: 'destructive', onPress: async () => {
          setActing(true)
          try {
            await api.patch(`/events/${event.id}`, { status: 'cancelled' })
            const { data } = await api.get(`/events/${event.id}`)
            setEvent(data.data)
          } catch {
            Alert.alert('Error', 'Could not cancel event.')
          } finally { setActing(false) }
        },
      },
    ])
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  if (error || !event) {
    return (
      <SafeAreaView style={styles.safe}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={palette.text} />
        </Pressable>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Event not found.'}</Text>
        </View>
      </SafeAreaView>
    )
  }

  const cancelled  = event.status === 'cancelled'
  const past       = new Date(event.schedule.start_at).getTime() < Date.now()
  const emoji      = CATEGORY_EMOJI[event.category.value] ?? '📍'
  const isOrg      = event.is_organizer || event.organizer?.id === me?.id

  // ─── Action button ──────────────────────────────────────────────────────
  let actionLabel = 'Join Event'
  let actionStyle = styles.joinBtn
  let actionFn    = join
  let actionDisabled = false

  if (cancelled) {
    actionLabel = 'Event Cancelled'
    actionDisabled = true
  } else if (past && !event.is_joined) {
    actionLabel = 'Event Ended'
    actionDisabled = true
  } else if (event.is_joined) {
    actionLabel = 'Leave Event'
    actionStyle = styles.leaveBtn
    actionFn    = leave
  } else if (event.is_full) {
    actionLabel = 'Event Full'
    actionDisabled = true
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Back */}
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={palette.text} />
        </Pressable>

        {/* Cover image */}
        {event.image_url ? (
          <Image source={{ uri: event.image_url }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Text style={{ fontSize: 56 }}>{emoji}</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.section}>
          <View style={styles.badgeRow}>
            <View style={styles.catBadge}>
              <Text style={styles.catBadgeText}>{emoji} {event.category.label}</Text>
            </View>
            {cancelled && <View style={styles.cancelBadge}><Text style={styles.cancelBadgeText}>Cancelled</Text></View>}
            {event.is_full && !cancelled && <View style={styles.fullBadge}><Text style={styles.fullBadgeText}>Full</Text></View>}
            {event.is_joined && <View style={styles.joinedBadge}><Text style={styles.joinedBadgeText}>✓ Going</Text></View>}
            {past && !cancelled && <View style={styles.pastBadge}><Text style={styles.pastBadgeText}>Past</Text></View>}
          </View>
          <Text style={styles.title}>{event.title}</Text>
          {event.skill_level && (
            <Text style={styles.skillLevel}>Level: {event.skill_level}</Text>
          )}
        </View>

        {/* Details */}
        <View style={styles.card}>
          <DetailRow icon="calendar-outline" primary={formatDate(event.schedule.start_at)} secondary={
            formatTime(event.schedule.start_at) +
            (event.schedule.duration_minutes ? ` · ${event.schedule.duration_minutes} min` : '')
          } />
          {event.location.address ? (
            <DetailRow icon="location-outline" primary={event.location.address} />
          ) : null}
          <DetailRow icon="people-outline" primary={
            `${event.participants_count} joined` +
            (event.max_participants ? ` · max ${event.max_participants}` : '')
          } />
          {(event.activity.distance_km || event.activity.elevation_gain) ? (
            <DetailRow
              icon="flash-outline"
              iconColor={palette.accent}
              primary={[
                event.activity.distance_km    && `${event.activity.distance_km} km`,
                event.activity.elevation_gain && `↑${event.activity.elevation_gain} m`,
                event.activity.pace           && `${event.activity.pace}`,
              ].filter(Boolean).join(' · ')}
            />
          ) : null}
        </View>

        {/* Weather */}
        {event.location.lat != null && event.location.lng != null && !cancelled && !past && (
          <WeatherBadge
            lat={event.location.lat}
            lng={event.location.lng}
            isoDate={event.schedule.start_at.slice(0, 10)}
            hour={new Date(event.schedule.start_at).getHours()}
          />
        )}

        {/* Description */}
        {event.description ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>About</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>
        ) : null}

        {/* Organizer */}
        {event.organizer ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Organizer</Text>
            <View style={styles.personRow}>
              <Avatar user={event.organizer} size={36} />
              <Text style={styles.personName}>{event.organizer.name}</Text>
              {isOrg && (
                <View style={styles.youBadge}><Text style={styles.youBadgeText}>You</Text></View>
              )}
            </View>
          </View>
        ) : null}

        {/* Participants */}
        {event.participants.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Participants ({event.participants_count})</Text>
            <View style={styles.participantGrid}>
              {event.participants.slice(0, 12).map(p => (
                <View key={p.id} style={styles.participantItem}>
                  <Avatar user={p} size={40} />
                  <Text style={styles.participantName} numberOfLines={1}>{p.name.split(' ')[0]}</Text>
                </View>
              ))}
              {event.participants_count > 12 && (
                <View style={styles.participantItem}>
                  <View style={[styles.moreCircle]}>
                    <Text style={styles.moreText}>+{event.participants_count - 12}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Organizer actions */}
        {isOrg && !cancelled && (
          <View style={{ gap: spacing.sm }}>
            <Pressable
              style={styles.editBtn}
              onPress={() => router.push(`/event/edit/${event.id}` as never)}
            >
              <Ionicons name="create-outline" size={16} color={palette.accent} />
              <Text style={styles.editBtnText}>Edit Event</Text>
            </Pressable>
            <Pressable
              style={styles.cancelEventBtn}
              onPress={cancelEvent}
              disabled={acting}
            >
              <Ionicons name="close-circle-outline" size={16} color="#f87171" />
              <Text style={styles.cancelEventBtnText}>Cancel Event</Text>
            </Pressable>
          </View>
        )}

        {/* Join / Leave */}
        {!isOrg && (
          <Pressable
            style={[actionStyle, (actionDisabled || acting) && styles.disabledBtn]}
            onPress={actionFn}
            disabled={actionDisabled || acting}
          >
            {acting ? (
              <ActivityIndicator size="small" color="#041109" />
            ) : (
              <Text style={styles.actionLabel}>{actionLabel}</Text>
            )}
          </Pressable>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function DetailRow({ icon, primary, secondary, iconColor }: {
  icon: string; primary: string; secondary?: string; iconColor?: string
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon as 'flash-outline'} size={15} color={iconColor ?? palette.textDim} />
      <View style={{ flex: 1 }}>
        <Text style={styles.detailPrimary}>{primary}</Text>
        {secondary ? <Text style={styles.detailSecondary}>{secondary}</Text> : null}
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: palette.bg },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { gap: spacing.md },
  errorText: { color: palette.textMuted, fontSize: 15 },

  backBtn: {
    marginTop: spacing.sm,
    marginLeft: spacing.md,
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: palette.panel,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'flex-start',
  },

  coverImage: { width: '100%', height: 220 },
  coverPlaceholder: {
    height: 160, width: '100%',
    backgroundColor: palette.panel,
    alignItems: 'center', justifyContent: 'center',
  },

  section:  { paddingHorizontal: spacing.md, gap: spacing.sm },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  catBadge:       { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(57,255,20,0.1)', borderWidth: 1, borderColor: 'rgba(57,255,20,0.3)' },
  catBadgeText:   { color: palette.accent, fontSize: 12, fontWeight: '700' },
  cancelBadge:    { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(248,113,113,0.1)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)' },
  cancelBadgeText:{ color: '#f87171', fontSize: 12, fontWeight: '700' },
  fullBadge:      { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(251,146,60,0.1)', borderWidth: 1, borderColor: 'rgba(251,146,60,0.3)' },
  fullBadgeText:  { color: '#fb923c', fontSize: 12, fontWeight: '700' },
  joinedBadge:    { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(57,255,20,0.15)', borderWidth: 1, borderColor: palette.accent },
  joinedBadgeText:{ color: palette.accent, fontSize: 12, fontWeight: '700' },
  pastBadge:      { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: palette.panelRaised, borderWidth: 1, borderColor: palette.line },
  pastBadgeText:  { color: palette.textMuted, fontSize: 12, fontWeight: '700' },

  title:      { color: palette.text, fontSize: 24, fontWeight: '800', lineHeight: 30 },
  skillLevel: { color: palette.textMuted, fontSize: 13, textTransform: 'capitalize' },

  card: {
    marginHorizontal: spacing.md,
    backgroundColor: palette.panel,
    borderRadius: 18, borderWidth: 1, borderColor: palette.line,
    padding: spacing.md, gap: 10,
  },
  cardLabel: { color: palette.text, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  detailRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  detailPrimary:  { color: palette.textMuted, fontSize: 14, lineHeight: 20 },
  detailSecondary:{ color: palette.textDim, fontSize: 13 },

  description: { color: palette.textMuted, fontSize: 14, lineHeight: 22 },

  personRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personName:  { color: palette.text, fontSize: 15, fontWeight: '700', flex: 1 },
  youBadge:    { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: 'rgba(57,255,20,0.1)', borderWidth: 1, borderColor: palette.accent },
  youBadgeText:{ color: palette.accent, fontSize: 11, fontWeight: '700' },

  participantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  participantItem: { alignItems: 'center', gap: 4, width: 48 },
  participantName: { color: palette.textDim, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  moreCircle:  { width: 40, height: 40, borderRadius: 20, backgroundColor: palette.panelRaised, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },
  moreText:    { color: palette.textMuted, fontSize: 11, fontWeight: '700' },

  joinBtn: {
    marginHorizontal: spacing.md,
    height: 56, borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  leaveBtn: {
    marginHorizontal: spacing.md,
    height: 56, borderRadius: 18,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  disabledBtn: { opacity: 0.45 },
  actionLabel: { color: '#041109', fontSize: 16, fontWeight: '800' },

  editBtn: {
    marginHorizontal: spacing.md,
    height: 48, borderRadius: 16,
    borderWidth: 1, borderColor: palette.accent,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  editBtnText: { color: palette.accent, fontSize: 14, fontWeight: '700' },
  cancelEventBtn: {
    marginHorizontal: spacing.md,
    height: 48, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  cancelEventBtnText: { color: '#f87171', fontSize: 14, fontWeight: '700' },
})
