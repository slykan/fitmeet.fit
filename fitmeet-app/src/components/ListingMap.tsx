import { Ionicons } from '@expo/vector-icons'
import { useMemo } from 'react'
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'

import { palette } from '@/src/theme'

/**
 * Static map with a pin for a market listing (the API rounds the spot to ~1 km).
 * Not draggable so it doesn't fight the page scroll; a tap opens the maps app.
 */
export function ListingMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const html = useMemo(() => `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { margin:0; padding:0; height:100%; background:#111; }
  .fm-pin { width:22px; height:22px; border-radius:50% 50% 50% 0; background:#39FF14; transform:rotate(-45deg);
    border:2px solid #0b0b0b; box-shadow:0 2px 6px rgba(0,0,0,0.5); }
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  const map = L.map('map', {
    zoomControl:false, attributionControl:false, dragging:false, touchZoom:false,
    scrollWheelZoom:false, doubleClickZoom:false, boxZoom:false, keyboard:false, tap:false,
  }).setView([${lat}, ${lng}], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:18 }).addTo(map);
  L.circle([${lat}, ${lng}], { radius:900, color:'#39FF14', weight:1, fillColor:'#39FF14', fillOpacity:0.12 }).addTo(map);
  const icon = L.divIcon({ className:'', html:'<div class="fm-pin"></div>', iconSize:[22,22], iconAnchor:[11,24] });
  L.marker([${lat}, ${lng}], { icon }).addTo(map);
</script>
</body></html>`, [lat, lng])

  function openMaps() {
    const q = encodeURIComponent(label)
    const url = Platform.OS === 'ios'
      ? `http://maps.apple.com/?ll=${lat},${lng}&q=${q}`
      : `geo:${lat},${lng}?q=${lat},${lng}(${q})`
    Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`).catch(() => {}))
  }

  return (
    <View style={styles.wrap}>
      <WebView
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        scrollEnabled={false}
        style={styles.map}
        pointerEvents="none"
      />
      {/* the WebView ignores touches; this layer takes the tap */}
      <Pressable style={StyleSheet.absoluteFill} onPress={openMaps} />
      <View style={styles.badge} pointerEvents="none">
        <Ionicons name="location-outline" size={12} color="#fff" />
        <Text style={styles.badgeText}>Approximate location</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { height: 170, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panel },
  map: { flex: 1, backgroundColor: 'transparent' },
  badge: { position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
})
