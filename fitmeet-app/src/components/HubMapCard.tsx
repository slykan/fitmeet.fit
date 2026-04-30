import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'

import { CurrentWeather } from '@/src/lib/weather'
import { palette } from '@/src/theme'

const OW_KEY = '62d9f65c21e8b140487241223fae5a2e'

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
  height?: number
  onEventPress: (eventId: number) => void
  onMapTouchStart?: () => void
  onMapTouchEnd?: () => void
}

function buildMapHtml(
  center: { lat: number; lng: number },
  events: EventMarker[],
  weather: CurrentWeather | null,
  showWind: boolean,
  showClouds: boolean,
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
    .wind-stream {
      position:absolute; border-radius:999px;
      background:linear-gradient(90deg,rgba(255,255,255,0),rgba(168,255,214,0.92),rgba(118,212,142,1),rgba(255,255,255,0));
      box-shadow:0 0 8px rgba(118,212,142,0.3);
      transform-origin:center;
      animation:windMove linear infinite; opacity:0;
    }
    .wind-particle {
      position:absolute; width:3px; height:3px; border-radius:999px;
      background:rgba(200,255,230,0.86); box-shadow:0 0 8px rgba(168,255,214,0.24);
      transform-origin:center;
      animation:windMove linear infinite; opacity:0;
    }
    @keyframes windMove {
      0%   { opacity:0; transform:rotate(var(--rot)) translate3d(0,0,0) scale(0.9); }
      10%  { opacity:1; }
      85%  { opacity:1; }
      100% { opacity:0; transform:rotate(var(--rot)) translate3d(var(--dx),var(--dy),0) scale(1.04); }
    }
    .cloud-blob {
      position:absolute; border-radius:999px;
      background:radial-gradient(circle at 35% 35%,rgba(200,212,230,0.72),rgba(180,192,210,0.48) 55%,rgba(160,172,190,0.18) 78%,transparent 100%);
      animation:cloudDrift linear infinite;
    }
    @keyframes cloudDrift {
      from { transform:translate3d(-3%,0,0); } to { transform:translate3d(3%,0,0); }
    }
    .rain-line {
      position:absolute; width:1.5px; border-radius:999px;
      background:linear-gradient(180deg,rgba(130,196,255,0),rgba(130,196,255,0.85),rgba(130,196,255,0));
      animation:rainFall linear infinite; opacity:0.6;
    }
    @keyframes rainFall {
      from { transform:translate3d(0,-14px,0); opacity:0; }
      18% { opacity:0.6; }
      to  { transform:translate3d(-12px,28px,0); opacity:0; }
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
    const OW_KEY = '${OW_KEY}';

    const map = L.map('map', {
      zoomControl:false, attributionControl:false, preferCanvas:true,
    }).setView([center.lat, center.lng], events.length ? 8 : 7);

    L.control.zoom({ position:'bottomright' }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:18 }).addTo(map);

    if (showWind) {
      L.tileLayer(
        'https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=' + OW_KEY,
        { maxZoom:18, opacity:1.0, zIndex:219 }
      ).addTo(map);
    }

    if (showClouds) {
      L.tileLayer(
        'https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=' + OW_KEY,
        { maxZoom:18, opacity:0.9, zIndex:220 }
      ).addTo(map);
      L.tileLayer(
        'https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=' + OW_KEY,
        { maxZoom:18, opacity:0.8, zIndex:221 }
      ).addTo(map);
    }

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
    if (bounds.length > 1) map.fitBounds(bounds, { padding:[28,28] });

    // ── CSS weather animation ──────────────────────────────
    const overlay = document.getElementById('weather-overlay');

    if (weather) {
      const windDir = weather.windDir || 270;
      const flowBearing = windDir % 360;
      const rad = flowBearing * Math.PI / 180;
      const spd = Math.max(6, weather.windSpeed || 10);
      const dist = Math.min(90, 28 + spd * 2.2);
      const dx = -Math.sin(rad) * dist;
      const dy = Math.cos(rad) * dist;
      const dur = Math.max(2.4, 8 - spd * 0.06);
      const cssRot = flowBearing - 90;

      if (showWind) {
        for (let i = 0; i < 140; i++) {
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
          el.style.animationDuration  = (dur + Math.random() * 1.8) + 's';
          el.style.animationDelay     = (0.2 + Math.random() * 4.8) + 's';
          overlay.appendChild(el);
        }
      }

      const cloudCover = weather.cloudCover || 0;
      if (showClouds && cloudCover >= 20) {
        const count = cloudCover >= 75 ? 6 : cloudCover >= 40 ? 4 : 2;
        for (let i = 0; i < count; i++) {
          const blob = document.createElement('div');
          blob.className = 'cloud-blob';
          const sz = 100 + Math.random() * 140;
          blob.style.width  = sz + 'px';
          blob.style.height = (sz * 0.6) + 'px';
          blob.style.left   = (-5 + Math.random() * 90) + '%';
          blob.style.top    = (-5 + Math.random() * 88) + '%';
          blob.style.opacity = String(0.3 + Math.random() * 0.35);
          blob.style.animationDuration = (30 + Math.random() * 25) + 's';
          overlay.appendChild(blob);
        }
      }

      const precip = weather.precipitation || 0;
      if (showClouds && precip > 0.1) {
        const count = Math.min(60, 12 + Math.round(precip * 16));
        for (let i = 0; i < count; i++) {
          const line = document.createElement('div');
          line.className = 'rain-line';
          line.style.height = (14 + Math.random() * 22) + 'px';
          line.style.left   = (Math.random() * 100) + '%';
          line.style.top    = (Math.random() * 100) + '%';
          line.style.animationDuration = (0.7 + Math.random() * 0.5) + 's';
          line.style.animationDelay    = (-Math.random() * 1.4) + 's';
          overlay.appendChild(line);
        }
      }

      setTimeout(() => overlay.classList.add('ready'), 220);
    }
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
  height = 320,
  onEventPress,
  onMapTouchStart,
  onMapTouchEnd,
}: Props) {
  const html = useMemo(
    () => buildMapHtml(center, events, weather, showWind, showClouds),
    [center, events, weather, showWind, showClouds],
  )

  return (
    <View
      style={[styles.card, { height }]}
      onTouchStart={onMapTouchStart}
      onTouchEnd={onMapTouchEnd}
      onTouchCancel={onMapTouchEnd}
    >
      <WebView
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
            }
          } catch {}
        }}
        style={styles.webview}
      />
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
})
