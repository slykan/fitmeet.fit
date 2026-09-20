import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Dimensions, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { palette, spacing } from '@/src/theme'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

interface WikiPhoto {
  title: string
  thumbUrl: string
  pageUrl: string
}

type Point = [number, number]

function sampleRoutePoints(track: Point[], maxPoints = 8): Point[] {
  if (track.length <= maxPoints) return track
  const last = track.length - 1
  return Array.from({ length: maxPoints }, (_, index) => track[Math.round((index / (maxPoints - 1)) * last)])
}

async function wikiPost(params: Record<string, string>): Promise<unknown> {
  const body = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const r = await fetch('https://commons.wikimedia.org/w/api.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'FitMeet/1.0 (https://fitmeet.fit)',
    },
    body,
  })
  const text = await r.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`HTTP ${r.status}: ${text.substring(0, 100)}`)
  }
}

async function fetchWikiPhotos(points: Point[]): Promise<WikiPhoto[]> {
  const geoResults = await Promise.all(points.map(([lat, lng]) => wikiPost({
    action: 'query',
    list: 'geosearch',
    gscoord: `${lat}|${lng}`,
    gsradius: '5000',
    gslimit: '5',
    gsnamespace: '6',
    format: 'json',
  }) as Promise<{ query?: { geosearch?: Array<{ title: string }> } }>))

  const perPoint = geoResults.map(geo => (geo.query?.geosearch ?? []).map(item => item.title))
  const seen = new Set<string>()
  const items: string[] = []
  const maxLen = Math.max(0, ...perPoint.map(p => p.length))
  for (let i = 0; i < maxLen && items.length < 24; i++) {
    for (const titles of perPoint) {
      if (i < titles.length && !seen.has(titles[i])) {
        seen.add(titles[i])
        items.push(titles[i])
      }
    }
  }
  if (!items.length) return []

  const titles = items
    .map(title => title.replace(/[^\x00-\x7E]/g, c => encodeURIComponent(c)))
    .join('|')

  const info = await wikiPost({
    action: 'query',
    titles,
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '400',
    format: 'json',
  }) as { query?: { pages?: Record<string, { title: string; imageinfo?: Array<{ thumburl: string }> }> } }

  const pages = Object.values(info.query?.pages ?? {})

  return pages
    .filter(p => p.imageinfo?.[0]?.thumburl)
    .map(p => ({
      title: p.title.replace('File:', '').replace(/_/g, ' ').replace(/\.[^.]+$/, ''),
      thumbUrl: p.imageinfo![0].thumburl,
      pageUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
    }))
    .slice(0, 8)
}

export function WikiPhotosStrip({ lat, lng, track }: { lat?: number; lng?: number; track?: Point[] }) {
  const [photos, setPhotos] = useState<WikiPhoto[]>([])
  const [loaded, setLoaded] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  useEffect(() => {
    const points = track?.length
      ? sampleRoutePoints(track)
      : lat != null && lng != null
        ? [[lat, lng] as Point]
        : []

    if (!points.length) {
      setPhotos([])
      setLoaded(true)
      return
    }

    setLoaded(false)
    setErr(null)
    fetchWikiPhotos(points)
      .then(setPhotos)
      .catch(e => setErr(String(e)))
      .finally(() => setLoaded(true))
  }, [lat, lng, track])

  if (!loaded) {
    return (
      <View style={styles.debug}>
        <Text style={styles.debugText}>Loading route photos...</Text>
      </View>
    )
  }

  if (err) {
    return (
      <View style={styles.debug}>
        <Text style={styles.debugText}>📷 Error: {err}</Text>
      </View>
    )
  }

  if (photos.length === 0) {
    return null
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="camera-outline" size={14} color={palette.accent} />
        <Text style={styles.headerText}>Along the route</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {photos.map((photo, i) => (
          <Pressable
            key={i}
            style={styles.card}
            onPress={() => setViewerIndex(i)}
          >
            <Image
              source={{ uri: photo.thumbUrl, headers: { 'User-Agent': 'FitMeet/1.0 (https://fitmeet.fit)' } }}
              style={styles.image}
            />
            <View style={styles.overlay}>
              <Text style={styles.photoTitle} numberOfLines={1}>{photo.title}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.attribution}>Photos via Wikimedia Commons · CC licensed</Text>

      <Modal visible={viewerIndex !== null} transparent animationType="fade" onRequestClose={() => setViewerIndex(null)}>
        <View style={styles.viewerOverlay}>
          <Pressable style={styles.viewerClose} onPress={() => setViewerIndex(null)} hitSlop={12}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          {viewerIndex !== null && (
            <FlatList
              data={photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={viewerIndex}
              getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
              keyExtractor={(_, index) => String(index)}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
                setViewerIndex(index)
              }}
              renderItem={({ item }) => (
                <View style={styles.viewerSlide}>
                  <Image source={{ uri: item.thumbUrl, headers: { 'User-Agent': 'FitMeet/1.0 (https://fitmeet.fit)' } }} style={styles.viewerImage} resizeMode="contain" />
                  <Text style={styles.viewerTitle} numberOfLines={2}>{item.title}</Text>
                </View>
              )}
            />
          )}
          <Text style={styles.viewerCounter}>{(viewerIndex ?? 0) + 1} / {photos.length}</Text>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  debug: { paddingVertical: 6 },
  debugText: { color: palette.textMuted, fontSize: 11 },
  container: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerText: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  scroll: { gap: 10, paddingBottom: 2 },
  card: {
    width: 180,
    height: 126,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: palette.panel,
  },
  image: { width: '100%', height: '100%' },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  photoTitle: { color: 'rgba(255,255,255,0.88)', fontSize: 10, fontWeight: '600' },
  attribution: { color: palette.textMuted, fontSize: 10 },
  viewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center' },
  viewerClose: { position: 'absolute', top: 50, right: 20, zIndex: 1, padding: 6 },
  viewerSlide: { width: SCREEN_WIDTH, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 20 },
  viewerImage: { width: SCREEN_WIDTH - 40, height: '70%' },
  viewerTitle: { color: '#fff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  viewerCounter: { position: 'absolute', bottom: 40, alignSelf: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 12 },
})
