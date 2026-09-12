import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View,
} from 'react-native'

import { api } from '@/src/lib/api'
import { palette, spacing } from '@/src/theme'

interface ActivityActor { id: number; name: string; avatar: string | null }
interface ActivityEvent { id: number; title: string; category: string; start_at: string; timezone: string; address: string | null; image_url: string | null }

interface ActivityItem {
  id: number
  type: 'event_joined' | 'event_created' | 'event_commented' | 'event_applauded'
  meta: { excerpt?: string } | null
  actor: ActivityActor
  event: ActivityEvent
  created_at: string
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function verb(item: ActivityItem): string {
  switch (item.type) {
    case 'event_joined':     return 'joined'
    case 'event_created':    return 'created'
    case 'event_commented':  return 'commented on'
    case 'event_applauded':  return 'applauded'
  }
}

function ActorAvatar({ actor }: { actor: ActivityActor }) {
  if (actor.avatar) {
    return <Image source={{ uri: actor.avatar }} style={styles.avatarImg} />
  }
  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarLetter}>{actor.name.charAt(0).toUpperCase()}</Text>
    </View>
  )
}

function ActivityCard({ item }: { item: ActivityItem }) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push(item.type === 'event_commented' ? `/event/${item.event.id}?wall=1` as never : `/event/${item.event.id}` as never)}
    >
      <View style={styles.cardRow}>
        <ActorAvatar actor={item.actor} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>
            <Text style={styles.accent}>{item.actor.name}</Text>
            {' '}{verb(item)}{' '}
            <Text style={styles.accent}>{item.event.title}</Text>
          </Text>
          {item.type === 'event_commented' && item.meta?.excerpt && (
            <Text style={styles.cardSubtitle} numberOfLines={2}>&quot;{item.meta.excerpt}&quot;</Text>
          )}
          <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
        </View>
        {item.event.image_url && (
          <Image source={{ uri: item.event.image_url }} style={styles.eventThumb} />
        )}
      </View>
    </Pressable>
  )
}

export function ActivityFeed() {
  const [items,      setItems]      = useState<ActivityItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,    setHasMore]    = useState(false)

  const load = useCallback(async (before?: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else if (before) setLoadingMore(true)
    else setLoading(true)
    try {
      const { data } = await api.get('/feed', { params: before ? { before } : undefined })
      setItems(prev => before ? [...prev, ...data.data] : data.data)
      setHasMore(!!data.has_more)
    } catch {}
    finally { setLoading(false); setRefreshing(false); setLoadingMore(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <FlatList
      style={{ flex: 1 }}
      data={items}
      keyExtractor={item => String(item.id)}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(undefined, true)}
          tintColor={palette.accent}
          colors={[palette.accent]}
        />
      }
      renderItem={({ item }) => <ActivityCard item={item} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasMore && !loadingMore && items.length > 0) {
          load(items[items.length - 1].created_at)
        }
      }}
      ListFooterComponent={loadingMore ? (
        <ActivityIndicator color={palette.accent} style={{ paddingVertical: spacing.lg }} />
      ) : null}
      ListEmptyComponent={!loading ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="pulse-outline" size={40} color={palette.textDim} />
          <Text style={styles.emptyText}>Nothing from friends yet</Text>
          <Text style={styles.emptyHint}>When friends join, create, or comment on events, it'll show up here.</Text>
        </View>
      ) : null}
      ListHeaderComponent={loading ? (
        <ActivityIndicator color={palette.accent} style={{ paddingVertical: spacing.xl }} />
      ) : null}
    />
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, paddingTop: spacing.md, flexGrow: 1 },

  emptyWrap: { alignItems: 'center', paddingVertical: 56, gap: 10 },
  emptyText: { color: palette.text, fontSize: 16, fontWeight: '700' },
  emptyHint: { color: palette.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },

  card: {
    backgroundColor: palette.panel, borderRadius: 22,
    borderWidth: 1, borderColor: palette.line, padding: spacing.md,
  },
  cardRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardBody: { flex: 1, gap: 3 },
  cardTitle:    { color: palette.text, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  cardSubtitle: { color: palette.textMuted, fontSize: 12, lineHeight: 17 },
  cardTime:     { color: palette.textDim, fontSize: 11, fontWeight: '600' },
  accent:       { color: palette.accent, fontWeight: '800' },

  avatarImg:      { width: 46, height: 46, borderRadius: 14 },
  avatarFallback: { width: 46, height: 46, borderRadius: 14, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  avatarLetter:   { color: '#041109', fontSize: 18, fontWeight: '800' },

  eventThumb: { width: 46, height: 46, borderRadius: 14 },
})
