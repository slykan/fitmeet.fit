import { Ionicons } from '@expo/vector-icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import type { WebView as WebViewType } from 'react-native-webview'

import { palette } from '@/src/theme'

export type ReplayPoint = {
  lat: number
  lng: number
  speed_kmh: number | null
  recorded_at: string
}

type Props = {
  points: ReplayPoint[]
}

type PlayState = 'idle' | 'playing' | 'paused'

// Mirrors the pacing used by the planned-route "play" animation on the event
// screen (1500ms per unit), scaled by real recorded minutes instead of km,
// and clamped so a short event isn't a blink and a long one isn't a slog.
const ANIM_MS_PER_REAL_MINUTE = 1500
const ANIM_DURATION_MIN_MS = 8000
const ANIM_DURATION_MAX_MS = 60000
const SPEED_STEPS = [1, 2, 4]
const PROGRESS_UPDATE_INTERVAL_MS = 1000 / 20

function buildHtml(points: ReplayPoint[]) {
  const coords = points.map((p) => [p.lat, p.lng])
  const coordsJson = JSON.stringify(coords)

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    html,body,#map{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#050816;}
    .leaflet-control-attribution{display:none;}
    .fm-head{background:transparent;border:0;}
    .fm-head-dot{
      width:14px;height:14px;border-radius:999px;
      background:#ff3b30;border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,0.5);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const points = ${coordsJson};
    const map = L.map('map', { zoomControl:false, attributionControl:false, preferCanvas:true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(map);

    const fullLine = L.polyline(points, { color:'rgba(255,255,255,0.35)', weight:3 }).addTo(map);
    const traveledLine = L.polyline([], { color:'#ff3b30', weight:4 }).addTo(map);
    const headIcon = L.divIcon({ className:'fm-head', html:'<div class="fm-head-dot"></div>', iconSize:[14,14], iconAnchor:[7,7] });
    const headMarker = L.marker(points[0], { icon: headIcon }).addTo(map);

    map.fitBounds(fullLine.getBounds(), { padding:[28,28] });

    function send(type, payload) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...(payload || {}) }));
    }

    function setProgress(index, frac, followCamera) {
      const upto = points.slice(0, index + 1);
      const a = points[index];
      const b = points[index + 1];
      if (frac > 0 && b) {
        upto.push([a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac]);
      }
      traveledLine.setLatLngs(upto);
      const head = upto.length ? upto[upto.length - 1] : points[0];
      headMarker.setLatLng(head);
      if (followCamera) map.panTo(head, { animate:false });
    }

    function handleMessage(event) {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') setProgress(data.index, data.frac, data.followCamera);
        if (data.type === 'reset') {
          traveledLine.setLatLngs([]);
          headMarker.setLatLng(points[0]);
          map.fitBounds(fullLine.getBounds(), { padding:[28,28] });
        }
      } catch (e) {}
    }
    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);
  </script>
</body>
</html>`
}

function indexForElapsed(elapsedMsList: number[], elapsedMs: number): { index: number; frac: number } {
  let lo = 0
  let hi = elapsedMsList.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (elapsedMsList[mid] <= elapsedMs) lo = mid
    else hi = mid - 1
  }
  const next = elapsedMsList[lo + 1]
  const frac = next != null && next > elapsedMsList[lo]
    ? Math.min(1, (elapsedMs - elapsedMsList[lo]) / (next - elapsedMsList[lo]))
    : 0
  return { index: lo, frac }
}

export function RouteReplayMap({ points }: Props) {
  const webViewRef = useRef<WebViewType>(null)
  const [playState, setPlayState] = useState<PlayState>('idle')
  const [speedStepIndex, setSpeedStepIndex] = useState(0)
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState<number | null>(null)
  const elapsedMsRef = useRef(0)
  const speedRef = useRef(SPEED_STEPS[0])
  const frameRef = useRef<number | null>(null)

  const elapsedMsList = useMemo(
    () => points.map((p) => new Date(p.recorded_at).getTime() - new Date(points[0].recorded_at).getTime()),
    [points],
  )
  const totalRealMs = elapsedMsList[elapsedMsList.length - 1] ?? 0
  const animDurationMs = Math.min(
    ANIM_DURATION_MAX_MS,
    Math.max(ANIM_DURATION_MIN_MS, (totalRealMs / 60000) * ANIM_MS_PER_REAL_MINUTE),
  )

  const html = useMemo(() => buildHtml(points), [points])
  const source = useMemo(() => ({ html }), [html])

  useEffect(() => {
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  useEffect(() => {
    // New track: stop any running animation and reset to the start.
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
    setPlayState('idle')
    setSpeedStepIndex(0)
    speedRef.current = SPEED_STEPS[0]
    elapsedMsRef.current = 0
    setCurrentSpeedKmh(null)
  }, [points])

  function pushProgress(elapsedMs: number, followCamera: boolean) {
    const { index, frac } = indexForElapsed(elapsedMsList, elapsedMs)
    webViewRef.current?.postMessage(JSON.stringify({ type: 'progress', index, frac, followCamera }))
    setCurrentSpeedKmh(points[index]?.speed_kmh ?? null)
  }

  function runAnimation(resumeFromMs: number) {
    setPlayState('playing')
    let virtualElapsed = (resumeFromMs / totalRealMs) * animDurationMs || 0
    let lastFrameTime = performance.now()
    let lastUpdateTime = 0
    const step = (now: number) => {
      const dt = now - lastFrameTime
      lastFrameTime = now
      virtualElapsed += dt * speedRef.current
      const progress = Math.min(1, virtualElapsed / animDurationMs)
      const realElapsed = progress * totalRealMs
      elapsedMsRef.current = realElapsed

      if (progress >= 1 || now - lastUpdateTime >= PROGRESS_UPDATE_INTERVAL_MS) {
        lastUpdateTime = now
        pushProgress(realElapsed, true)
      }

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      } else {
        setPlayState('idle')
      }
    }
    frameRef.current = requestAnimationFrame(step)
  }

  function handlePlayToggle() {
    if (playState === 'playing') {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
      setPlayState('paused')
      return
    }
    const resumeFrom = playState === 'paused' ? elapsedMsRef.current : 0
    if (playState === 'idle') {
      webViewRef.current?.postMessage(JSON.stringify({ type: 'reset' }))
    }
    runAnimation(resumeFrom)
  }

  function toggleSpeed() {
    const next = (speedStepIndex + 1) % SPEED_STEPS.length
    setSpeedStepIndex(next)
    speedRef.current = SPEED_STEPS[next]
  }

  if (points.length < 2) return null

  return (
    <View style={styles.card}>
      <WebView
        ref={webViewRef}
        source={source}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        style={styles.webview}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Pressable style={[styles.toggleBtn, playState === 'playing' && styles.toggleBtnActive]} onPress={handlePlayToggle} hitSlop={8}>
            <Ionicons
              name={playState === 'playing' ? 'pause' : 'play'}
              size={15}
              color={playState === 'playing' ? '#031109' : palette.text}
              style={playState !== 'playing' ? { marginLeft: 1 } : undefined}
            />
          </Pressable>
          {playState !== 'idle' && (
            <Pressable style={[styles.toggleBtn, speedStepIndex > 0 && styles.toggleBtnActive]} onPress={toggleSpeed} hitSlop={8}>
              <Text style={[styles.speedText, speedStepIndex > 0 && styles.speedTextActive]}>{SPEED_STEPS[speedStepIndex]}x</Text>
            </Pressable>
          )}
        </View>
        {playState !== 'idle' && currentSpeedKmh != null && (
          <View style={styles.speedPill}>
            <Text style={styles.speedPillText}>{currentSpeedKmh.toFixed(1)} km/h</Text>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    height: 320,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: '#060c1a',
  },
  webview: { flex: 1, backgroundColor: 'transparent' },
  overlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  toggleBtn: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(7,13,28,0.78)',
    borderWidth: 1, borderColor: palette.line,
  },
  toggleBtnActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  speedText: { color: palette.text, fontSize: 12, fontWeight: '800' },
  speedTextActive: { color: '#031109' },
  speedPill: {
    backgroundColor: 'rgba(7,13,28,0.78)',
    borderWidth: 1, borderColor: palette.line,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
  },
  speedPillText: { color: palette.text, fontSize: 12, fontWeight: '700' },
})
