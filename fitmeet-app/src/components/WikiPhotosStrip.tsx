import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { palette, spacing } from '@/src/theme'

interface WikiPhoto {
  title: string
  thumbUrl: string
  pageUrl: string
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

async function fetchWikiPhotos(lat: number, lng: number): Promise<WikiPhoto[]> {
  const geo = await wikiPost({
    action: 'query',
    list: 'geosearch',
    gscoord: `${lat}|${lng}`,
    gsradius: '10000',
    gslimit: '20',
    gsnamespace: '6',
    format: 'json',
  }) as { query?: { geosearch?: Array<{ title: string }> } }

  const items = geo.query?.geosearch ?? []
  if (!items.length) return []

  const titles = items
    .map(i => i.title.replace(/[^\x00-\x7E]/g, c => encodeURIComponent(c)))
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

export function WikiPhotosStrip({ lat, lng }: { lat: number; lng: number }) {
  const [photos, setPhotos] = useState<WikiPhoto[]>([])
  const [loaded, setLoaded] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetchWikiPhotos(lat, lng)
      .then(setPhotos)
      .catch(e => setErr(String(e)))
      .finally(() => setLoaded(true))
  }, [lat, lng])

  if (!loaded) {
    return (
      <View style={styles.debug}>
        <Text style={styles.debugText}>📷 Loading nearby photos… ({lat.toFixed(4)}, {lng.toFixed(4)})</Text>
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
    return (
      <View style={styles.debug}>
        <Text style={styles.debugText}>📷 No photos found nearby ({lat.toFixed(4)}, {lng.toFixed(4)})</Text>
      </View>
    )
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
            onPress={() => Linking.openURL(photo.pageUrl)}
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
})
