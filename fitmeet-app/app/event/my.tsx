import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Image, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { CATEGORIES } from '@/src/lib/categories'
import { api } from '@/src/lib/api'
import { palette, spacing } from '@/src/theme'

interface EventItem {
  id: number
  title: string
  category: { value: string; label: string }
  schedule: { start_at: string; timezone: string; duration_minutes: number | null }
  location: { address: string | null }
  participants_count: number
  max_participants: number | null
  status: string
  is_full: boolean
  image_url: string | null
}

const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.emoji])
)

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function MyEventsScreen() {
  const [events,    setEvents]    = useState<EventItem[]>([])
  const [loading,   setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [cancelling, setCancelling] = useState<number | null>(null)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    try {
      const { data } = await api.get('/events/my')
      setEvents(data.data ?? [])
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function confirmCancel(ev: EventItem) {
    Alert.alert(
      'Cancel event',
      `Cancel "${ev.title}"? This cannot be undone.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel event', style: 'destructive',
          onPress: async () => {
            setCancelling(ev.id)
            try {
              await api.delete(`/events/${ev.id}`)
              await load()
            } catch {
              Alert.alert('Error', 'Could not cancel event.')
            } finally { setCancelling(null) }
          },
        },
      ]
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </Pressable>
        <Text style={styles.title}>My Events</Text>
        <Pressable
          style={styles.createBtn}
          onPress={() => router.push('/event/create' as never)}
        >
          <Ionicons name="add" size={20} color="#041109" />
          <Text style={styles.createBtnText}>New</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={palette.accent}
            />
          }
        >
          {events.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyText}>No events yet</Text>
              <Pressable
                style={styles.emptyBtn}
                onPress={() => router.push('/event/create' as never)}
              >
                <Text style={styles.emptyBtnText}>Create your first event</Text>
              </Pressable>
            </View>
          )}

          {events.map(ev => {
            const cancelled = ev.status === 'cancelled'
            const past      = new Date(ev.schedule.start_at).getTime() < Date.now()
            const emoji     = CATEGORY_EMOJI[ev.category.value] ?? '📍'

            return (
              <Pressable
                key={ev.id}
                style={[styles.card, cancelled && styles.cardCancelled, past && !cancelled && styles.cardPast]}
                onPress={() => router.push(`/event/${ev.id}` as never)}
              >
                {ev.image_url ? (
                  <Image source={{ uri: ev.image_url }} style={styles.cardImage} resizeMode="cover" />
                ) : null}

                <View style={styles.cardRow}>
                  <View style={styles.emojiBadge}>
                    <Text style={{ fontSize: 20 }}>{emoji}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{ev.title}</Text>
                    <Text style={styles.cardMeta}>
                      {formatDate(ev.schedule.start_at)}
                    </Text>
                    <Text style={styles.cardMeta}>
                      {ev.participants_count} joined
                      {ev.max_participants ? ` · max ${ev.max_participants}` : ''}
                      {cancelled ? ' · Cancelled' : past ? ' · Past' : ev.is_full ? ' · Full' : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={palette.textDim} />
                </View>

                {!cancelled && !past && (
                  <View style={styles.actions}>
                    <Pressable
                      style={styles.editBtn}
                      onPress={() => router.push(`/event/edit/${ev.id}` as never)}
                    >
                      <Ionicons name="create-outline" size={13} color={palette.accent} />
                      <Text style={styles.editBtnText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      style={styles.cancelBtn}
                      onPress={() => confirmCancel(ev)}
                      disabled={cancelling === ev.id}
                    >
                      {cancelling === ev.id ? (
                        <ActivityIndicator size="small" color="#f87171" />
                      ) : (
                        <>
                          <Ionicons name="close-outline" size={13} color="#f87171" />
                          <Text style={styles.cancelBtnText}>Cancel</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                )}
              </Pressable>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { flex: 1, color: palette.text, fontSize: 20, fontWeight: '800' },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 38, paddingHorizontal: 14, borderRadius: 12,
    backgroundColor: palette.accent,
  },
  createBtnText: { color: '#041109', fontSize: 13, fontWeight: '800' },

  list:  { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  empty: { alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: palette.textMuted, fontSize: 16 },
  emptyBtn: {
    height: 48, paddingHorizontal: 24, borderRadius: 14,
    backgroundColor: palette.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyBtnText: { color: '#041109', fontSize: 14, fontWeight: '800' },

  card: {
    backgroundColor: palette.panel, borderRadius: 18,
    borderWidth: 1, borderColor: palette.line,
    overflow: 'hidden', gap: 0,
  },
  cardCancelled: { opacity: 0.6, borderColor: 'rgba(248,113,113,0.3)' },
  cardPast:      { opacity: 0.65 },
  cardImage:     { width: '100%', height: 120 },
  cardRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  emojiBadge: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: palette.panelRaised,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { color: palette.text, fontSize: 15, fontWeight: '800' },
  cardMeta:  { color: palette.textMuted, fontSize: 12 },

  actions: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingBottom: spacing.md,
  },
  editBtn: {
    flex: 1, height: 36, borderRadius: 10,
    borderWidth: 1, borderColor: palette.accent,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  editBtnText: { color: palette.accent, fontSize: 12, fontWeight: '700' },
  cancelBtn: {
    flex: 1, height: 36, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.4)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  cancelBtnText: { color: '#f87171', fontSize: 12, fontWeight: '700' },
})
