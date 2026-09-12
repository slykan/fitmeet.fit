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
type FollowTarget = { type: 'rider'; id: number } | { type: 'group'; ids: number[] } | null

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
    .leaflet-control-zoom{border:none!important;box-shadow:none!important;}
    .leaflet-control-zoom a{
      width:30px!important;height:30px!important;line-height:30px!important;
      background:rgba(7,13,28,0.78)!important;color:#eafff0!important;
      border:1px solid rgba(255,255,255,0.12)!important;
    }
    .leaflet-control-zoom a:first-child{border-radius:10px 10px 0 0!important;}
    .leaflet-control-zoom a:last-child{border-radius:0 0 10px 10px!important;}
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const tracks = ${tracksJson};
    const map = L.map('map', { zoomControl:false, attributionControl:false, preferCanvas:true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(map);
    L.control.zoom({ position:'bottomright' }).addTo(map);

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
    function riderIconHtml(p, isFollowed) {
      const ringColor = isFollowed ? '#ffd23f' : '#39ff14';
      const ringWidth = isFollowed ? '3px' : '2px';
      const avatarHtml = p.avatar
        ? '<div style="width:32px;height:32px;border-radius:999px;background:#0b1120;background-image:url(\\'' + p.avatar + '\\');background-size:cover;background-position:center;border:' + ringWidth + ' solid ' + ringColor + ';box-shadow:0 2px 6px rgba(0,0,0,0.5);"></div>'
        : '<div style="width:32px;height:32px;border-radius:999px;background:#0b1120;border:' + ringWidth + ' solid ' + ringColor + ';display:flex;align-items:center;justify-content:center;color:#eafff0;font-weight:800;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,0.5);">' + initialsFor(p.name) + '</div>';
      return '<div style="display:flex;flex-direction:column;align-items:center;">' + avatarHtml + speedBadgeHtml(p.speed) + '</div>';
    }
    function clusterIconHtml(count, avgSpeed, isFollowed) {
      const ringColor = isFollowed ? '#ffd23f' : '#0b1120';
      return '<div style="display:flex;flex-direction:column;align-items:center;">' +
        '<div style="width:34px;height:34px;border-radius:999px;background:#39ff14;color:#041109;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.5);border:2px solid ' + ringColor + ';">' + count + '</div>' +
        speedBadgeHtml(avgSpeed) + '</div>';
    }

    let followTarget = null; // { type:'rider', id } | { type:'group', ids:[...] } | null
    function setFollowTarget(target) {
      followTarget = target;
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type:'followChange', target: target }));
      }
    }
    function sameIdSet(a, b) {
      if (a.length !== b.length) return false;
      const sorted = a.slice().sort();
      const sortedB = b.slice().sort();
      return sorted.every(function(v, i) { return v === sortedB[i]; });
    }

    let riderMarkers = {};
    let clusterMarkers = {};
    let riderIconCache = {};
    let clusterIconCache = {};
    function riderDivIcon(p, isFollowed) {
      const key = p.id + '|' + (p.avatar || '') + '|' + (p.speed != null ? Math.round(p.speed) : 'x') + '|' + (isFollowed ? 'F' : '');
      if (riderIconCache[key]) return riderIconCache[key];
      const icon = L.divIcon({ className:'fm-rider-marker', html: riderIconHtml(p, isFollowed), iconSize:[60,50], iconAnchor:[30,25] });
      riderIconCache[key] = icon;
      return icon;
    }
    function clusterDivIcon(count, avgSpeed, isFollowed) {
      const key = count + '|' + (avgSpeed != null ? Math.round(avgSpeed) : 'x') + '|' + (isFollowed ? 'F' : '');
      if (clusterIconCache[key]) return clusterIconCache[key];
      const icon = L.divIcon({ className:'fm-cluster-marker', html: clusterIconHtml(count, avgSpeed, isFollowed), iconSize:[60,50], iconAnchor:[30,17] });
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
          const isFollowed = !!(followTarget && followTarget.type === 'rider' && followTarget.id === p.id);
          const existing = riderMarkers[p.id];
          if (existing) {
            existing.setLatLng([p.lat, p.lng]);
            existing.setIcon(riderDivIcon(p, isFollowed));
          } else {
            const marker = L.marker([p.lat, p.lng], { icon: riderDivIcon(p, isFollowed) }).addTo(map);
            marker.on('click', function() {
              const isSame = followTarget && followTarget.type === 'rider' && followTarget.id === p.id;
              setFollowTarget(isSame ? null : { type:'rider', id: p.id });
              recomputeDisplay(lastPositions);
            });
            riderMarkers[p.id] = marker;
          }
        } else {
          const ids = group.map(function(g) { return g.p.id; });
          const key = ids.slice().sort().join('-');
          nextClusterKeys[key] = true;
          let sumLat = 0, sumLng = 0, speedSum = 0, speedCount = 0;
          group.forEach(function(g) {
            sumLat += g.p.lat; sumLng += g.p.lng;
            if (g.p.speed != null) { speedSum += g.p.speed; speedCount++; }
          });
          const centroid = [sumLat / group.length, sumLng / group.length];
          const avgSpeed = speedCount > 0 ? speedSum / speedCount : null;
          const isFollowed = !!(followTarget && followTarget.type === 'group' && sameIdSet(followTarget.ids, ids));
          const icon = clusterDivIcon(group.length, avgSpeed, isFollowed);
          const existing = clusterMarkers[key];
          if (existing) {
            existing.setLatLng(centroid);
            existing.setIcon(icon);
          } else {
            const marker = L.marker(centroid, { icon: icon }).addTo(map);
            marker.on('click', function() {
              const isSame = followTarget && followTarget.type === 'group' && sameIdSet(followTarget.ids, ids);
              setFollowTarget(isSame ? null : { type:'group', ids: ids });
              recomputeDisplay(lastPositions);
            });
            clusterMarkers[key] = marker;
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

    function applyCameraFollow(positions) {
      if (!followTarget) {
        if (positions.length === 1) map.panTo([positions[0].lat, positions[0].lng], { animate:false });
        return;
      }
      if (followTarget.type === 'rider') {
        const p = positions.find(function(x) { return x.id === followTarget.id; });
        if (p) map.panTo([p.lat, p.lng], { animate:false });
        return;
      }
      const members = positions.filter(function(x) { return followTarget.ids.indexOf(x.id) !== -1; });
      if (members.length) {
        const lat = members.reduce(function(s, x) { return s + x.lat; }, 0) / members.length;
        const lng = members.reduce(function(s, x) { return s + x.lng; }, 0) / members.length;
        map.panTo([lat, lng], { animate:false });
      }
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
        const speedA = t.speeds[r.index];
        const speedB = t.speeds[r.index + 1];
        const speed = b && speedA != null && speedB != null ? speedA + (speedB - speedA) * r.frac : (speedA != null ? speedA : speedB);
        positions.push({ id: t.id, name: t.name, avatar: t.avatar, lat: lat, lng: lng, speed: speed });
        const upto = t.coords.slice(0, r.index + 1);
        if (r.frac > 0 && b) upto.push([lat, lng]);
        traveledLines[t.id].setLatLngs(upto);
      });
      lastPositions = positions;
      recomputeDisplay(positions);
      if (followCamera) applyCameraFollow(positions);
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
        if (data.type === 'clearFollow') {
          followTarget = null;
          recomputeDisplay(lastPositions);
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
  const [mapEnabled, setMapEnabled] = useState(false)
  const [followTarget, setFollowTarget] = useState<FollowTarget>(null)
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
    setFollowTarget(null)
    speedRef.current = SPEED_STEPS[0]
    elapsedMsRef.current = 0
  }, [tracksJson])

  function clearFollow() {
    setFollowTarget(null)
    webViewRef.current?.postMessage(JSON.stringify({ type: 'clearFollow' }))
  }

  const followLabel = (() => {
    if (!followTarget) return null
    if (followTarget.type === 'rider') {
      const rider = validTracks.find((t) => t.id === followTarget.id)
      return rider ? `Following ${rider.name}` : null
    }
    return `Following ${followTarget.ids.length} riders`
  })()

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

  function handleMessage(event: { nativeEvent: { data: string } }) {
    try {
      const data = JSON.parse(event.nativeEvent.data)
      if (data.type === 'followChange') {
        setFollowTarget(data.target ?? null)
      }
    } catch {}
  }

  return (
    <View style={styles.card}>
      <WebView
        ref={webViewRef}
        source={source}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        pointerEvents={mapEnabled ? 'auto' : 'none'}
        onMessage={handleMessage}
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
        <Pressable
          style={[styles.moveMapBtn, mapEnabled && styles.toggleBtnActive]}
          onPress={() => setMapEnabled((v) => !v)}
        >
          <Text style={[styles.moveMapText, mapEnabled && styles.speedTextActive]}>{mapEnabled ? 'Done' : 'Move map'}</Text>
        </Pressable>
      </View>
      {followLabel && (
        <View style={styles.followPillWrap} pointerEvents="box-none">
          <Pressable style={styles.followPill} onPress={clearFollow}>
            <Ionicons name="locate" size={12} color="#031109" />
            <Text style={styles.followPillText}>{followLabel}</Text>
            <Ionicons name="close" size={13} color="#031109" />
          </Pressable>
        </View>
      )}
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
  moveMapBtn: {
    height: 30, borderRadius: 10, paddingHorizontal: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(7,13,28,0.78)',
    borderWidth: 1, borderColor: palette.line,
  },
  moveMapText: { color: palette.text, fontSize: 12, fontWeight: '800' },
  followPillWrap: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    alignItems: 'center',
  },
  followPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  followPillText: { color: '#031109', fontSize: 12, fontWeight: '800' },
})
