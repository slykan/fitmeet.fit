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

export type ReplayTrack = {
  id: number
  name: string
  avatar: string | null
  points: ReplayPoint[]
}

type Props = {
  tracks: ReplayTrack[]
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
// Riders whose screen positions land within this many pixels of each other
// are merged into a single cluster badge, same threshold live tracking uses.
const CLUSTER_PIXEL_DISTANCE = 40

function buildHtml(tracksJson: string) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    html,body,#map{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#050816;}
    .leaflet-control-attribution{display:none;}
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const tracks = ${tracksJson};
    const map = L.map('map', { zoomControl:false, attributionControl:false, preferCanvas:true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(map);

    let bounds = null;
    const traveledLines = {};
    tracks.forEach(function(t) {
      L.polyline(t.coords, { color:'rgba(255,255,255,0.35)', weight:3 }).addTo(map);
      traveledLines[t.id] = L.polyline([], { color:'#39ff14', weight:4 }).addTo(map);
      const b = L.latLngBounds(t.coords);
      bounds = bounds ? bounds.extend(b) : b;
    });
    if (bounds) map.fitBounds(bounds, { padding:[28,28] });

    function initialsFor(name) {
      const parts = (name || '?').trim().split(/\\s+/).filter(Boolean);
      if (parts.length === 0) return '?';
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    function speedBadgeHtml(speed) {
      return speed != null
        ? '<div style="margin-top:2px;background:#0b1120;border:1px solid rgba(57,255,20,0.5);color:#eafff0;font-size:9px;font-weight:700;padding:1px 5px;border-radius:999px;white-space:nowrap;">' + speed.toFixed(1) + ' km/h</div>'
        : '';
    }
    function riderIconHtml(p) {
      const avatarHtml = p.avatar
        ? '<div style="width:32px;height:32px;border-radius:999px;background:#0b1120;background-image:url(\\'' + p.avatar + '\\');background-size:cover;background-position:center;border:2px solid #39ff14;box-shadow:0 2px 6px rgba(0,0,0,0.5);"></div>'
        : '<div style="width:32px;height:32px;border-radius:999px;background:#0b1120;border:2px solid #39ff14;display:flex;align-items:center;justify-content:center;color:#eafff0;font-weight:800;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,0.5);">' + initialsFor(p.name) + '</div>';
      return '<div style="display:flex;flex-direction:column;align-items:center;">' + avatarHtml + speedBadgeHtml(p.speed) + '</div>';
    }
    function clusterIconHtml(count, avgSpeed) {
      return '<div style="display:flex;flex-direction:column;align-items:center;">' +
        '<div style="width:34px;height:34px;border-radius:999px;background:#39ff14;color:#041109;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.5);border:2px solid #0b1120;">' + count + '</div>' +
        speedBadgeHtml(avgSpeed) + '</div>';
    }

    let riderMarkers = {};
    let clusterMarkers = {};
    let riderIconCache = {};
    let clusterIconCache = {};
    function riderDivIcon(p) {
      const key = p.id + '|' + (p.avatar || '') + '|' + (p.speed != null ? Math.round(p.speed) : 'x');
      if (riderIconCache[key]) return riderIconCache[key];
      const icon = L.divIcon({ className:'fm-rider-marker', html: riderIconHtml(p), iconSize:[60,50], iconAnchor:[30,25] });
      riderIconCache[key] = icon;
      return icon;
    }
    function clusterDivIcon(count, avgSpeed) {
      const key = count + '|' + (avgSpeed != null ? Math.round(avgSpeed) : 'x');
      if (clusterIconCache[key]) return clusterIconCache[key];
      const icon = L.divIcon({ className:'fm-cluster-marker', html: clusterIconHtml(count, avgSpeed), iconSize:[60,50], iconAnchor:[30,17] });
      clusterIconCache[key] = icon;
      return icon;
    }

    function recomputeDisplay(positions) {
      if (!positions.length) {
        Object.keys(riderMarkers).forEach(function(id) { map.removeLayer(riderMarkers[id]); });
        riderMarkers = {};
        Object.keys(clusterMarkers).forEach(function(key) { map.removeLayer(clusterMarkers[key]); });
        clusterMarkers = {};
        return;
      }

      const pts = positions.map(function(p) { return { p: p, pt: map.latLngToContainerPoint([p.lat, p.lng]) }; });
      const used = new Array(pts.length).fill(false);
      const groups = [];
      for (let i = 0; i < pts.length; i++) {
        if (used[i]) continue;
        const group = [pts[i]];
        used[i] = true;
        for (let j = i + 1; j < pts.length; j++) {
          if (used[j]) continue;
          const dx = pts[i].pt.x - pts[j].pt.x;
          const dy = pts[i].pt.y - pts[j].pt.y;
          if (Math.sqrt(dx * dx + dy * dy) < ${CLUSTER_PIXEL_DISTANCE}) {
            group.push(pts[j]);
            used[j] = true;
          }
        }
        groups.push(group);
      }

      const nextIds = {};
      const nextClusterKeys = {};

      groups.forEach(function(group) {
        if (group.length === 1) {
          const p = group[0].p;
          nextIds[p.id] = true;
          const existing = riderMarkers[p.id];
          if (existing) {
            existing.setLatLng([p.lat, p.lng]);
            existing.setIcon(riderDivIcon(p));
          } else {
            riderMarkers[p.id] = L.marker([p.lat, p.lng], { icon: riderDivIcon(p) }).addTo(map);
          }
        } else {
          const key = group.map(function(g) { return g.p.id; }).sort().join('-');
          nextClusterKeys[key] = true;
          let sumLat = 0, sumLng = 0, speedSum = 0, speedCount = 0;
          group.forEach(function(g) {
            sumLat += g.p.lat; sumLng += g.p.lng;
            if (g.p.speed != null) { speedSum += g.p.speed; speedCount++; }
          });
          const centroid = [sumLat / group.length, sumLng / group.length];
          const avgSpeed = speedCount > 0 ? speedSum / speedCount : null;
          const icon = clusterDivIcon(group.length, avgSpeed);
          const existing = clusterMarkers[key];
          if (existing) {
            existing.setLatLng(centroid);
            existing.setIcon(icon);
          } else {
            clusterMarkers[key] = L.marker(centroid, { icon: icon }).addTo(map);
          }
        }
      });

      Object.keys(riderMarkers).forEach(function(id) {
        if (!nextIds[id]) { map.removeLayer(riderMarkers[id]); delete riderMarkers[id]; }
      });
      Object.keys(clusterMarkers).forEach(function(key) {
        if (!nextClusterKeys[key]) { map.removeLayer(clusterMarkers[key]); delete clusterMarkers[key]; }
      });
    }
    map.on('zoomend', function() { recomputeDisplay(lastPositions); });

    function indexForElapsed(elapsedMsList, elapsedMs) {
      let lo = 0, hi = elapsedMsList.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (elapsedMsList[mid] <= elapsedMs) lo = mid; else hi = mid - 1;
      }
      const next = elapsedMsList[lo + 1];
      const frac = next != null && next > elapsedMsList[lo]
        ? Math.min(1, (elapsedMs - elapsedMsList[lo]) / (next - elapsedMsList[lo]))
        : 0;
      return { index: lo, frac: frac };
    }

    let lastPositions = [];
    function setProgress(elapsedMs, followCamera) {
      const positions = [];
      tracks.forEach(function(t) {
        const r = indexForElapsed(t.elapsedMsList, elapsedMs);
        const a = t.coords[r.index];
        const b = t.coords[r.index + 1];
        const lat = b ? a[0] + (b[0] - a[0]) * r.frac : a[0];
        const lng = b ? a[1] + (b[1] - a[1]) * r.frac : a[1];
        positions.push({ id: t.id, name: t.name, avatar: t.avatar, lat: lat, lng: lng, speed: t.speeds[r.index] });
        const upto = t.coords.slice(0, r.index + 1);
        if (r.frac > 0 && b) upto.push([lat, lng]);
        traveledLines[t.id].setLatLngs(upto);
      });
      lastPositions = positions;
      recomputeDisplay(positions);
      if (followCamera && positions.length === 1) map.panTo([positions[0].lat, positions[0].lng], { animate:false });
    }
    function handleMessage(event) {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') setProgress(data.elapsedMs, data.followCamera);
        if (data.type === 'reset') {
          tracks.forEach(function(t) { traveledLines[t.id].setLatLngs([]); });
          lastPositions = [];
          recomputeDisplay([]);
          if (bounds) map.fitBounds(bounds, { padding:[28,28] });
        }
      } catch (e) {}
    }
    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);
  </script>
</body>
</html>`
}

export function RouteReplayMap({ tracks }: Props) {
  const webViewRef = useRef<WebViewType>(null)
  const [playState, setPlayState] = useState<PlayState>('idle')
  const [speedStepIndex, setSpeedStepIndex] = useState(0)
  const elapsedMsRef = useRef(0)
  const speedRef = useRef(SPEED_STEPS[0])
  const frameRef = useRef<number | null>(null)

  const validTracks = useMemo(() => tracks.filter((t) => t.points.length >= 2), [tracks])

  // All riders are animated against one shared real-world clock (earliest
  // start to latest finish across everyone), not their own individual spans,
  // so relative pacing between riders stays meaningful when replaying "All".
  const commonStartMs = useMemo(
    () => Math.min(...validTracks.map((t) => new Date(t.points[0].recorded_at).getTime())),
    [validTracks],
  )
  const totalRealMs = useMemo(() => {
    const commonEndMs = Math.max(...validTracks.map((t) => new Date(t.points[t.points.length - 1].recorded_at).getTime()))
    return Math.max(0, commonEndMs - commonStartMs)
  }, [validTracks, commonStartMs])

  const animDurationMs = Math.min(
    ANIM_DURATION_MAX_MS,
    Math.max(ANIM_DURATION_MIN_MS, (totalRealMs / 60000) * ANIM_MS_PER_REAL_MINUTE),
  )

  const tracksJson = useMemo(() => JSON.stringify(validTracks.map((t) => ({
    id: t.id,
    name: t.name,
    avatar: t.avatar,
    coords: t.points.map((p) => [p.lat, p.lng]),
    elapsedMsList: t.points.map((p) => new Date(p.recorded_at).getTime() - commonStartMs),
    speeds: t.points.map((p) => p.speed_kmh),
  }))), [validTracks, commonStartMs])

  const html = useMemo(() => buildHtml(tracksJson), [tracksJson])
  const source = useMemo(() => ({ html }), [html])

  useEffect(() => {
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  useEffect(() => {
    // New selection: stop any running animation and reset to the start.
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
    setPlayState('idle')
    setSpeedStepIndex(0)
    speedRef.current = SPEED_STEPS[0]
    elapsedMsRef.current = 0
  }, [tracksJson])

  function pushProgress(elapsedMs: number, followCamera: boolean) {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'progress', elapsedMs, followCamera }))
  }

  function runAnimation(resumeFromMs: number) {
    setPlayState('playing')
    let virtualElapsed = totalRealMs > 0 ? (resumeFromMs / totalRealMs) * animDurationMs : 0
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

  if (validTracks.length === 0) return null

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
    flexDirection: 'row',
    gap: 6,
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
})
