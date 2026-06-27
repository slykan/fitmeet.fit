import { Ionicons } from '@expo/vector-icons'
import * as FileSystem from 'expo-file-system/legacy'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'

import { api } from '@/src/lib/api'
import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'

// ─── GPX builder ─────────────────────────────────────────────────────────────

function buildGpx(track: [number, number][], title: string, elevations?: number[]): string {
  const esc = (s: string) =>
    s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!))
  const pts = track
    .map(([lat, lng], i) => {
      const ele = elevations?.[i]
      if (ele != null && !isNaN(ele))
        return `    <trkpt lat="${lat.toFixed(7)}" lon="${lng.toFixed(7)}">\n      <ele>${ele.toFixed(1)}</ele>\n    </trkpt>`
      return `    <trkpt lat="${lat.toFixed(7)}" lon="${lng.toFixed(7)}"/>`
    })
    .join('\n')
  const name = esc(title || 'Route')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="FitMeet" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>${name}</name></metadata>\n  <trk><name>${name}</name><trkseg>\n${pts}\n  </trkseg></trk>\n</gpx>`
}

async function fetchTrackElevations(track: [number, number][]): Promise<number[]> {
  if (track.length < 2) return []
  const MAX = 100
  const step = Math.max(1, Math.floor(track.length / MAX))
  const si: number[] = []
  for (let i = 0; i < track.length; i += step) si.push(i)
  if (si[si.length - 1] !== track.length - 1) si.push(track.length - 1)
  const sampled = si.map(i => track[i])
  const lats = sampled.map(([lat]) => lat.toFixed(5)).join(',')
  const lngs = sampled.map(([, lng]) => lng.toFixed(5)).join(',')
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`)
    if (!res.ok) return []
    const data = await res.json() as { elevation?: number[] }
    const se = data.elevation ?? []
    if (se.length === 0) return []
    const out = new Array<number>(track.length)
    let j = 0
    for (let i = 0; i < track.length; i++) {
      if (j + 1 < si.length && i >= si[j + 1]) j++
      if (i === si[j]) { out[i] = se[j] }
      else if (j + 1 < si.length) {
        const t = (i - si[j]) / (si[j + 1] - si[j])
        out[i] = se[j] + t * (se[j + 1] - se[j])
      } else { out[i] = se[j] }
    }
    return out
  } catch { return [] }
}

// ─── GPX track parser ─────────────────────────────────────────────────────────

function parseGpxTrack(gpx: string): [number, number][] {
  const pts: [number, number][] = []
  const rx = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = rx.exec(gpx)) !== null) pts.push([parseFloat(m[1]), parseFloat(m[2])])
  return pts
}

function downsampleTrack(pts: [number, number][], max: number): [number, number][] {
  if (pts.length <= max) return pts
  const result: [number, number][] = [pts[0]]
  const step = (pts.length - 1) / (max - 2)
  for (let i = 1; i < max - 1; i++) result.push(pts[Math.round(i * step)])
  result.push(pts[pts.length - 1])
  return result
}

function normalizeWaypoints(input: unknown): [number, number][] {
  if (!Array.isArray(input)) return []

  return input
    .map((point): [number, number] | null => {
      if (Array.isArray(point) && point.length >= 2) {
        const lat = Number(point[0])
        const lng = Number(point[1])
        return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
      }

      if (point && typeof point === 'object') {
        const source = point as { lat?: unknown; lng?: unknown; lon?: unknown; latitude?: unknown; longitude?: unknown }
        const lat = Number(source.lat ?? source.latitude)
        const lng = Number(source.lng ?? source.lon ?? source.longitude)
        return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null
      }

      return null
    })
    .filter((point): point is [number, number] => point !== null)
}

// ─── Reverse geocode ──────────────────────────────────────────────────────────

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'FitMeetApp/1.0' } },
    )
    const data = await res.json()
    if (!data.address) return ''
    const a = data.address
    return [a.city || a.town || a.village || a.county, a.country].filter(Boolean).join(', ')
  } catch { return '' }
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildDrawRouteHtml(
  initCategory: string,
  initWaypoints: [number, number][],
  initTrack: [number, number][],
  topInset: number,
  bottomInset: number,
): string {
  const waypointsJson = JSON.stringify(initWaypoints)
  const trackJson = JSON.stringify(initTrack)

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
  html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#050816;overflow:hidden;}
  .leaflet-control-attribution{display:none!important;}

  #top-bar{
    position:fixed;top:${topInset + 8}px;left:0;right:0;z-index:1000;
    display:flex;align-items:center;gap:8px;padding:0 10px;
    pointer-events:none;
  }
  #search-row{
    position:fixed;top:${topInset + 54}px;left:10px;right:10px;z-index:1000;
    display:flex;gap:8px;pointer-events:none;
  }
  #search-input{
    pointer-events:all;min-width:0;flex:1;height:40px;
    background:rgba(5,8,22,0.9);border:1.5px solid rgba(255,255,255,0.14);
    border-radius:12px;color:#f5f7ff;padding:0 12px;font-size:14px;font-weight:700;
    outline:none;
  }
  #search-btn{
    pointer-events:all;height:40px;padding:0 14px;border-radius:12px;border:none;
    background:#6cff2f;color:#031109;font-size:12px;font-weight:900;
  }
  #stats-pill{
    pointer-events:none;
    flex:1;text-align:center;
    background:rgba(5,8,22,0.82);border:1px solid rgba(255,255,255,0.1);
    border-radius:16px;padding:7px 10px;
    color:#6cff2f;font-size:12px;font-weight:800;
    min-height:38px;
  }
  .stat-main{display:flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;}
  .stat-sub{margin-top:1px;color:#b3bdd7;font-size:10px;font-weight:700;white-space:nowrap;}
  #gps-btn{
    pointer-events:all;
    background:rgba(5,8,22,0.88);border:1.5px solid rgba(255,255,255,0.14);
    border-radius:12px;width:38px;height:38px;
    display:flex;align-items:center;justify-content:center;
    font-size:18px;cursor:pointer;
  }
  #layer-wrap{
    pointer-events:all;position:relative;flex-shrink:0;
  }
  #layer-btn{
    height:38px;padding:0 10px;border-radius:12px;
    background:rgba(5,8,22,0.88);border:1.5px solid rgba(255,255,255,0.14);
    color:#f5f7ff;font-size:12px;font-weight:800;cursor:pointer;
  }
  #layer-menu{
    position:absolute;top:44px;right:0;min-width:112px;
    padding:4px;border-radius:14px;
    background:rgba(5,8,22,0.94);border:1px solid rgba(255,255,255,0.14);
    display:none;
  }
  #layer-menu.show{display:block;}
  .layer-option{
    padding:8px 10px;border-radius:10px;
    color:#f5f7ff;font-size:12px;font-weight:800;cursor:pointer;
  }
  .layer-option.active{background:#6cff2f;color:#031109;}

  #bottom-panel{
    position:fixed;bottom:0;left:0;right:0;z-index:1000;
    background:rgba(5,8,22,0.94);
    border-top:1px solid rgba(255,255,255,0.1);
    padding-bottom:${bottomInset + 6}px;
  }
  #elev-panel{
    padding:8px 10px 2px;
    display:none;
  }
  #elev-panel.show{display:block;}
  #elev-chart{
    width:100%;height:54px;border-radius:12px;
    background:rgba(255,255,255,0.055);
  }
  #cat-row{
    display:flex;gap:6px;padding:10px 10px 4px;
    overflow-x:auto;-webkit-overflow-scrolling:touch;
    scrollbar-width:none;
  }
  #cat-row::-webkit-scrollbar{display:none;}
  .cat-chip{
    flex-shrink:0;padding:6px 12px;border-radius:20px;
    border:1.5px solid rgba(255,255,255,0.15);
    background:transparent;color:#b3bdd7;
    font-size:12px;font-weight:700;cursor:pointer;
    white-space:nowrap;transition:all 0.15s;
  }
  .cat-chip.active{
    border-color:#6cff2f;background:rgba(108,255,47,0.12);color:#6cff2f;
  }
  #action-row{
    display:flex;gap:8px;padding:4px 10px 6px;
  }
  #back-btn,#undo-btn{
    flex:1;padding:10px;border-radius:14px;
    border:1.5px solid rgba(255,255,255,0.15);background:transparent;
    color:#b3bdd7;font-size:13px;font-weight:700;cursor:pointer;
  }
  #done-btn{
    flex:1.45;padding:10px;border-radius:14px;
    background:#6cff2f;border:none;
    color:#031109;font-size:14px;font-weight:900;cursor:pointer;
  }
  #done-btn:disabled,#undo-btn:disabled{opacity:0.4;}

  /* loading overlay */
  #loading-overlay{
    position:fixed;inset:0;z-index:2000;
    background:rgba(5,8,22,0.7);
    display:none;align-items:center;justify-content:center;
  }
  #loading-overlay.show{display:flex;}
  .spinner{
    width:36px;height:36px;border:3px solid rgba(108,255,47,0.2);
    border-top-color:#6cff2f;border-radius:50%;
    animation:spin 0.8s linear infinite;
  }
  @keyframes spin{to{transform:rotate(360deg);}}
</style>
</head>
<body>
<div id="map"></div>

<div id="top-bar">
  <div id="stats-pill">Tap map to add points</div>
  <div id="layer-wrap">
    <button id="layer-btn" onclick="toggleLayerMenu()">Standard</button>
    <div id="layer-menu"></div>
  </div>
  <div id="gps-btn" onclick="useGPS()">&#128205;</div>
</div>

<div id="search-row">
  <input id="search-input" placeholder="Search city or place" onkeydown="if(event.key==='Enter'){searchPlace();}"/>
  <button id="search-btn" onclick="searchPlace()">Go</button>
</div>

<div id="bottom-panel">
  <div id="elev-panel"><svg id="elev-chart" viewBox="0 0 320 54"></svg></div>
  <div id="cat-row"></div>
  <div id="action-row">
    <button id="back-btn" onclick="goBack()">&#8592; Back</button>
    <button id="done-btn" onclick="done()" disabled>Save &#8250;</button>
    <button id="undo-btn" onclick="undoLast()" disabled>&#8617; Undo</button>
  </div>
</div>

<div id="loading-overlay"><div class="spinner"></div></div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
// ── State ──────────────────────────────────────────────────────────────────
var waypoints = [];   // [{latlng:[lat,lng], marker}]
var segments  = [];   // [{fromIdx, toIdx, polyline, coords, distM}]
var coloredRouteLayers = [];
var category  = '${initCategory}';
var pendingRouting = 0;
var elevDebounce = null;
var selectedIdx = null;
var activeLayerKey = 'standard';
var activeBaseLayer = null;

// ── Helpers ───────────────────────────────────────────────────────────────
function send(obj) {
  window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(obj));
}

var BASE_LAYERS = {
  standard: {
    label: 'Standard',
    layer: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19})
  },
  satellite: {
    label: 'Satellite',
    layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {maxZoom:19})
  },
  terrain: {
    label: 'Terrain',
    layer: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {maxZoom:17})
  }
};

function setBaseLayer(key) {
  var next = BASE_LAYERS[key] ? key : 'standard';
  if (activeBaseLayer) map.removeLayer(activeBaseLayer);
  activeLayerKey = next;
  activeBaseLayer = BASE_LAYERS[next].layer;
  activeBaseLayer.addTo(map);
  document.getElementById('layer-btn').textContent = BASE_LAYERS[next].label;
  renderLayerMenu(false);
}

function toggleLayerMenu() {
  var menu = document.getElementById('layer-menu');
  renderLayerMenu(!menu.classList.contains('show'));
}

function renderLayerMenu(open) {
  var menu = document.getElementById('layer-menu');
  if (!menu) return;
  menu.innerHTML = '';
  Object.keys(BASE_LAYERS).forEach(function(key) {
    var opt = document.createElement('div');
    opt.className = 'layer-option' + (key === activeLayerKey ? ' active' : '');
    opt.textContent = BASE_LAYERS[key].label;
    opt.onclick = function(e) {
      e.stopPropagation();
      setBaseLayer(key);
    };
    menu.appendChild(opt);
  });
  menu.className = open ? 'show' : '';
}


function haversineM(a, b) {
  var R = 6371000, dLat = (b[0]-a[0])*Math.PI/180, dLon = (b[1]-a[1])*Math.PI/180;
  var x = Math.sin(dLat/2)**2 + Math.cos(a[0]*Math.PI/180)*Math.cos(b[0]*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

function totalDistM() {
  return segments.reduce(function(s,seg){return s+seg.distM;}, 0);
}

function buildFullTrack() {
  var track = [];
  segments.forEach(function(seg, i) {
    if (!seg) return;
    if (i===0) seg.coords.forEach(function(c){track.push(c);});
    else seg.coords.slice(1).forEach(function(c){track.push(c);});
  });
  if (track.length===0 && waypoints.length===1) track.push(waypoints[0].latlng);
  return track;
}

function sampleTrack(track, max) {
  if (track.length <= max) return track;
  var result = [], step = (track.length-1)/(max-1);
  for (var i=0;i<max;i++) result.push(track[Math.round(i*step)]);
  return result;
}

function sampleTrackWithIndexes(track, max) {
  if (track.length <= max) {
    return {
      points: track,
      indexes: track.map(function(_, i) { return i; })
    };
  }
  var points = [], indexes = [], step = (track.length-1)/(max-1);
  for (var i=0;i<max;i++) {
    var idx = Math.round(i*step);
    points.push(track[idx]);
    indexes.push(idx);
  }
  return { points: points, indexes: indexes };
}

function slopeColorForGrade(grade) {
  if (grade < -2) return '#39ff14';
  if (grade < 3) return '#3399ff';
  if (grade < 7) return '#ffaa00';
  return '#ff2200';
}

function clearColoredRouteLayers() {
  coloredRouteLayers.forEach(function(layer) { map.removeLayer(layer); });
  coloredRouteLayers = [];
}

function renderColoredRouteLayers(track, sampled, sampleIndexes, elevs) {
  clearColoredRouteLayers();
  if (!track || !sampled || !sampleIndexes || !elevs || sampled.length < 2 || elevs.length < 2) return;
  for (var i=1;i<Math.min(sampled.length, elevs.length);i++) {
    var distM = haversineM(sampled[i-1], sampled[i]);
    var grade = distM > 0 ? ((elevs[i] - elevs[i-1]) / distM) * 100 : 0;
    var fromIdx = sampleIndexes[i-1];
    var toIdx = sampleIndexes[i];
    var coords = track.slice(fromIdx, toIdx + 1);
    if (coords.length < 2) coords = [sampled[i-1], sampled[i]];
    var poly = L.polyline(coords, {
      color: slopeColorForGrade(grade),
      weight: 5,
      opacity: 0.98,
      lineJoin: 'round',
      lineCap: 'round'
    }).addTo(map);
    coloredRouteLayers.push(poly);
  }
}

function makeIcon(num, selected, isLast) {
  var bg = selected ? '#fbbf24' : isLast ? '#ff2200' : '#6cff2f';
  return L.divIcon({
    className:'',
    html:'<div style="width:28px;height:28px;border-radius:50%;background:'+bg+';color:#031109;font-weight:900;font-size:11px;display:flex;align-items:center;justify-content:center;border:2.5px solid rgba(0,0,0,0.2);box-shadow:0 2px 8px rgba(0,0,0,0.6);cursor:pointer;">'+num+'</div>',
    iconSize:[28,28], iconAnchor:[14,14]
  });
}

function refreshMarkerIcons() {
  waypoints.forEach(function(wp, i) {
    wp.marker.setIcon(makeIcon(i+1, i===selectedIdx, i===waypoints.length-1 && waypoints.length>1));
  });
}

function updateStats() {
  var distKm = Math.round(totalDistM()/100)/10;
  var pill = document.getElementById('stats-pill');
  if (waypoints.length === 0) {
    pill.textContent = 'Tap map to add points';
  } else if (waypoints.length === 1) {
    pill.textContent = '1 point — keep going';
  } else {
    pill.textContent = distKm.toFixed(1)+' km · '+waypoints.length+' pts';
  }
  var doneBtn = document.getElementById('done-btn');
  doneBtn.disabled = waypoints.length < 2;
  var undoBtn = document.getElementById('undo-btn');
  undoBtn.disabled = waypoints.length === 0;
}

function showLoading(v) {
  document.getElementById('loading-overlay').className = v ? 'show' : '';
}

function updateStats() {
  var distKm = Math.round(totalDistM()/100)/10;
  var pill = document.getElementById('stats-pill');
  if (waypoints.length === 0) {
    pill.textContent = 'Tap map to add points';
  } else if (waypoints.length === 1) {
    pill.innerHTML = '<div class="stat-main">1 point</div><div class="stat-sub">Keep going for distance and elevation</div>';
  } else {
    pill.innerHTML = '<div class="stat-main"><span>'+distKm.toFixed(1)+' km</span><span>'+waypoints.length+' pts</span></div><div class="stat-sub">Calculating elevation...</div>';
  }
  var doneBtn = document.getElementById('done-btn');
  doneBtn.disabled = waypoints.length < 2;
  var undoBtn = document.getElementById('undo-btn');
  undoBtn.disabled = waypoints.length === 0;
}

// ── Polyline6 decoder (Valhalla uses precision 6) ────────────────────────
function decodePolyline6(encoded) {
  var coords = [], index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    var b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coords.push([lat / 1e6, lng / 1e6]);
  }
  return coords;
}

// ── Valhalla fetch ────────────────────────────────────────────────────────
var VALHALLA_ENDPOINTS = [
  'https://valhalla.openstreetmap.de/route',
  'https://valhalla1.openstreetmap.de/route'
];

async function fetchValhalla(from, to, costing, options) {
  var body = JSON.stringify({
    locations: [{ lon: from[1], lat: from[0] }, { lon: to[1], lat: to[0] }],
    costing: costing,
    costing_options: options ? { [costing]: options } : undefined,
    units: 'km',
  });
  for (var i = 0; i < VALHALLA_ENDPOINTS.length; i++) {
    try {
      var res = await fetch(VALHALLA_ENDPOINTS[i], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
      });
      if (!res.ok) continue;
      var data = await res.json();
      if (!data.trip || !data.trip.legs || !data.trip.legs.length) continue;
      var leg = data.trip.legs[0];
      var coords = decodePolyline6(leg.shape);
      return { coords: coords, distM: leg.summary.length * 1000 };
    } catch(e) {}
  }
  return null;
}

function valhallaCosting(cat) {
  if (cat === 'cycling') return { costing: 'bicycle', options: { use_roads: 1.0 } };
  if (cat === 'running') return { costing: 'pedestrian', options: {} };
  if (cat === 'hiking')  return { costing: 'pedestrian', options: { max_hiking_difficulty: 1 } };
  return null;
}

async function fetchOsrmRoad(from, to) {
  try {
    var url = 'https://router.project-osrm.org/route/v1/driving/' +
      from[1] + ',' + from[0] + ';' + to[1] + ',' + to[0] +
      '?overview=full&geometries=geojson&radiuses=200;200';
    var res = await fetch(url);
    if (!res.ok) return null;
    var data = await res.json();
    var route = data.routes && data.routes[0];
    var raw = route && route.geometry && route.geometry.coordinates;
    if (!raw || raw.length < 2) return null;
    var coords = raw.map(function(p) { return [p[1], p[0]]; });
    return { coords: coords, distM: route.distance };
  } catch(e) { return null; }
}

// ── Elevation fetch ──────────────────────────────────────────────────────
async function fetchElevGain(track) {
  if (track.length < 2) return 0;
  var sampled = sampleTrack(track, 100);
  var lats = sampled.map(function(p){return p[0].toFixed(5);}).join(',');
  var lngs = sampled.map(function(p){return p[1].toFixed(5);}).join(',');
  try {
    var res = await fetch('https://api.open-meteo.com/v1/elevation?latitude='+lats+'&longitude='+lngs);
    if (!res.ok) return 0;
    var data = await res.json();
    var elevs = data.elevation || [];
    var gain = 0;
    for (var i=1;i<elevs.length;i++) if (elevs[i]>elevs[i-1]) gain+=elevs[i]-elevs[i-1];
    return Math.round(gain);
  } catch(e) { return 0; }
}

function scheduleElevation() {
  if (elevDebounce) clearTimeout(elevDebounce);
  elevDebounce = setTimeout(async function() {
    var track = buildFullTrack();
    var gain = await fetchElevGain(track);
    var distKm = Math.round(totalDistM()/100)/10;
    var pill = document.getElementById('stats-pill');
    if (waypoints.length >= 2) {
      pill.textContent = distKm.toFixed(1)+' km · ↑'+gain+' m · '+waypoints.length+' pts';
    }
    window._elevGain = gain;
  }, 900);
}

// ── Route segment ─────────────────────────────────────────────────────────
async function fetchElevationData(track) {
  if (track.length < 2) return {gain:0,elevs:[]};
  var sampledInfo = sampleTrackWithIndexes(track, 100);
  var sampled = sampledInfo.points;
  var lats = sampled.map(function(p){return p[0].toFixed(5);}).join(',');
  var lngs = sampled.map(function(p){return p[1].toFixed(5);}).join(',');
  try {
    var res = await fetch('https://api.open-meteo.com/v1/elevation?latitude='+lats+'&longitude='+lngs);
    if (!res.ok) return {gain:0,elevs:[]};
    var data = await res.json();
    var elevs = data.elevation || [];
    var gain = 0;
    for (var i=1;i<elevs.length;i++) if (elevs[i]>elevs[i-1]) gain+=elevs[i]-elevs[i-1];
    return {gain:Math.round(gain),elevs:elevs,sampled:sampled,sampleIndexes:sampledInfo.indexes};
  } catch(e) { return {gain:0,elevs:[],sampled:[],sampleIndexes:[]}; }
}

async function fetchElevGain(track) {
  var elev = await fetchElevationData(track);
  return elev.gain;
}

function renderElevationChart(elevs) {
  var panel = document.getElementById('elev-panel');
  var svg = document.getElementById('elev-chart');
  if (!panel || !svg || !elevs || elevs.length < 2) {
    if (panel) panel.className = '';
    return;
  }
  var w = 320, h = 54, pad = 6;
  var min = Math.min.apply(null, elevs);
  var max = Math.max.apply(null, elevs);
  var range = Math.max(max-min, 1);
  var points = elevs.map(function(ele, i) {
    var x = pad + (i/(elevs.length-1))*(w-pad*2);
    var y = h - pad - ((ele-min)/range)*(h-pad*2);
    return {x:x, y:y, ele:ele};
  });
  function segmentColor(delta) {
    if (delta < -2) return '#39ff14';
    if (delta < 3) return '#3399ff';
    if (delta < 7) return '#ffaa00';
    return '#ff2200';
  }
  var baseline = h - pad;
  var fills = '';
  var lines = '';
  for (var i=1;i<points.length;i++) {
    var prev = points[i-1];
    var cur = points[i];
    var color = segmentColor(cur.ele - prev.ele);
    fills += '<polygon points="'+prev.x+','+baseline+' '+prev.x+','+prev.y+' '+cur.x+','+cur.y+' '+cur.x+','+baseline+'" fill="'+color+'" opacity="0.14"></polygon>';
    lines += '<line x1="'+prev.x+'" y1="'+prev.y+'" x2="'+cur.x+'" y2="'+cur.y+'" stroke="'+color+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></line>';
  }
  svg.innerHTML = fills + lines;
  panel.className = 'show';
}

function scheduleElevation() {
  if (elevDebounce) clearTimeout(elevDebounce);
  elevDebounce = setTimeout(async function() {
    var track = buildFullTrack();
    var elev = await fetchElevationData(track);
    var gain = elev.gain;
    var distKm = Math.round(totalDistM()/100)/10;
    var pill = document.getElementById('stats-pill');
    if (waypoints.length >= 2) {
      pill.innerHTML = '<div class="stat-main"><span>'+distKm.toFixed(1)+' km</span><span>'+gain+' m up</span><span>'+waypoints.length+' pts</span></div><div class="stat-sub">Drag points to reshape route</div>';
    }
    renderElevationChart(elev.elevs);
    renderColoredRouteLayers(track, elev.sampled, elev.sampleIndexes, elev.elevs);
    window._elevGain = gain;
  }, 900);
}

async function searchPlace() {
  var input = document.getElementById('search-input');
  var q = input && input.value ? input.value.trim() : '';
  if (!q) return;
  try {
    var res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q='+encodeURIComponent(q), {
      headers: {'Accept-Language':'en'}
    });
    var data = await res.json();
    if (data && data[0]) map.setView([Number(data[0].lat), Number(data[0].lon)], 13);
  } catch(e) {}
}

async function routeSegment(fromIdx) {
  var from = waypoints[fromIdx];
  var to   = waypoints[fromIdx+1];
  if (!from || !to) return;
  pendingRouting++;
  showLoading(pendingRouting > 0);
  clearColoredRouteLayers();

  // Placeholder line
  var placeholder = L.polyline([from.latlng, to.latlng], {
    color:'rgba(255,255,255,0.25)', weight:3, dashArray:'6 8'
  }).addTo(map);

  // Remove old segment
  if (segments[fromIdx]) {
    map.removeLayer(segments[fromIdx].polyline);
    segments[fromIdx] = null;
  }

  var costingInfo = valhallaCosting(category);
  var result = null;
  if (costingInfo) result = await fetchValhalla(from.latlng, to.latlng, costingInfo.costing, costingInfo.options);
  if (!result && category === 'cycling') result = await fetchOsrmRoad(from.latlng, to.latlng);

  // Fallback to straight line
  if (!result) {
    result = { coords: [from.latlng, to.latlng], distM: haversineM(from.latlng, to.latlng) };
  }

  map.removeLayer(placeholder);

  var poly = L.polyline(result.coords, {color:'#6cff2f', weight:4, opacity:0.9, lineJoin:'round'}).addTo(map);
  segments[fromIdx] = { polyline: poly, coords: result.coords, distM: result.distM };

  pendingRouting--;
  showLoading(pendingRouting > 0);
  updateStats();
  scheduleElevation();
}

// ── Add waypoint ──────────────────────────────────────────────────────────
function addWaypoint(latlng) {
  var idx = waypoints.length;
  var isLast = true;

  var marker = L.marker(latlng, {
    icon: makeIcon(idx+1, false, isLast),
    draggable: true
  });

  marker.on('click', function() {
    selectedIdx = (selectedIdx === idx) ? null : idx;
    refreshMarkerIcons();
  });

  marker.on('drag', function(e) {
    var pos = e.target.getLatLng();
    var newLL = [pos.lat, pos.lng];
    waypoints[idx].latlng = newLL;
    if (segments[idx-1]) segments[idx-1].polyline.setLatLngs([waypoints[idx-1].latlng, newLL]);
    if (segments[idx])   segments[idx].polyline.setLatLngs([newLL, waypoints[idx+1] && waypoints[idx+1].latlng || newLL]);
  });

  marker.on('dragend', async function() {
    var pos = marker.getLatLng();
    waypoints[idx].latlng = [pos.lat, pos.lng];
    var promises = [];
    if (idx > 0) promises.push(routeSegment(idx-1));
    if (idx < waypoints.length-1) promises.push(routeSegment(idx));
    await Promise.all(promises);
  });

  marker.addTo(map);

  if (idx > 0) {
    waypoints[idx-1].marker.setIcon(makeIcon(idx, false, false));
  }

  waypoints.push({ latlng: latlng, marker: marker });
  selectedIdx = null;

  if (idx > 0) {
    routeSegment(idx-1);
  } else {
    updateStats();
  }
}

// ── Remove waypoint ───────────────────────────────────────────────────────
async function removeWaypoint(idx) {
  map.removeLayer(waypoints[idx].marker);

  // Remove adjacent segments
  if (segments[idx-1]) { map.removeLayer(segments[idx-1].polyline); segments.splice(idx-1,1); }
  if (segments[idx-1]) { map.removeLayer(segments[idx-1].polyline); segments.splice(idx-1,1); }

  waypoints.splice(idx, 1);

  waypoints.forEach(function(wp, i) {
    var isL = i===waypoints.length-1 && waypoints.length>1;
    wp.marker.setIcon(makeIcon(i+1, false, isL));
    wp.marker.off('click');
    wp.marker.on('click', (function(capturedI){
      return function() { selectedIdx = (selectedIdx===capturedI) ? null : capturedI; refreshMarkerIcons(); };
    })(i));
    wp.marker.off('drag');
    wp.marker.on('drag', (function(capturedI){
      return function(e) {
        var pos = e.target.getLatLng();
        var newLL = [pos.lat, pos.lng];
        waypoints[capturedI].latlng = newLL;
        if (segments[capturedI-1]) segments[capturedI-1].polyline.setLatLngs([waypoints[capturedI-1].latlng, newLL]);
        if (segments[capturedI])   segments[capturedI].polyline.setLatLngs([newLL, waypoints[capturedI+1] ? waypoints[capturedI+1].latlng : newLL]);
      };
    })(i));
    wp.marker.off('dragend');
    wp.marker.on('dragend', (function(capturedI){
      return async function() {
        var pos = waypoints[capturedI].marker.getLatLng();
        waypoints[capturedI].latlng = [pos.lat, pos.lng];
        var ps = [];
        if (capturedI > 0) ps.push(routeSegment(capturedI-1));
        if (capturedI < waypoints.length-1) ps.push(routeSegment(capturedI));
        await Promise.all(ps);
      };
    })(i));
  });

  selectedIdx = null;

  if (idx > 0 && idx <= waypoints.length) {
    await routeSegment(idx-1);
  } else {
    updateStats();
    scheduleElevation();
  }
}

// ── Undo ──────────────────────────────────────────────────────────────────
function undoLast() {
  if (waypoints.length === 0) return;
  removeWaypoint(waypoints.length-1);
}

// ── Done ──────────────────────────────────────────────────────────────────
async function done() {
  if (waypoints.length < 2) return;
  var doneBtn = document.getElementById('done-btn');
  doneBtn.disabled = true;
  doneBtn.textContent = '...';
  if (elevDebounce) { clearTimeout(elevDebounce); elevDebounce = null; }
  var track = buildFullTrack();
  var distKm = Math.round(totalDistM()/100)/10;
  var gain = await fetchElevGain(track);
  window._elevGain = gain;
  send({
    type: 'done',
    waypoints: waypoints.map(function(wp){return wp.latlng;}),
    track: track,
    distanceKm: distKm,
    elevGain: gain,
    category: category,
    startLat: waypoints[0].latlng[0],
    startLng: waypoints[0].latlng[1],
    endLat: waypoints[waypoints.length-1].latlng[0],
    endLng: waypoints[waypoints.length-1].latlng[1],
  });
}

function goBack() { send({ type: 'back' }); }

// ── GPS ───────────────────────────────────────────────────────────────────
function useGPS() {
  navigator.geolocation && navigator.geolocation.getCurrentPosition(function(pos) {
    map.setView([pos.coords.latitude, pos.coords.longitude], 14);
  }, null, {timeout:8000});
}

// ── Track helpers (for GPX pre-population) ───────────────────────────────
function findClosestIdx(track, point, from) {
  var minDist = Infinity, minIdx = from;
  for (var i=from;i<track.length;i++) {
    var d = Math.sqrt(Math.pow(track[i][0]-point[0],2)+Math.pow(track[i][1]-point[1],2));
    if (d < minDist) { minDist=d; minIdx=i; }
  }
  return minIdx;
}
function segmentLength(coords) {
  var R=6371000, total=0;
  for (var i=1;i<coords.length;i++) {
    var dLat=(coords[i][0]-coords[i-1][0])*Math.PI/180;
    var dLon=(coords[i][1]-coords[i-1][1])*Math.PI/180;
    var a=Math.pow(Math.sin(dLat/2),2)+Math.cos(coords[i-1][0]*Math.PI/180)*Math.cos(coords[i][0]*Math.PI/180)*Math.pow(Math.sin(dLon/2),2);
    total+=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }
  return total;
}

// ── Add waypoint without triggering routing (used when pre-loading GPX) ──
function addWaypointNoRoute(latlng) {
  var idx = waypoints.length;
  var marker = L.marker(latlng, {
    icon: makeIcon(idx+1, false, true),
    draggable: true
  });
  marker.on('click', (function(capturedI){
    return function() { selectedIdx=(selectedIdx===capturedI)?null:capturedI; refreshMarkerIcons(); };
  })(idx));
  marker.on('drag', (function(capturedI){
    return function(e) {
      var pos=e.target.getLatLng(); var newLL=[pos.lat,pos.lng];
      waypoints[capturedI].latlng=newLL;
      if (segments[capturedI-1]) segments[capturedI-1].polyline.setLatLngs([waypoints[capturedI-1].latlng,newLL]);
      if (segments[capturedI])   segments[capturedI].polyline.setLatLngs([newLL,waypoints[capturedI+1]?waypoints[capturedI+1].latlng:newLL]);
    };
  })(idx));
  marker.on('dragend', (function(capturedI){
    return async function() {
      var pos=marker.getLatLng(); waypoints[capturedI].latlng=[pos.lat,pos.lng];
      var ps=[];
      if (capturedI>0) ps.push(routeSegment(capturedI-1));
      if (capturedI<waypoints.length-1) ps.push(routeSegment(capturedI));
      await Promise.all(ps);
    };
  })(idx));
  marker.addTo(map);
  if (idx>0) waypoints[idx-1].marker.setIcon(makeIcon(idx,false,false));
  waypoints.push({latlng:latlng,marker:marker});
  selectedIdx=null;
}

// ── Re-route all (category change) ───────────────────────────────────────
async function rerouteAll() {
  if (waypoints.length < 2) return;
  var promises = [];
  for (var i=0;i<waypoints.length-1;i++) promises.push(routeSegment(i));
  await Promise.all(promises);
}

// ── Category chips ────────────────────────────────────────────────────────
var CATS = [
  {v:'running',  e:'🏃', l:'Run'},
  {v:'cycling',  e:'🚴', l:'Bike'},
  {v:'hiking',   e:'🥾', l:'Hike'},
  {v:'skiing',   e:'⛷️', l:'Ski'},
  {v:'climbing', e:'🏔️', l:'Climb'},
  {v:'kayaking', e:'🚣', l:'Kayak'},
  {v:'other',    e:'✏️', l:'Free'},
];

function renderCats() {
  var row = document.getElementById('cat-row');
  row.innerHTML = '';
  CATS.forEach(function(cat) {
    var btn = document.createElement('div');
    btn.className = 'cat-chip' + (cat.v === category ? ' active' : '');
    btn.textContent = cat.e + ' ' + cat.l;
    btn.onclick = function() {
      if (cat.v === category) return;
      category = cat.v;
      renderCats();
      rerouteAll();
    };
    row.appendChild(btn);
  });
}

// Stop cat-row touch from propagating to map
document.addEventListener('DOMContentLoaded', function() {
  var catRow = document.getElementById('cat-row');
  catRow.addEventListener('touchmove', function(e){ e.stopPropagation(); }, {passive:false});
  catRow.addEventListener('touchstart', function(e){ e.stopPropagation(); }, {passive:false});
  catRow.addEventListener('touchend', function(e){ e.stopPropagation(); }, {passive:false});
});

// ── Map init ─────────────────────────────────────────────────────────────
var map = L.map('map', {
  center: [44.5, 16.5], zoom: 7,
  zoomControl: false, attributionControl: false,
  tap: false
});
L.control.zoom({position:'bottomright'}).addTo(map);
setBaseLayer('standard');

map.on('click', function(e) {
  if (pendingRouting > 0) return;
  addWaypoint([e.latlng.lat, e.latlng.lng]);
});

renderCats();
window._elevGain = 0;

// ── Load initial waypoints ────────────────────────────────────────────────
var initWaypoints = ${waypointsJson};
var initTrack     = ${trackJson};
if (initWaypoints.length > 0) {
  (async function() {
    showLoading(true);
    if (initTrack.length >= 2) {
      // Pre-populate from saved GPX track — no Valhalla re-routing
      for (var i=0; i<initWaypoints.length; i++) addWaypointNoRoute(initWaypoints[i]);
      var prevIdx = 0;
      for (var i=1; i<waypoints.length; i++) {
        var tIdx = findClosestIdx(initTrack, waypoints[i].latlng, prevIdx);
        var coords = initTrack.slice(prevIdx, tIdx+1);
        var distM = segmentLength(coords);
        var poly = L.polyline(coords, {color:'#6cff2f',weight:4,opacity:0.9,lineJoin:'round'}).addTo(map);
        segments[i-1] = {polyline:poly, coords:coords, distM:distM};
        prevIdx = tIdx;
      }
      updateStats();
      scheduleElevation();
    } else {
      // No track available — route via Valhalla
      for (var i=0; i<initWaypoints.length; i++) {
        addWaypoint(initWaypoints[i]);
        if (i < initWaypoints.length-1) await new Promise(function(r){setTimeout(r,60);});
      }
    }
    showLoading(false);
    if (initWaypoints.length > 1) {
      map.fitBounds(L.latLngBounds(initWaypoints), {padding:[40,40]});
    } else {
      map.setView(initWaypoints[0], 13);
    }
  })();
}
</script>
</body>
</html>`
}

// ─── Screen ───────────────────────────────────────────────────────────────────

interface DrawPayload {
  waypoints: [number, number][]
  track: [number, number][]
  distanceKm: number
  elevGain: number
  category: string
  startLat: number
  startLng: number
  endLat: number
  endLng: number
}

export default function DrawRouteScreen() {
  const { id: editId } = useLocalSearchParams<{ id?: string }>()
  const { user } = useAuthStore()
  const insets = useSafeAreaInsets()

  const webViewRef = useRef<WebView>(null)

  const [initCategory, setInitCategory] = useState('running')
  const [initWaypoints, setInitWaypoints] = useState<[number, number][]>([])
  const [initTrack, setInitTrack] = useState<[number, number][]>([])
  const [loadingEdit, setLoadingEdit] = useState(!!editId)

  // Save modal
  const [showModal, setShowModal] = useState(false)
  const [payload, setPayload] = useState<DrawPayload | null>(null)
  const [title, setTitle] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editId) return
    api.get(`/routes/${editId}`)
      .then(async ({ data }) => {
        const route = data.data
        if (route.creator?.id !== user?.id) { router.back(); return }
        setTitle(route.title ?? '')
        setInitCategory(route.category?.value ?? 'running')
        setIsPublic(route.is_public ?? true)
        let loadedWaypoints = normalizeWaypoints(route.waypoints)
        if (loadedWaypoints.length >= 2) setInitWaypoints(downsampleTrack(loadedWaypoints, 25))
        if (route.gpx_url) {
          try {
            const gpxRes = await api.get(`/routes/${route.id}/gpx`, { responseType: 'text' })
            const track = parseGpxTrack(gpxRes.data as string)
            if (track.length >= 2) {
              setInitTrack(downsampleTrack(track, 500))
              if (loadedWaypoints.length < 2) {
                loadedWaypoints = downsampleTrack(track, 25)
                setInitWaypoints(loadedWaypoints)
              }
            }
          } catch { /* no track — will re-route */ }
        }
      })
      .catch(() => router.back())
      .finally(() => setLoadingEdit(false))
  }, [editId, user?.id])

  function handleMessage(event: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(event.nativeEvent.data)
      if (msg.type === 'back') { router.back(); return }
      if (msg.type === 'done') {
        setPayload(msg as DrawPayload)
        setShowModal(true)
      }
    } catch {}
  }

  async function handleSave() {
    if (!payload || !title.trim()) {
      Alert.alert('Name required', 'Please enter a route name.')
      return
    }
    setSaving(true)
    try {
      const areaLabel = await reverseGeocode(payload.startLat, payload.startLng)
      const elevations = await fetchTrackElevations(payload.track)
      const gpxContent = buildGpx(payload.track, title, elevations)
      const tempUri = FileSystem.cacheDirectory + `route-${Date.now()}.gpx`
      await FileSystem.writeAsStringAsync(tempUri, gpxContent, { encoding: 'utf8' })

      const form = new FormData()
      form.append('title', title.trim())
      form.append('category', payload.category)
      form.append('is_public', isPublic ? '1' : '0')
      form.append('waypoints', JSON.stringify(payload.waypoints))
      form.append('gpx', { uri: tempUri, type: 'application/gpx+xml', name: 'route.gpx' } as unknown as Blob)
      form.append('distance_km', String(payload.distanceKm))
      form.append('elevation_gain', String(payload.elevGain))
      form.append('start_lat', String(payload.startLat))
      form.append('start_lng', String(payload.startLng))
      form.append('end_lat', String(payload.endLat))
      form.append('end_lng', String(payload.endLng))
      if (areaLabel) form.append('area_label', areaLabel)

      if (editId) {
        form.append('_method', 'PUT')
        await api.post(`/routes/${editId}`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        router.replace(`/route/${editId}` as never)
      } else {
        const { data } = await api.post('/routes', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        router.replace(`/route/${data.data.id}` as never)
      }
      setShowModal(false)
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: unknown } }
      const detail = err?.response?.data ? JSON.stringify(err.response.data) : String(e)
      Alert.alert('Save error', `${err?.response?.status ?? '?'}: ${detail}`)
    } finally {
      setSaving(false)
    }
  }

  if (loadingEdit) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.accent} size="large" />
      </View>
    )
  }

  const html = buildDrawRouteHtml(initCategory, initWaypoints, initTrack, insets.top, insets.bottom)
  const webViewKey = `${editId ?? 'new'}-${initCategory}-${initWaypoints.length}-${initTrack.length}`

  return (
    <View style={styles.root}>
      <WebView
        key={webViewKey}
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled
        scrollEnabled={false}
        originWhitelist={['*']}
        allowsInlineMediaPlayback
        domStorageEnabled
        geolocationEnabled
      />

      {/* Save modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />

              <Text style={styles.modalTitle}>{editId ? 'Save Changes' : 'Save Route'}</Text>

              {payload && (
                <View style={styles.modalStats}>
                  <Text style={styles.modalStatText}>{payload.distanceKm.toFixed(1)} km</Text>
                  {payload.elevGain > 0 && (
                    <Text style={styles.modalStatText}>↑ {payload.elevGain} m</Text>
                  )}
                </View>
              )}

              <Text style={styles.label}>Route name</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Morning trail Šibenik"
                placeholderTextColor={palette.textDim}
                style={styles.input}
                maxLength={140}
                autoFocus
              />

              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.toggleLabel}>Public</Text>
                  <Text style={styles.toggleSub}>
                    {isPublic ? 'Visible to all users' : 'Only you can see it'}
                  </Text>
                </View>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  trackColor={{ false: palette.line, true: palette.accent }}
                  thumbColor="#fff"
                />
              </View>

              <Pressable style={[styles.saveBtn, saving && styles.saveBtnDim]} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="#031109" />
                  : <Text style={styles.saveBtnText}>{editId ? 'Save Changes' : 'Save Route'}</Text>
                }
              </Pressable>

              <Pressable style={styles.cancelBtn} onPress={() => setShowModal(false)} disabled={saving}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050816' },
  webview: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#050816' },

  // Modal
  modalBackdrop: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalSheet: {
    backgroundColor: palette.panel,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl + 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginBottom: spacing.lg,
  },
  modalTitle: {
    color: palette.text, fontSize: 20, fontWeight: '900', marginBottom: spacing.sm,
  },
  modalStats: {
    flexDirection: 'row', gap: 12, marginBottom: spacing.md,
  },
  modalStatText: {
    color: palette.accent, fontSize: 15, fontWeight: '800',
  },
  label: {
    color: palette.textMuted, fontSize: 12, fontWeight: '700',
    textTransform: 'uppercase', marginBottom: 6,
  },
  input: {
    backgroundColor: '#050816',
    borderWidth: 1, borderColor: palette.line,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    color: palette.text, fontSize: 15,
    marginBottom: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing.lg,
  },
  toggleLabel: { color: palette.text, fontSize: 15, fontWeight: '700' },
  toggleSub: { color: palette.textDim, fontSize: 12, marginTop: 2 },
  saveBtn: {
    backgroundColor: palette.accent,
    borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', marginBottom: 10,
  },
  saveBtnDim: { opacity: 0.6 },
  saveBtnText: { color: '#031109', fontSize: 15, fontWeight: '900' },
  cancelBtn: {
    borderRadius: 16, paddingVertical: 12,
    alignItems: 'center', borderWidth: 1, borderColor: palette.line,
  },
  cancelBtnText: { color: palette.textMuted, fontSize: 14, fontWeight: '600' },
})
