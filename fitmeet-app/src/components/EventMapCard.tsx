import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'
import type { WebView as WebViewType } from 'react-native-webview'

import { CurrentWeather, fetchCurrentWeather } from '@/src/lib/weather'
import type { TrackSegment } from '@/src/lib/gpx'
import { palette } from '@/src/theme'

const OW_KEY = '62d9f65c21e8b140487241223fae5a2e'

type Props = {
  lat: number
  lng: number
  emoji?: string
  coloredSegments?: TrackSegment[]
}

const WIND_CSS = `
  .wo { position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:450; }
  .wo{opacity:0;transition:opacity .45s ease;}
  .wo.ready{opacity:1;}
  .wo.interacting{opacity:0;}
  .wo.interacting *{animation-play-state:paused!important;}
  .ws {
    position:absolute; border-radius:999px;
    background:linear-gradient(90deg,rgba(255,255,255,0),rgba(168,255,214,0.88),rgba(118,212,142,1),rgba(255,255,255,0));
    box-shadow:0 0 7px rgba(118,212,142,0.28);
    transform-origin:center;
    animation:wm linear infinite; opacity:0;
  }
  .wp {
    position:absolute;width:3px;height:3px;border-radius:999px;
    background:rgba(200,255,230,0.86);box-shadow:0 0 7px rgba(168,255,214,0.22);
    transform-origin:center;
    animation:wm linear infinite;opacity:0;
  }
  @keyframes wm {
    0%   { opacity:0; transform:translate3d(0,0,0) rotate(var(--rot)) scale(0.9); }
    10%  { opacity:1; }
    85%  { opacity:1; }
    100% { opacity:0; transform:translate3d(var(--dx),var(--dy),0) rotate(var(--rot)) scale(1.04); }
  }
`

function buildHtml(
  lat: number,
  lng: number,
  center: { lat: number; lng: number },
  emoji: string,
  weather: CurrentWeather | null,
  coloredSegments: TrackSegment[],
) {
  const wJson = JSON.stringify(weather)
  const segsJson = JSON.stringify(coloredSegments)
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    html,body,#map{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#050816;}
    .leaflet-control-attribution{display:none;}
    .fm-marker{background:transparent;border:0;}
    .fm-pin{
      width:38px;height:38px;border-radius:999px;
      display:flex;align-items:center;justify-content:center;
      background:rgba(7,13,28,0.92);border:2px solid #6cff2f;
      box-shadow:0 0 0 3px rgba(108,255,47,0.18);font-size:18px;
    }
    ${WIND_CSS}
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="wo" id="wo"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const weather = ${wJson};
    const coloredSegments = ${segsJson};
    const map = L.map('map',{zoomControl:false,attributionControl:false,preferCanvas:true})
      .setView([${center.lat},${center.lng}],13);
    L.control.zoom({position:'bottomright'}).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(map);
    L.tileLayer('https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${OW_KEY}',{maxZoom:18,opacity:1.0,zIndex:219}).addTo(map);
    L.tileLayer('https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OW_KEY}',{maxZoom:18,opacity:0.9,zIndex:220}).addTo(map);
    L.tileLayer('https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OW_KEY}',{maxZoom:18,opacity:0.8,zIndex:221}).addTo(map);

    const icon = L.divIcon({className:'fm-marker',html:'<div class="fm-pin">${emoji}</div>',iconSize:[38,38],iconAnchor:[19,19]});
    L.marker([${lat},${lng}],{icon}).addTo(map);

    if (coloredSegments && coloredSegments.length > 0) {
      const allBounds = [];
      coloredSegments.forEach(function(seg) {
        if (seg.coords.length > 1) {
          const poly = L.polyline(seg.coords,{color:seg.color,weight:4,opacity:0.9,lineJoin:'round'}).addTo(map);
          allBounds.push(poly.getBounds());
        }
      });
      if (allBounds.length > 0) {
        setTimeout(function() {
          map.invalidateSize();
          let bounds = allBounds[0];
          allBounds.forEach(function(b){ bounds = bounds.extend(b); });
          bounds = bounds.extend([${lat},${lng}]);
          map.fitBounds(bounds,{padding:[32,32]});
        }, 200);
      }
    }

    const wo = document.getElementById('wo');
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
      wo.classList.add('interacting');
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

    function renderWeather(nextWeather) {
      wo.classList.remove('ready', 'interacting');
      wo.innerHTML = '';
      if (!nextWeather) return;

      const windDir = nextWeather.windDir||270;
      const flowBearing = windDir % 360;
      const rad = flowBearing*Math.PI/180;
      const spd = Math.max(6,nextWeather.windSpeed||10);
      const dist = Math.min(80,26+spd*2);
      const dx = Math.sin(rad)*dist;
      const dy = -Math.cos(rad)*dist;
      const dur = Math.max(2.2,7.5-spd*0.05);
      const cssRot = flowBearing-90;
      for(let i=0;i<100;i++){
        const el=document.createElement('div');
        el.className = i%4===0?'wp':'ws';
        if(el.className==='ws'){el.style.width=(10+(i%3)*7)+'px';el.style.height='1.6px';}
        el.style.left=(Math.random()*110-5)+'%';
        el.style.top=(Math.random()*110-5)+'%';
        el.style.setProperty('--rot', cssRot+'deg');
        el.style.setProperty('--dx',dx+'px');
        el.style.setProperty('--dy',dy+'px');
        el.style.animationDuration=(dur+Math.random()*1.6)+'s';
        el.style.animationDelay=(0.2+Math.random()*4.3)+'s';
        wo.appendChild(el);
      }
      setTimeout(() => wo.classList.add('ready'), 220);
    }

    document.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'weatherUpdate') renderWeather(data.weather);
      } catch (e) {}
    });
    window.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'weatherUpdate') renderWeather(data.weather);
      } catch (e) {}
    });

    renderWeather(weather);
  </script>
</body>
</html>`
}

export function EventMapCard({ lat, lng, emoji = '📍', coloredSegments }: Props) {
  const webViewRef = useRef<WebViewType>(null)
  const [weather, setWeather] = useState<CurrentWeather | null>(null)
  const [center, setCenter] = useState({ lat, lng })
  const html = useMemo(
    () => buildHtml(lat, lng, { lat, lng }, emoji, null, coloredSegments ?? []),
    [lat, lng, emoji, coloredSegments],
  )

  useEffect(() => {
    setCenter({ lat, lng })
  }, [lat, lng])

  useEffect(() => {
    fetchCurrentWeather(center.lat, center.lng).then(setWeather).catch(() => {})
  }, [center.lat, center.lng])

  const weatherRef = useRef<CurrentWeather | null>(null)
  weatherRef.current = weather

  useEffect(() => {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'weatherUpdate', weather }))
  }, [weather])

  return (
    <View style={styles.card}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        onLoadEnd={() => {
          if (weatherRef.current) {
            webViewRef.current?.postMessage(
              JSON.stringify({ type: 'weatherUpdate', weather: weatherRef.current }),
            )
          }
        }}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data)
            if (
              data.type === 'mapMoveEnd' &&
              data.center &&
              typeof data.center.lat === 'number' &&
              typeof data.center.lng === 'number'
            ) {
              setWeather(null)
              setCenter(data.center)
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
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: '#060c1a',
  },
  webview: { flex: 1, backgroundColor: 'transparent' },
})
