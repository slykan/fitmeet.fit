import { Ionicons } from '@expo/vector-icons'
import { useEffect, useMemo, useRef } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'
import type { WebView as WebViewType } from 'react-native-webview'

import { CurrentWeather } from '@/src/lib/weather'
import { palette } from '@/src/theme'

type EventMarker = {
  id: number
  title: string
  lat: number
  lng: number
  emoji: string
  cancelled?: boolean
}

type Props = {
  center: { lat: number; lng: number }
  events: EventMarker[]
  weather: CurrentWeather | null
  showWind: boolean
  showClouds: boolean
  onToggleWind?: () => void
  onToggleClouds?: () => void
  radarPath?: string | null
  height?: number
  onEventPress: (eventId: number) => void
  onMapTouchStart?: () => void
  onMapTouchEnd?: () => void
  onMapCenterChange?: (center: { lat: number; lng: number }) => void
  fitToEvents?: boolean
}

function buildMapHtml(
  center: { lat: number; lng: number },
  events: EventMarker[],
  weather: CurrentWeather | null,
  showWind: boolean,
  showClouds: boolean,
  fitToEvents: boolean,
) {
  const markersJson = JSON.stringify(events)
  const centerJson  = JSON.stringify(center)
  const weatherJson = JSON.stringify(weather)

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background:#050816; }
    .leaflet-control-attribution { display:none; }
    .fm-marker { background:transparent; border:0; }
    .fm-pin {
      width:34px; height:34px; border-radius:999px;
      display:flex; align-items:center; justify-content:center;
      background:rgba(7,13,28,0.92); border:2px solid #6cff2f;
      box-shadow:0 0 0 3px rgba(108,255,47,0.12); font-size:16px;
    }
    .fm-pin.cancelled { border-color:#ff7c7c; box-shadow:0 0 0 3px rgba(255,124,124,0.14); }
    .weather-overlay {
      position:absolute; inset:0; pointer-events:none; overflow:hidden; z-index:450;
      opacity:0; transition:opacity .45s ease;
    }
    .weather-overlay.ready {
      opacity:1;
    }
    .weather-overlay.interacting {
      opacity:0;
    }
    .weather-overlay.interacting * {
      animation-play-state:paused !important;
    }
    .wind-stream {
      position:absolute; border-radius:999px;
      background:linear-gradient(90deg,rgba(255,255,255,0),rgba(210,232,255,0.85),rgba(255,255,255,0.98),rgba(255,255,255,0));
      box-shadow:0 0 3.5px 1px rgba(6,10,10,0.62), 0 0 8px rgba(210,232,255,0.3);
      transform-origin:center;
      animation:windMove linear infinite; opacity:0;
    }
    .wind-particle {
      position:absolute; width:3px; height:3px; border-radius:999px;
      background:rgba(255,255,255,0.92); box-shadow:0 0 3px 1px rgba(6,10,10,0.68), 0 0 8px rgba(210,232,255,0.28);
      transform-origin:center;
      animation:windMove linear infinite; opacity:0;
    }
    @keyframes windMove {
      0%   { opacity:0; transform:translate3d(0,0,0) rotate(var(--rot)) scale(0.9); }
      10%  { opacity:1; }
      32%  { transform:translate3d(var(--dx1),var(--dy1),0) rotate(var(--rot)) scale(0.95); }
      58%  { transform:translate3d(var(--dx2),var(--dy2),0) rotate(var(--rot)) scale(1); }
      82%  { transform:translate3d(var(--dx3),var(--dy3),0) rotate(var(--rot)) scale(1.02); }
      85%  { opacity:1; }
      100% { opacity:0; transform:translate3d(var(--dx),var(--dy),0) rotate(var(--rot)) scale(1.04); }
    }
    .lightning-bolt {
      position:absolute; width:14px; height:14px; border-radius:999px;
      background:radial-gradient(circle,rgba(255,244,160,0.98),rgba(255,214,64,0.6) 55%,transparent 100%);
      box-shadow:0 0 16px 6px rgba(255,214,64,0.55);
      opacity:0;
      animation:lightningFlash ease-in-out infinite;
    }
    @keyframes lightningFlash {
      0%, 90%   { opacity:0; transform:scale(0.6); }
      91%       { opacity:1; transform:scale(1.2); }
      93%       { opacity:0.15; transform:scale(0.85); }
      94.5%     { opacity:1; transform:scale(1.25); }
      97%       { opacity:0; transform:scale(0.6); }
      100%      { opacity:0; transform:scale(0.6); }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="weather-overlay" id="weather-overlay"></div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const center  = ${centerJson};
    const events  = ${markersJson};
    const weather = ${weatherJson};
    const showWind   = ${showWind};
    const showClouds = ${showClouds};
    let radarPath = null;
    let currentShowClouds = showClouds;

    const BASE_MAX_ZOOM = 18;
    const RADAR_MAX_ZOOM = 7;

    function buildRadarUrl(path) {
      return 'https://tilecache.rainviewer.com' + path + '/512/{z}/{x}/{y}/2/1_1.png';
    }

    const map = L.map('map', {
      zoomControl:false, attributionControl:false, preferCanvas:true, maxZoom:BASE_MAX_ZOOM,
    }).setView([center.lat, center.lng], events.length ? 8 : 7);

    L.control.zoom({ position:'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:18 }).addTo(map);

    map.createPane('precip');
    map.getPane('precip').style.zIndex = 460;
    map.getPane('precip').style.pointerEvents = 'none';

    let precipTileLayer = null;

    function updateCloudTiles(show) {
      if (show) {
        if (radarPath) {
          const url = buildRadarUrl(radarPath);
          if (!precipTileLayer) {
            precipTileLayer = L.tileLayer(url, { maxZoom:BASE_MAX_ZOOM, maxNativeZoom:RADAR_MAX_ZOOM, opacity:0.85, pane:'precip' }).addTo(map);
          } else if (precipTileLayer._url !== url) {
            precipTileLayer.setUrl(url);
          }
        }
      } else {
        if (precipTileLayer) { precipTileLayer.remove(); precipTileLayer = null; }
      }
    }

    updateCloudTiles(showClouds);

    const bounds = [];
    events.forEach((ev) => {
      const html = '<div class="fm-pin' + (ev.cancelled ? ' cancelled' : '') + '">' + ev.emoji + '</div>';
      const icon = L.divIcon({ className:'fm-marker', html, iconSize:[34,34], iconAnchor:[17,17] });
      const m = L.marker([ev.lat, ev.lng], { icon }).addTo(map);
      m.on('click', () => {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
          JSON.stringify({ type:'eventPress', id:ev.id })
        );
      });
      bounds.push([ev.lat, ev.lng]);
    });
    if (${fitToEvents} && bounds.length > 1) map.fitBounds(bounds, { padding:[28,28] });

    // ── CSS weather animation ──────────────────────────────
    const overlay = document.getElementById('weather-overlay');
    let moveTimer = null;
    let userInteracting = false;
    function send(type, payload) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...(payload || {}) }));
    }
    function markUserInteracting() {
      userInteracting = true;
    }
    function movementStarted() {
      if (!userInteracting) return;
      overlay.classList.add('interacting');
      send('mapMoveStart');
    }
    function movementEnded() {
      if (!userInteracting) return;
      window.clearTimeout(moveTimer);
      moveTimer = window.setTimeout(() => {
        const c = map.getCenter();
        send('mapMoveEnd', { center:{ lat:c.lat, lng:c.lng } });
        userInteracting = false;
      }, 160);
    }
    const container = map.getContainer();
    container.addEventListener('touchstart', markUserInteracting, { passive:true });
    container.addEventListener('mousedown', markUserInteracting);
    container.addEventListener('wheel', markUserInteracting, { passive:true });
    map.on('movestart zoomstart dragstart', movementStarted);
    map.on('moveend zoomend dragend', movementEnded);

    function renderWeather(nextWeather, nextShowWind, nextShowClouds) {
      currentShowClouds = nextShowClouds;
      updateCloudTiles(nextShowClouds);
      overlay.classList.remove('ready', 'interacting');
      overlay.innerHTML = '';
      if (!nextWeather) return;

      if (nextShowWind) {
        const windDir = nextWeather.windDir || 270;
        const flowBearing = (windDir + 180) % 360;
        const rad = flowBearing * Math.PI / 180;
        const spd = Math.max(6, nextWeather.windSpeed || 10);
        const dist = Math.min(90, 28 + spd * 2.2);
        const dx = Math.sin(rad) * dist;
        const dy = -Math.cos(rad) * dist;
        const perpRad = rad + Math.PI / 2;
        const px = Math.sin(perpRad);
        const py = -Math.cos(perpRad);
        const dur = Math.max(2.4, 8 - spd * 0.06);
        const cssRot = flowBearing - 90;

        for (let i = 0; i < 45; i++) {
          const el = document.createElement('div');
          el.className = i % 4 === 0 ? 'wind-particle' : 'wind-stream';
          if (el.className === 'wind-stream') {
            const w = 12 + (i % 3) * 8;
            el.style.width  = w + 'px';
            el.style.height = '1.8px';
          }
          el.style.left = (Math.random() * 110 - 5) + '%';
          el.style.top  = (Math.random() * 110 - 5) + '%';
          el.style.setProperty('--rot', cssRot + 'deg');
          el.style.setProperty('--dx', dx + 'px');
          el.style.setProperty('--dy', dy + 'px');
          const waveAmp = (3 + Math.random() * 4) * (i % 2 === 0 ? 1 : -1);
          const wavePoint = (t, m) => ({ x: dx * t + px * waveAmp * m, y: dy * t + py * waveAmp * m });
          const p1 = wavePoint(0.32, 1);
          const p2 = wavePoint(0.58, -1);
          const p3 = wavePoint(0.82, 0.6);
          el.style.setProperty('--dx1', p1.x + 'px');
          el.style.setProperty('--dy1', p1.y + 'px');
          el.style.setProperty('--dx2', p2.x + 'px');
          el.style.setProperty('--dy2', p2.y + 'px');
          el.style.setProperty('--dx3', p3.x + 'px');
          el.style.setProperty('--dy3', p3.y + 'px');
          el.style.animationDuration  = (dur + Math.random() * 1.8) + 's';
          el.style.animationDelay     = (0.2 + Math.random() * 4.8) + 's';
          overlay.appendChild(el);
        }
      }

      const isThunder = [95, 96, 99].includes(Math.round(nextWeather.code || 0));
      if (nextShowClouds && isThunder) {
        const count = 4 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          const bolt = document.createElement('div');
          bolt.className = 'lightning-bolt';
          bolt.style.left = (2 + Math.random() * 90) + '%';
          bolt.style.top  = (2 + Math.random() * 85) + '%';
          bolt.style.animationDuration = (2.6 + Math.random() * 2.4) + 's';
          bolt.style.animationDelay    = (Math.random() * 3) + 's';
          overlay.appendChild(bolt);
        }
      }

      setTimeout(() => overlay.classList.add('ready'), 220);
    }

    function handleMessage(event) {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'weatherUpdate') renderWeather(data.weather, data.showWind, data.showClouds);
        else if (data.type === 'radarUpdate') {
          radarPath = data.path;
          updateCloudTiles(currentShowClouds);
        }
      } catch (e) {}
    }
    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);

    renderWeather(weather, showWind, showClouds);
    send('ready');
  </script>
</body>
</html>`
}

export function HubMapCard({
  center,
  events,
  weather,
  showWind,
  showClouds,
  onToggleWind,
  onToggleClouds,
  radarPath = null,
  height = 320,
  onEventPress,
  onMapTouchStart,
  onMapTouchEnd,
  onMapCenterChange,
  fitToEvents = true,
}: Props) {
  const webViewRef = useRef<WebViewType>(null)
  const html = useMemo(
    () => buildMapHtml(center, events, weather, showWind, showClouds, fitToEvents),
    [center.lat, center.lng, events],
  )

  useEffect(() => {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'weatherUpdate', weather, showWind, showClouds }))
  }, [weather, showWind, showClouds])

  useEffect(() => {
    if (radarPath) webViewRef.current?.postMessage(JSON.stringify({ type: 'radarUpdate', path: radarPath }))
  }, [radarPath])

  return (
    <View
      style={[styles.card, { height }]}
      onTouchStart={onMapTouchStart}
      onTouchEnd={onMapTouchEnd}
      onTouchCancel={onMapTouchEnd}
    >
      <WebView
        ref={webViewRef}
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data)
            if (data.type === 'eventPress' && typeof data.id === 'number') {
              onEventPress(data.id)
            } else if (data.type === 'mapMoveStart') {
              onMapTouchStart?.()
            } else if (
              data.type === 'mapMoveEnd' &&
              data.center &&
              typeof data.center.lat === 'number' &&
              typeof data.center.lng === 'number'
            ) {
              onMapCenterChange?.(data.center)
              onMapTouchEnd?.()
            } else if (data.type === 'ready') {
              webViewRef.current?.postMessage(JSON.stringify({ type: 'weatherUpdate', weather, showWind, showClouds }))
              if (radarPath) webViewRef.current?.postMessage(JSON.stringify({ type: 'radarUpdate', path: radarPath }))
            }
          } catch {}
        }}
        style={styles.webview}
      />

      <View style={styles.layerToggles} pointerEvents="box-none">
        <Pressable
          style={[styles.layerBtn, showWind && styles.layerBtnActive]}
          onPress={onToggleWind}
          hitSlop={8}
        >
          <Ionicons name="flag-outline" size={15} color={showWind ? '#031109' : palette.text} />
        </Pressable>
        <Pressable
          style={[styles.layerBtn, showClouds && styles.layerBtnActive]}
          onPress={onToggleClouds}
          hitSlop={8}
        >
          <Ionicons name="rainy-outline" size={15} color={showClouds ? '#031109' : palette.text} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: '#060c1a',
  },
  webview: { flex: 1, backgroundColor: 'transparent' },
  layerToggles: {
    position: 'absolute',
    top: 10,
    left: 10,
    gap: 6,
  },
  layerBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7,13,28,0.78)',
    borderWidth: 1,
    borderColor: palette.line,
  },
  layerBtnActive: { backgroundColor: palette.accent, borderColor: palette.accent },
})
