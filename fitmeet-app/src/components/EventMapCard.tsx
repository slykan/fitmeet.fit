import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'

import { CurrentWeather, fetchCurrentWeather } from '@/src/lib/weather'
import { palette } from '@/src/theme'

const OW_KEY = '62d9f65c21e8b140487241223fae5a2e'

type Props = {
  lat: number
  lng: number
  emoji?: string
}

const WIND_CSS = `
  .wo { position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:450; }
  .wo{opacity:0;transition:opacity .45s ease;}
  .wo.ready{opacity:1;}
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
    0%   { opacity:0; transform:rotate(var(--rot)) translate3d(0,0,0) scale(0.9); }
    10%  { opacity:1; }
    85%  { opacity:1; }
    100% { opacity:0; transform:rotate(var(--rot)) translate3d(var(--dx),var(--dy),0) scale(1.04); }
  }
`

function buildHtml(lat: number, lng: number, emoji: string, weather: CurrentWeather | null) {
  const wJson = JSON.stringify(weather)
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
    const map = L.map('map',{zoomControl:false,attributionControl:false,preferCanvas:true})
      .setView([${lat},${lng}],13);
    L.control.zoom({position:'bottomright'}).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(map);
    L.tileLayer('https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${OW_KEY}',{maxZoom:18,opacity:1.0,zIndex:219}).addTo(map);
    L.tileLayer('https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OW_KEY}',{maxZoom:18,opacity:0.9,zIndex:220}).addTo(map);
    L.tileLayer('https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OW_KEY}',{maxZoom:18,opacity:0.8,zIndex:221}).addTo(map);

    const icon = L.divIcon({className:'fm-marker',html:'<div class="fm-pin">${emoji}</div>',iconSize:[38,38],iconAnchor:[19,19]});
    L.marker([${lat},${lng}],{icon}).addTo(map);

    if (weather) {
      const windDir = weather.windDir||270;
      const flowBearing = windDir % 360;
      const rad = flowBearing*Math.PI/180;
      const spd = Math.max(6,weather.windSpeed||10);
      const dist = Math.min(80,26+spd*2);
      const dx = -Math.sin(rad)*dist;
      const dy = Math.cos(rad)*dist;
      const dur = Math.max(2.2,7.5-spd*0.05);
      const cssRot = flowBearing-90;
      const wo = document.getElementById('wo');
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
  </script>
</body>
</html>`
}

export function EventMapCard({ lat, lng, emoji = '📍' }: Props) {
  const [weather, setWeather] = useState<CurrentWeather | null>(null)

  useEffect(() => {
    fetchCurrentWeather(lat, lng).then(setWeather).catch(() => {})
  }, [lat, lng])

  return (
    <View style={styles.card}>
      <WebView
        key={weather ? 'loaded' : 'loading'}
        source={{ html: buildHtml(lat, lng, emoji, weather) }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
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
