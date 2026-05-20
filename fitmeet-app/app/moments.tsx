import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Dimensions, FlatList, Image, Modal,
  Pressable, Share, StyleSheet, Text, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { api } from '@/src/lib/api'
import { palette, spacing } from '@/src/theme'

interface Moment {
  id: number
  title: string
  image_url: string
  category: string | null
  start_at: string
}

const { width } = Dimensions.get('window')
const COLS = 3
const CELL = (width - spacing.md * 2 - 4 * (COLS - 1)) / COLS

const CAT_EMOJI: Record<string, string> = {
  running:'🏃', cycling:'🚴', hiking:'🥾', swimming:'🏊', football:'⚽',
  basketball:'🏀', tennis:'🎾', volleyball:'🏐', yoga:'🧘', fitness:'💪',
  martial_arts:'🥊', climbing:'🧗', skiing:'⛷️', skating:'⛸️', surfing:'🏄',
  golf:'⛳', social:'🎉', other:'📅',
}

export default function MomentsScreen() {
  const [moments,  setMoments]  = useState<Moment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [loadMore, setLoadMore] = useState(false)
  const [hasMore,  setHasMore]  = useState(false)
  const [page,     setPage]     = useState(1)
  const [lightbox, setLightbox] = useState<Moment | null>(null)

  async function load(p: number) {
    if (p === 1) setLoading(true); else setLoadMore(true)
    try {
      const r = await api.get(`/moments?page=${p}`)
      setMoments(prev => p === 1 ? r.data.data : [...prev, ...r.data.data])
      setHasMore(r.data.has_more)
      setPage(p)
    } catch {}
    finally { setLoading(false); setLoadMore(false) }
  }

  useEffect(() => { load(1) }, [])

  function handleShare() {
    Share.share({
      message: 'Check out FitMeet Moments — real people, real events 📸 https://fitmeet.fit/moments',
    })
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={palette.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Moments</Text>
          <Text style={styles.headerSub}>Real events, real people</Text>
          <Text style={styles.headerNote}>Organizers can add one photo after each event ends.</Text>
        </View>
        <Pressable onPress={handleShare} hitSlop={12}>
          <Ionicons name="share-social-outline" size={22} color={palette.accent} />
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={palette.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={moments}
          numColumns={COLS}
          keyExtractor={m => String(m.id)}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={{ gap: 4 }}
          ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => setLightbox(item)} style={styles.cell}>
              <Image source={{ uri: item.image_url }} style={styles.cellImg} resizeMode="cover" />
              {item.category && (
                <View style={styles.cellBadge}>
                  <Text style={styles.cellEmoji}>{CAT_EMOJI[item.category] ?? '📅'}</Text>
                </View>
              )}
            </Pressable>
          )}
          ListFooterComponent={
            hasMore ? (
              <Pressable style={styles.loadMore} onPress={() => load(page + 1)} disabled={loadMore}>
                {loadMore
                  ? <ActivityIndicator size="small" color={palette.accent} />
                  : <Text style={styles.loadMoreText}>Load more</Text>
                }
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No moments yet. Events with photos will appear here.</Text>
          }
        />
      )}

      {/* Lightbox */}
      <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <Pressable style={styles.lightboxOverlay} onPress={() => setLightbox(null)}>
          {lightbox && (
            <>
              <Image source={{ uri: lightbox.image_url }} style={styles.lightboxImg} resizeMode="contain" />
              <View style={styles.lightboxInfo}>
                <Text style={styles.lightboxEmoji}>{CAT_EMOJI[lightbox.category ?? ''] ?? '📅'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lightboxTitle} numberOfLines={2}>{lightbox.title}</Text>
                  <Text style={styles.lightboxDate}>
                    {new Date(lightbox.start_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <Pressable
                  onPress={() => { setLightbox(null); router.push(`/event/${lightbox.id}` as never) }}
                  hitSlop={12}
                >
                  <Ionicons name="arrow-forward-circle-outline" size={28} color={palette.accent} />
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerCenter: { alignItems: 'center', gap: 1 },
  headerTitle: { color: palette.text, fontSize: 17, fontWeight: '800' },
  headerSub:   { color: palette.textDim, fontSize: 11 },
  headerNote:  { color: palette.textDim, fontSize: 10, opacity: 0.6, textAlign: 'center', marginTop: 1 },

  grid: { padding: spacing.md, paddingTop: 12 },
  cell: {
    width: CELL, height: CELL, borderRadius: 10, overflow: 'hidden',
    backgroundColor: palette.panel,
  },
  cellImg: { width: '100%', height: '100%' },
  cellBadge: {
    position: 'absolute', bottom: 4, left: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  cellEmoji: { fontSize: 11 },

  loadMore: {
    alignItems: 'center', paddingVertical: 16, marginTop: 8,
  },
  loadMoreText: { color: palette.accent, fontSize: 14, fontWeight: '700' },

  empty: {
    color: palette.textDim, textAlign: 'center', marginTop: 60, fontSize: 14,
    paddingHorizontal: 32, lineHeight: 22,
  },

  lightboxOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center', alignItems: 'center',
  },
  lightboxImg: { width: '100%', height: '70%' },
  lightboxInfo: {
    position: 'absolute', bottom: 40, left: 20, right: 20,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 16, padding: 14,
  },
  lightboxEmoji: { fontSize: 28 },
  lightboxTitle: { color: palette.text, fontSize: 15, fontWeight: '700' },
  lightboxDate:  { color: palette.textDim, fontSize: 12, marginTop: 2 },
})
