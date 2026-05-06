import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Image, Modal, Pressable,
  ScrollView, Share, StyleSheet, Text, View, type StyleProp, type ViewStyle,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { SafeAreaView } from 'react-native-safe-area-context'

import { WeatherBadge } from '@/src/components/WeatherBadge'
import { EventMapCard } from '@/src/components/EventMapCard'
import { ElevationChart } from '@/src/components/ElevationChart'
import type { ElevationPoint } from '@/src/components/ElevationChart'
import { CATEGORIES } from '@/src/lib/categories'
import { api } from '@/src/lib/api'
import { parseGpxText } from '@/src/lib/gpx'
import type { TrackSegment } from '@/src/lib/gpx'
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
    gpx_url: string | null
  }
  participants_count: number
  max_participants: number | null
  status: string
  is_full: boolean
  is_joined: boolean
  is_organizer: boolean
  is_private: boolean
  image_url: string | null
  youtube_url: string | null
  organizer: Participant | null
  participants: Participant[]
  skill_level: string | null
}

type ReminderOffset = '1h' | '5h' | '1d'

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

const REMINDER_OPTIONS: Array<{ value: ReminderOffset; label: string }> = [
  { value: '1h', label: '1h before' },
  { value: '5h', label: '5h before' },
  { value: '1d', label: '1 day before' },
]

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

  const [event,      setEvent]      = useState<EventDetail | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [acting,     setActing]     = useState(false)
  const [imageModal, setImageModal] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [activeOffsets, setActiveOffsets] = useState<ReminderOffset[]>([])
  const [selectedOffsets, setSelectedOffsets] = useState<Set<ReminderOffset>>(new Set())
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [settingReminders, setSettingReminders] = useState(false)
  const [showParticipants, setShowParticipants] = useState(false)
  const [youtubeOpen, setYoutubeOpen] = useState(false)
  const [coloredSegments, setColoredSegments] = useState<TrackSegment[]>([])
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[]>([])

  const loadEvent = useCallback(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    api.get(`/events/${id}`)
      .then(({ data }) => setEvent(data.data))
      .catch(() => setError('Could not load event.'))
      .finally(() => setLoading(false))
  }, [id])

  useFocusEffect(loadEvent)

  useEffect(() => {
    setColoredSegments([])
    setElevationProfile([])
    if (!event?.activity.gpx_url) return
    const token = useAuthStore.getState().token
    const separator = event.activity.gpx_url.includes('?') ? '&' : '?'
    fetch(`${event.activity.gpx_url}${separator}t=${Date.now()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.text())
      .then(xml => {
        const parsed = parseGpxText(xml)
        if (parsed.coloredSegments.length > 0) setColoredSegments(parsed.coloredSegments)
        if (parsed.elevationProfile.length >= 2) setElevationProfile(parsed.elevationProfile)
      })
      .catch(() => {})
  }, [event?.activity.gpx_url])

  useEffect(() => {
    if (!id) return
    api.get('/events/my-reminders')
      .then(({ data }) => {
        const offsets = ((data.data as Record<string, ReminderOffset[]>)[id] ?? [])
          .filter((offset): offset is ReminderOffset => offset === '1h' || offset === '5h' || offset === '1d')
        setActiveOffsets(offsets)
        setSelectedOffsets(new Set(offsets))
      })
      .catch(() => {
        setActiveOffsets([])
        setSelectedOffsets(new Set())
      })
  }, [id])

  async function join() {
    if (!event) return
    setActing(true)
    try {
      const { data } = await api.post(`/events/${event.id}/join`)
      if (data.data) setEvent(data.data)
      else {
        const fresh = await api.get(`/events/${event.id}`)
        setEvent(fresh.data.data)
      }
      setSelectedOffsets(new Set(activeOffsets))
      setShowReminderModal(true)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not join.'
      Alert.alert('Error', msg)
    } finally { setActing(false) }
  }

  async function leave() {
    if (!event) return
    Alert.alert('Leave event', 'Leave this event and clear your reminders?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          setActing(true)
          try {
            const { data } = await api.post(`/events/${event.id}/leave`)
            await api.post(`/events/${event.id}/remind`, { offsets: [] }).catch(() => {})
            setActiveOffsets([])
            setSelectedOffsets(new Set())
            if (data.data) setEvent(data.data)
            else {
              const fresh = await api.get(`/events/${event.id}`)
              setEvent(fresh.data.data)
            }
          } catch (e: unknown) {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not leave event.'
            Alert.alert('Error', msg)
          } finally { setActing(false) }
        },
      },
    ])
  }

  function openReminderModal() {
    setSelectedOffsets(new Set(activeOffsets))
    setShowReminderModal(true)
  }

  async function saveReminders() {
    if (!event) return
    setSettingReminders(true)
    try {
      const offsets = Array.from(selectedOffsets)
      await api.post(`/events/${event.id}/remind`, { offsets })
      setActiveOffsets(offsets)
      setShowReminderModal(false)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not save reminders.'
      Alert.alert('Error', msg)
    } finally {
      setSettingReminders(false)
    }
  }

  function toggleReminder(offset: ReminderOffset) {
    setSelectedOffsets((prev) => {
      const next = new Set(prev)
      if (next.has(offset)) next.delete(offset)
      else next.add(offset)
      return next
    })
  }

  async function cancelEvent() {
    if (!event) return
    Alert.alert('Cancel event', 'This cannot be undone. Cancel this event?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel event', style: 'destructive', onPress: async () => {
          setActing(true)
          try {
            await api.delete(`/events/${event.id}`)
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
        <Pressable style={[styles.backBtn, { margin: spacing.md }]} onPress={() => router.back()}>
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

  function shareEvent() {
    const d = new Date(event!.schedule.start_at)
    const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    Share.share({
      title: event!.title,
      message: [
        event!.title,
        `📅 ${date} · ${time}`,
        event!.location.address ? `📍 ${event!.location.address}` : null,
        `👥 ${event!.participants_count} joined`,
        '',
        `Join on FitMeet 👉 https://fitmeet.fit/events/share?id=${event!.id}`,
      ].filter(Boolean).join('\n'),
    })
  }

  // ─── Action button ──────────────────────────────────────────────────────
  let actionLabel = 'Join Event'
  let actionStyle: StyleProp<ViewStyle> = styles.joinBtn
  let actionLabelStyle = styles.actionLabel
  let actionFn    = join
  let actionDisabled = false
  const showActionRow = event.status === 'active' || event.is_joined

  if (cancelled) {
    actionLabel = 'Event Cancelled'
    actionDisabled = true
  } else if (past && !event.is_joined) {
    actionLabel = 'Event Ended'
    actionDisabled = true
  } else if (event.is_joined) {
    actionLabel = 'Leave Event'
    actionStyle = styles.leaveBtn
    actionLabelStyle = styles.leaveActionLabel
    actionFn    = leave
  } else if (event.is_full) {
    actionLabel = 'Event Full'
    actionDisabled = true
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Full-screen image modal */}
      {event?.image_url && (
        <Modal visible={imageModal} transparent animationType="fade" onRequestClose={() => setImageModal(false)}>
          <Pressable style={styles.imgOverlay} onPress={() => setImageModal(false)}>
            <Image source={{ uri: event.image_url }} style={styles.imgFull} resizeMode="contain" />
            <Pressable style={styles.imgClose} onPress={() => setImageModal(false)}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </Pressable>
        </Modal>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={palette.text} />
          </Pressable>
          <Pressable style={styles.shareBtn} onPress={shareEvent}>
            <Ionicons name="share-outline" size={20} color={palette.text} />
          </Pressable>
        </View>

        {/* Cover image */}
        {event.image_url ? (
          <Pressable onPress={() => setImageModal(true)}>
            <Image source={{ uri: event.image_url }} style={styles.coverImage} resizeMode="cover" />
          </Pressable>
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
          {event.location.lat != null && event.location.lng != null && !cancelled && !past && (
            <WeatherBadge
              lat={event.location.lat}
              lng={event.location.lng}
              isoDate={event.schedule.start_at.slice(0, 10)}
              hour={new Date(event.schedule.start_at).getHours()}
            />
          )}
          {event.location.address ? (
            <DetailRow icon="location-outline" primary={event.location.address} />
          ) : null}
          <DetailRow icon="people-outline" primary={
            `${event.participants_count} joined` +
            (event.max_participants ? ` · max ${event.max_participants}` : '')
          } />
          {(event.activity.distance_km || event.activity.elevation_gain || event.activity.pace) ? (
            <DetailRow
              icon="flash-outline"
              iconColor={palette.accent}
              primary={[
                event.activity.distance_km    && `${event.activity.distance_km} km`,
                event.activity.elevation_gain && `↑${event.activity.elevation_gain} m`,
                event.activity.pace           && `⏱ ${event.activity.pace}`,
              ].filter(Boolean).join(' · ')}
            />
          ) : null}
          {(event.activity.max_grade != null || event.activity.max_downgrade != null) ? (
            <DetailRow
              icon="trending-up-outline"
              iconColor="#58beff"
              primary={[
                event.activity.max_grade     != null && `▲ ${event.activity.max_grade}%`,
                event.activity.max_downgrade != null && `▼ ${Math.abs(event.activity.max_downgrade)}%`,
              ].filter(Boolean).join('  ')}
            />
          ) : null}
          {event.activity.gpx_url ? (
            <DetailRow icon="map-outline" primary="GPX route attached" />
          ) : null}
          {event.is_private ? (
            <DetailRow icon="lock-closed-outline" primary="Private event" />
          ) : null}
        </View>

        {/* Map */}
        {event.location.lat != null && event.location.lng != null && (
          <EventMapCard
            lat={event.location.lat}
            lng={event.location.lng}
            emoji={CATEGORY_EMOJI[event.category.value] ?? '📍'}
            coloredSegments={coloredSegments.length > 0 ? coloredSegments : undefined}
          />
        )}

        {/* Elevation profile */}
        {elevationProfile.length >= 2 && (
          <View style={{ paddingHorizontal: spacing.md }}>
            <ElevationChart profile={elevationProfile} />
          </View>
        )}

        {/* Description */}
        {event.description ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>About</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>
        ) : null}

        {/* YouTube */}
        {event.youtube_url ? (() => {
          const ytId = event.youtube_url!.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/)?.[1]
          if (!ytId) return null
          return (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Video</Text>
              {youtubeOpen ? (
                <View style={{ height: 220, borderRadius: 14, overflow: 'hidden' }}>
                  <WebView
                    source={{ uri: `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0` }}
                    javaScriptEnabled
                    allowsFullscreenVideo
                    style={{ flex: 1 }}
                  />
                </View>
              ) : (
                <Pressable onPress={() => setYoutubeOpen(true)} style={styles.ytThumb}>
                  <Image
                    source={{ uri: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` }}
                    style={StyleSheet.absoluteFillObject}
                    resizeMode="cover"
                  />
                  <View style={styles.ytPlayBtn}>
                    <Ionicons name="play" size={28} color="#fff" />
                  </View>
                </Pressable>
              )}
            </View>
          )
        })() : null}

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
            <Pressable style={styles.cardHeader} onPress={() => setShowParticipants(v => !v)}>
              <Text style={styles.cardLabel}>Participants ({event.participants_count})</Text>
              <Ionicons
                name={showParticipants ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={palette.textDim}
              />
            </Pressable>
            {showParticipants && (
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
            )}
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

        {/* Join / Leave + reminders */}
        {showActionRow && (
          <View style={styles.actionRow}>
            <Pressable
              style={[actionStyle, styles.actionFlex, (actionDisabled || acting) && styles.disabledBtn]}
              onPress={actionFn}
              disabled={actionDisabled || acting}
            >
              {acting ? (
                <ActivityIndicator size="small" color={event.is_joined ? '#f87171' : '#041109'} />
              ) : (
                <Text style={actionLabelStyle}>{actionLabel}</Text>
              )}
            </Pressable>
            {event.is_joined && !cancelled && !past ? (
              <Pressable
                style={[styles.reminderBtn, activeOffsets.length > 0 && styles.reminderBtnActive]}
                onPress={openReminderModal}
                disabled={acting}
              >
                <Ionicons
                  name={activeOffsets.length > 0 ? 'notifications' : 'notifications-outline'}
                  size={20}
                  color={activeOffsets.length > 0 ? palette.accent : palette.textMuted}
                />
              </Pressable>
            ) : null}
          </View>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
      <Modal visible={showReminderModal} transparent animationType="slide" onRequestClose={() => setShowReminderModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowReminderModal(false)}>
          <Pressable style={styles.reminderModal} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <Ionicons name="notifications-outline" size={22} color={palette.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{event?.is_joined ? 'Event reminder' : 'Successfully joined!'}</Text>
                <Text style={styles.modalSubtitle}>Want a reminder before it starts?</Text>
              </View>
              <Pressable style={styles.modalClose} onPress={() => setShowReminderModal(false)}>
                <Ionicons name="close" size={20} color={palette.textMuted} />
              </Pressable>
            </View>

            <View style={styles.reminderOptions}>
              {REMINDER_OPTIONS.map((option) => {
                const active = selectedOffsets.has(option.value)
                return (
                  <Pressable
                    key={option.value}
                    style={[styles.reminderOption, active && styles.reminderOptionActive]}
                    onPress={() => toggleReminder(option.value)}
                  >
                    <Ionicons
                      name={active ? 'checkmark-circle' : 'notifications-outline'}
                      size={15}
                      color={active ? palette.accent : palette.textMuted}
                    />
                    <Text style={[styles.reminderOptionText, active && styles.reminderOptionTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondary} onPress={() => setShowReminderModal(false)}>
                <Text style={styles.modalSecondaryText}>Skip</Text>
              </Pressable>
              <Pressable style={[styles.modalPrimary, settingReminders && styles.disabledBtn]} onPress={saveReminders} disabled={settingReminders}>
                {settingReminders ? (
                  <ActivityIndicator size="small" color="#041109" />
                ) : (
                  <Text style={styles.modalPrimaryText}>{selectedOffsets.size === 0 ? 'Clear Reminders' : 'Save Reminders'}</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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

  topBar: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: palette.panel,
    alignItems: 'center', justifyContent: 'center',
  },
  shareBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: palette.panel,
    alignItems: 'center', justifyContent: 'center',
  },

  coverImage: { width: '100%', height: 220 },
  imgOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  imgFull:    { width: '100%', height: '80%' },
  imgClose:   { position: 'absolute', top: 50, right: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  detailRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  detailPrimary:  { color: palette.textMuted, fontSize: 14, lineHeight: 20 },
  detailSecondary:{ color: palette.textDim, fontSize: 13 },

  description: { color: palette.textMuted, fontSize: 14, lineHeight: 22 },

  ytThumb: {
    height: 200, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#000', alignItems: 'center', justifyContent: 'center',
  },
  ytPlayBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },

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
    height: 56, borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  leaveBtn: {
    height: 56, borderRadius: 18,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  actionRow: { marginHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionFlex: { flex: 1 },
  reminderBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderBtnActive: {
    borderColor: palette.accent,
    backgroundColor: 'rgba(57,255,20,0.1)',
  },
  disabledBtn: { opacity: 0.45 },
  actionLabel: { color: '#041109', fontSize: 16, fontWeight: '800' },
  leaveActionLabel: { color: '#f87171', fontSize: 16, fontWeight: '800' },

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

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  reminderModal: {
    backgroundColor: palette.panel,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.md,
    gap: spacing.md,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(57,255,20,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(57,255,20,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { color: palette.text, fontSize: 18, fontWeight: '800' },
  modalSubtitle: { color: palette.textMuted, fontSize: 13, marginTop: 2 },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: palette.panelRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reminderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  reminderOptionActive: {
    borderColor: palette.accent,
    backgroundColor: 'rgba(57,255,20,0.08)',
  },
  reminderOptionText: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  reminderOptionTextActive: { color: palette.accent },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalSecondary: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryText: { color: palette.textMuted, fontSize: 14, fontWeight: '700' },
  modalPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryText: { color: '#041109', fontSize: 14, fontWeight: '800' },
})
