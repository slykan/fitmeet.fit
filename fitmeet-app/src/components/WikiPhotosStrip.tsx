import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { palette, spacing } from '@/src/theme'

interface WikiPhoto {
  title: string
  thumbUrl: string
  pageUrl: string
}

async function fetchWikiPhotos(lat: number, lng: number): Promise<WikiPhoto[]> {
  const base = 'https://commons.wikimedia.org/w/api.php'

  const geoUrl = `${base}?action=query&list=geosearch&gscoord=${lat}%7C${lng}&gsradius=10000&gslimit=20&gsnamespace=6&format=json&origin=*`
  const geo = await fetch(geoUrl).then(r => r.json())

  const items: Array<{ title: string }> = geo.query?.geosearch ?? []
  if (!items.length) return []

  // Encode only non-ASCII characters, keep | and : as-is
  const titles = items
    .map(i => i.title.replace(/[^\x00-\x7E]/g, c => encodeURIComponent(c)))
    .join('|')

  const infoUrl = `${base}?action=query&titles=${titles}&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`
  const info = await fetch(infoUrl).then(r => r.json())

  const pages = Object.values(info.query?.pages ?? {}) as Array<{
    title: string
    imageinfo?: Array<{ thumburl: string }>
  }>

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

  // Debug: always show something so user can report what they see
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
            <Image source={{ uri: photo.thumbUrl }} style={styles.image} />
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
