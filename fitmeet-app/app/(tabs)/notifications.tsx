import { Ionicons } from '@expo/vector-icons'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { badgeEvents } from './_layout'
import {
  ActivityIndicator, Image, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'

import { api } from '@/src/lib/api'
import { palette, spacing } from '@/src/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserInfo { id: number; name: string; avatar: string | null }
interface EventInfo { id: number; title: string; start_at: string; address: string | null; category: string }

type Notification =
  | { id: number; type: 'friend_request';  sender:  UserInfo; created_at: string; unread?: boolean }
  | { id: number; type: 'friend_accepted'; friend:  UserInfo; created_at: string; unread?: boolean }
  | { id: number; type: 'event_reminder';  event:   EventInfo; remind_offset: string; created_at: string; unread?: boolean }
  | { id: number; type: 'new_event';       event:   EventInfo; created_at: string; unread?: boolean }
  | { id: number; type: 'event_cancelled'; event:   EventInfo; created_at: string; unread?: boolean }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}

function Avatar({ user }: { user: UserInfo }) {
  if (user.avatar) {
    return <Image source={{ uri: user.avatar }} style={styles.avatarImg} />
  }
  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarLetter}>{user.name.charAt(0).toUpperCase()}</Text>
    </View>
  )
}

// ─── Notification cards ───────────────────────────────────────────────────────

function FriendRequestCard({
  n, onAccept, onDecline, acting,
}: {
  n: Extract<Notification, { type: 'friend_request' }>
  onAccept: () => void
  onDecline: () => void
  acting: boolean
}) {
  return (
    <View style={[styles.card, (n.unread ?? true) && styles.cardUnread]}>
      <View style={styles.cardRow}>
        <View style={[styles.iconWrap, { backgroundColor: 'rgba(57,255,20,0.1)' }]}>
          <Avatar user={n.sender} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>
            <Text style={styles.accent}>{n.sender.name}</Text>
            {' '}sent you a friend request
          </Text>
          <Text style={styles.cardTime}>{timeAgo(n.created_at)}</Text>
        </View>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          style={[styles.acceptBtn, acting && styles.btnDisabled]}
          onPress={onAccept}
          disabled={acting}
        >
          {acting
            ? <ActivityIndicator size="small" color="#041109" />
            : <Text style={styles.acceptLabel}>Accept</Text>
          }
        </Pressable>
        <Pressable
          style={[styles.declineBtn, acting && styles.btnDisabled]}
          onPress={onDecline}
          disabled={acting}
        >
          <Text style={styles.declineLabel}>Decline</Text>
        </Pressable>
      </View>
    </View>
  )
}

function GenericCard({
  icon, iconColor, iconBg, title, subtitle, time, onPress, unread,
}: {
  icon: string; iconColor: string; iconBg: string
  title: React.ReactNode; subtitle?: string; time: string
  onPress?: () => void; unread?: boolean
}) {
  return (
    <Pressable style={[styles.card, unread && styles.cardUnread]} onPress={onPress} disabled={!onPress}>
      <View style={styles.cardRow}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon as never} size={18} color={iconColor} />
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
          <Text style={styles.cardTime}>{time}</Text>
        </View>
        {onPress && <Ionicons name="chevron-forward" size={16} color={palette.textDim} />}
      </View>
    </Pressable>
  )
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const tabBarHeight = useBottomTabBarHeight()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading,       setLoading]       = useState(true)
  const [refreshing,    setRefreshing]    = useState(false)
  const [acting,        setActing]        = useState<number | null>(null)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const { data } = await api.get('/notifications')
      const items = (data.data ?? []) as Notification[]
      setNotifications(items)
      if (items.some(item => item.unread)) {
        api.post('/notifications/read').then(() => badgeEvents.clearAlerts()).catch(() => {})
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useFocusEffect(useCallback(() => {
    load()
    badgeEvents.clearAlerts()
  }, [load]))

  async function clearAll() {
    try {
      await api.delete('/notifications/clear-all')
    } catch {}
    setNotifications([])
    badgeEvents.clearAlerts()
  }

  async function accept(n: Extract<Notification, { type: 'friend_request' }>) {
    setActing(n.id)
    try {
      await api.post(`/friends/accept/${n.id}`)
      setNotifications(prev => prev.filter(x => x.id !== n.id))
    } catch {}
    finally { setActing(null) }
  }

  async function decline(n: Extract<Notification, { type: 'friend_request' }>) {
    setActing(n.id)
    try {
      await api.post(`/friends/decline/${n.id}`)
      setNotifications(prev => prev.filter(x => x.id !== n.id))
    } catch {}
    finally { setActing(null) }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={palette.accent}
            colors={[palette.accent]}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Notifications</Text>
          {notifications.length > 0 && (
            <Pressable onPress={clearAll} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Clear all</Text>
            </Pressable>
          )}
        </View>

        {loading && (
          <ActivityIndicator color={palette.accent} style={{ paddingVertical: spacing.xl }} />
        )}

        {!loading && notifications.length === 0 && (
          <View style={styles.emptyWrap}>
            <Ionicons name="notifications-off-outline" size={40} color={palette.textDim} />
            <Text style={styles.emptyText}>Nothing new</Text>
            <Text style={styles.emptyHint}>You're all caught up.</Text>
          </View>
        )}

        {!loading && notifications.map(n => {
          if (n.type === 'friend_request') {
            return (
              <FriendRequestCard
                key={`fr-${n.id}`}
                n={n}
                acting={acting === n.id}
                onAccept={() => accept(n)}
                onDecline={() => decline(n)}
              />
            )
          }

          if (n.type === 'friend_accepted') {
            return (
              <GenericCard
                key={`fa-${n.id}`}
                icon="people"
                iconColor={palette.accent}
                iconBg="rgba(57,255,20,0.1)"
                title={<><Text style={styles.accent}>{n.friend.name}</Text> accepted your friend request</>}
                time={timeAgo(n.created_at)}
                unread={n.unread ?? true}
              />
            )
          }

          if (n.type === 'event_reminder') {
            return (
              <GenericCard
                key={`er-${n.id}`}
                icon="alarm-outline"
                iconColor="#58beff"
                iconBg="rgba(0,168,255,0.1)"
                title={<>Reminder: <Text style={styles.accent}>{n.event.title}</Text></>}
                subtitle={`${formatEventDate(n.event.start_at)}${n.event.address ? ' · ' + n.event.address : ''}`}
                time={timeAgo(n.created_at)}
                onPress={() => router.push(`/event/${n.event.id}` as never)}
                unread={n.unread}
              />
            )
          }

          if (n.type === 'new_event') {
            return (
              <GenericCard
                key={`ne-${n.id}`}
                icon="calendar-outline"
                iconColor={palette.accent}
                iconBg="rgba(57,255,20,0.08)"
                title={<>New event: <Text style={styles.accent}>{n.event.title}</Text></>}
                subtitle={`${n.event.category} · ${formatEventDate(n.event.start_at)}${n.event.address ? ' · ' + n.event.address : ''}`}
                time={timeAgo(n.created_at)}
                onPress={() => router.push(`/event/${n.event.id}` as never)}
                unread={n.unread}
              />
            )
          }

          if (n.type === 'event_cancelled') {
            return (
              <GenericCard
                key={`ec-${n.id}`}
                icon="close-circle-outline"
                iconColor="#f87171"
                iconBg="rgba(248,113,113,0.1)"
                title={<>Event cancelled: <Text style={{ color: '#f87171' }}>{n.event.title}</Text></>}
                subtitle={n.event.address ?? undefined}
                time={timeAgo(n.created_at)}
                unread={n.unread}
              />
            )
          }

          return null
        })}

      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: palette.bg },
  content: { padding: spacing.lg, gap: spacing.md },

  header: { marginBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:  { color: palette.text, fontSize: 30, fontWeight: '800' },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: palette.line },
  clearBtnText: { color: palette.textDim, fontSize: 12, fontWeight: '700' },

  emptyWrap: { alignItems: 'center', paddingVertical: 56, gap: 10 },
  emptyText: { color: palette.text, fontSize: 16, fontWeight: '700' },
  emptyHint: { color: palette.textMuted, fontSize: 14 },

  card: {
    backgroundColor: palette.panel, borderRadius: 22,
    borderWidth: 1, borderColor: palette.line, padding: spacing.md, gap: 12,
  },
  cardUnread: {
    borderColor: 'rgba(57,255,20,0.7)',
    backgroundColor: 'rgba(57,255,20,0.045)',
    shadowColor: palette.accent,
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 3,
  },
  cardRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardBody: { flex: 1, gap: 3 },
  cardTitle:    { color: palette.text, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  cardSubtitle: { color: palette.textMuted, fontSize: 12, lineHeight: 17 },
  cardTime:     { color: palette.textDim, fontSize: 11, fontWeight: '600' },
  accent:       { color: palette.accent, fontWeight: '800' },

  iconWrap: {
    width: 46, height: 46, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarImg:      { width: 46, height: 46, borderRadius: 14 },
  avatarFallback: { width: 46, height: 46, borderRadius: 14, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  avatarLetter:   { color: '#041109', fontSize: 18, fontWeight: '800' },

  actionRow: { flexDirection: 'row', gap: 10 },
  acceptBtn: {
    flex: 1, height: 40, borderRadius: 12,
    backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center',
  },
  declineBtn: {
    flex: 1, height: 40, borderRadius: 12,
    borderWidth: 1, borderColor: palette.line,
    backgroundColor: palette.panelRaised, alignItems: 'center', justifyContent: 'center',
  },
  acceptLabel:  { color: '#041109', fontSize: 14, fontWeight: '800' },
  declineLabel: { color: palette.textMuted, fontSize: 14, fontWeight: '700' },
  btnDisabled:  { opacity: 0.5 },
})
