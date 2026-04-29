import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'

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
  onEventPress: (eventId: number) => void
}

function buildMapHtml(
  center: { lat: number; lng: number },
  events: EventMarker[],
  weather: CurrentWeather | null,
) {
  const markersJson = JSON.stringify(events)
  const centerJson = JSON.stringify(center)
  const weatherJson = JSON.stringify(weather)

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #050816; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .leaflet-control-attribution, .leaflet-control-zoom { opacity: 0.92; }
    .leaflet-control-attribution { display: none; }
    .fm-marker {
      background: transparent;
      border: 0;
    }
    .fm-pin {
      width: 34px;
      height: 34px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(7, 13, 28, 0.92);
      border: 2px solid #6cff2f;
      box-shadow: 0 0 0 3px rgba(108,255,47,0.12);
      color: #fff;
      font-size: 16px;
    }
    .fm-pin.cancelled {
      border-color: #ff7c7c;
      box-shadow: 0 0 0 3px rgba(255,124,124,0.14);
    }
    .weather-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 450;
    }
    .cloud-layer, .rain-layer, .wind-field, .wind-streams {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
    .cloud-blob {
      position: absolute;
      border-radius: 999px;
      background: radial-gradient(circle at 35% 35%, rgba(255,255,255,0.88), rgba(232,238,245,0.72) 55%, rgba(215,222,230,0.42) 78%, rgba(215,222,230,0) 100%);
      filter: blur(1px);
      animation: cloudDrift linear infinite;
    }
    @keyframes cloudDrift {
      from { transform: translate3d(-4%, 0, 0); }
      to { transform: translate3d(4%, 0, 0); }
    }
    .rain-line {
      position: absolute;
      width: 1.5px;
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(130,196,255,0), rgba(130,196,255,0.88), rgba(130,196,255,0));
      animation: rainFall linear infinite;
      opacity: 0.55;
    }
    @keyframes rainFall {
      from { transform: translate3d(0,-14px,0); opacity: 0; }
      18% { opacity: 0.55; }
      to { transform: translate3d(-14px,28px,0); opacity: 0; }
    }
    .wind-track {
      position: absolute;
      width: 22px;
      height: 1px;
      border-radius: 999px;
      background: rgba(124, 255, 188, 0.14);
      transform-origin: center;
    }
    .wind-stream {
      position: absolute;
      width: 14px;
      height: 1.6px;
      border-radius: 999px;
      background: rgba(168, 255, 214, 0.92);
      box-shadow: 0 0 8px rgba(168, 255, 214, 0.28);
      transform-origin: center;
      animation: windMove linear infinite;
      opacity: 0;
    }
    .wind-particle {
      position: absolute;
      width: 3px;
      height: 3px;
      border-radius: 999px;
      background: rgba(200,255,230,0.86);
      box-shadow: 0 0 8px rgba(168,255,214,0.24);
      animation: windMove linear infinite;
      opacity: 0;
    }
    @keyframes windMove {
      0% { transform: translate3d(0,0,0) scale(0.92); opacity: 0; }
      10% { opacity: 1; }
      85% { opacity: 1; }
      100% { transform: translate3d(var(--dx), var(--dy), 0) scale(1.04); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="weather-layer">
    <div class="cloud-layer" id="cloud-layer"></div>
    <div class="rain-layer" id="rain-layer"></div>
    <div class="wind-field" id="wind-field"></div>
    <div class="wind-streams" id="wind-streams"></div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const center = ${centerJson};
    const events = ${markersJson};
    const weather = ${weatherJson};

    const map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    }).setView([center.lat, center.lng], events.length ? 8 : 7);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
    }).addTo(map);

    const bounds = [];
    events.forEach((event) => {
      const html = '<div class="fm-pin' + (event.cancelled ? ' cancelled' : '') + '">' + event.emoji + '</div>';
      const icon = L.divIcon({ className: 'fm-marker', html, iconSize: [34, 34], iconAnchor: [17, 17] });
      const marker = L.marker([event.lat, event.lng], { icon }).addTo(map);
      marker.on('click', () => {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'eventPress', id: event.id }));
      });
      bounds.push([event.lat, event.lng]);
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [28, 28] });
    }

    function renderWeather() {
      const cloudLayer = document.getElementById('cloud-layer');
      const rainLayer = document.getElementById('rain-layer');
      const windField = document.getElementById('wind-field');
      const windStreams = document.getElementById('wind-streams');

      cloudLayer.innerHTML = '';
      rainLayer.innerHTML = '';
      windField.innerHTML = '';
      windStreams.innerHTML = '';

      if (!weather) return;

      const flowDeg = ((weather.windDir || 0) + 180) % 360;
      const radians = flowDeg * Math.PI / 180;
      const dx = Math.cos(radians) * Math.max(14, Math.min(26, (weather.windSpeed || 0) * 1.2));
      const dy = Math.sin(radians) * Math.max(14, Math.min(26, (weather.windSpeed || 0) * 1.2));

      const fieldCount = 90;
      for (let i = 0; i < fieldCount; i++) {
        const line = document.createElement('div');
        line.className = 'wind-track';
        line.style.left = (Math.random() * 100) + '%';
        line.style.top = (Math.random() * 100) + '%';
        line.style.transform = 'rotate(' + flowDeg + 'deg)';
        line.style.opacity = String(0.08 + Math.min(0.12, (weather.windSpeed || 0) / 180));
        windField.appendChild(line);
      }

      const streamCount = 110;
      for (let i = 0; i < streamCount; i++) {
        const stream = document.createElement('div');
        stream.className = i % 4 === 0 ? 'wind-particle' : 'wind-stream';
        stream.style.left = (Math.random() * 100) + '%';
        stream.style.top = (Math.random() * 100) + '%';
        stream.style.transform = 'rotate(' + flowDeg + 'deg)';
        stream.style.setProperty('--dx', dx + 'px');
        stream.style.setProperty('--dy', dy + 'px');
        stream.style.animationDuration = (2.8 + Math.random() * 2.4) + 's';
        stream.style.animationDelay = (-Math.random() * 4.8) + 's';
        windStreams.appendChild(stream);
      }

      const cloudOpacity = Math.min(0.92, Math.max(0, (weather.cloudCover || 0) / 100));
      const cloudCount = weather.cloudCover >= 75 ? 7 : weather.cloudCover >= 40 ? 5 : weather.cloudCover >= 15 ? 3 : 0;
      for (let i = 0; i < cloudCount; i++) {
        const blob = document.createElement('div');
        blob.className = 'cloud-blob';
        const size = 90 + Math.random() * 150;
        blob.style.width = size + 'px';
        blob.style.height = (size * 0.62) + 'px';
        blob.style.left = (-5 + Math.random() * 90) + '%';
        blob.style.top = (-5 + Math.random() * 88) + '%';
        blob.style.opacity = String(cloudOpacity * (0.38 + Math.random() * 0.34));
        blob.style.animationDuration = (34 + Math.random() * 26) + 's';
        cloudLayer.appendChild(blob);
      }

      const rainCount = weather.precipitation > 0.1 ? Math.min(70, 16 + Math.round(weather.precipitation * 18)) : 0;
      for (let i = 0; i < rainCount; i++) {
        const line = document.createElement('div');
        line.className = 'rain-line';
        const len = 16 + Math.random() * 24;
        line.style.height = len + 'px';
        line.style.left = (Math.random() * 100) + '%';
        line.style.top = (Math.random() * 100) + '%';
        line.style.animationDuration = (0.85 + Math.random() * 0.6) + 's';
        line.style.animationDelay = (-Math.random() * 1.5) + 's';
        rainLayer.appendChild(line);
      }
    }

    renderWeather();
  </script>
</body>
</html>`;
}

export function HubMapCard({ center, events, weather, onEventPress }: Props) {
  const html = useMemo(() => buildMapHtml(center, events, weather), [center, events, weather])

  return (
    <View style={styles.card}>
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
    height: 420,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: '#060c1a',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
})
