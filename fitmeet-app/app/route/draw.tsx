import { Ionicons } from '@expo/vector-icons'
import * as FileSystem from 'expo-file-system'
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

function buildGpx(track: [number, number][], title: string): string {
  const esc = (s: string) =>
    s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!))
  const pts = track
    .map(([lat, lng]) => `    <trkpt lat="${lat.toFixed(7)}" lon="${lng.toFixed(7)}"/>`)
    .join('\n')
  const name = esc(title || 'Route')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="FitMeet" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>${name}</name></metadata>\n  <trk><name>${name}</name><trkseg>\n${pts}\n  </trkseg></trk>\n</gpx>`
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
  topInset: number,
  bottomInset: number,
): string {
  const waypointsJson = JSON.stringify(initWaypoints)

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
  #back-btn{
    pointer-events:all;
    background:rgba(5,8,22,0.88);border:1.5px solid rgba(255,255,255,0.14);
    border-radius:12px;padding:8px 14px;
    color:#f5f7ff;font-size:14px;font-weight:700;cursor:pointer;
    display:flex;align-items:center;gap:5px;
  }
  #stats-pill{
    pointer-events:none;
    flex:1;text-align:center;
    background:rgba(5,8,22,0.82);border:1px solid rgba(255,255,255,0.1);
    border-radius:20px;padding:7px 14px;
    color:#6cff2f;font-size:13px;font-weight:800;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  }
  #gps-btn{
    pointer-events:all;
    background:rgba(5,8,22,0.88);border:1.5px solid rgba(255,255,255,0.14);
    border-radius:12px;width:38px;height:38px;
    display:flex;align-items:center;justify-content:center;
    font-size:18px;cursor:pointer;
  }

  #bottom-panel{
    position:fixed;bottom:0;left:0;right:0;z-index:1000;
    background:rgba(5,8,22,0.94);
    border-top:1px solid rgba(255,255,255,0.1);
    padding-bottom:${bottomInset + 6}px;
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
  #undo-btn{
    flex:1;padding:10px;border-radius:14px;
    border:1.5px solid rgba(255,255,255,0.15);background:transparent;
    color:#b3bdd7;font-size:13px;font-weight:700;cursor:pointer;
  }
  #done-btn{
    flex:2;padding:10px;border-radius:14px;
    background:#6cff2f;border:none;
    color:#031109;font-size:14px;font-weight:900;cursor:pointer;
  }
  #done-btn:disabled{opacity:0.4;}

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
  <div id="back-btn" onclick="goBack()">&#8592; Back</div>
  <div id="stats-pill">Tap map to add points</div>
  <div id="gps-btn" onclick="useGPS()">&#128205;</div>
</div>

<div id="bottom-panel">
  <div id="cat-row"></div>
  <div id="action-row">
    <button id="undo-btn" onclick="undoLast()">&#8617; Undo</button>
    <button id="done-btn" onclick="done()" disabled>Done &#8250;</button>
  </div>
</div>

<div id="loading-overlay"><div class="spinner"></div></div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
// ── State ──────────────────────────────────────────────────────────────────
var waypoints = [];   // [{latlng:[lat,lng], marker}]
var segments  = [];   // [{fromIdx, toIdx, polyline, coords, distM}]
var category  = '${initCategory}';
var pendingRouting = 0;
var elevDebounce = null;
var selectedIdx = null;

// ── Helpers ───────────────────────────────────────────────────────────────
function send(obj) {
  window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(obj));
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
}

function showLoading(v) {
  document.getElementById('loading-overlay').className = v ? 'show' : '';
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
async function fetchValhalla(from, to, costing, options) {
  try {
    var body = JSON.stringify({
      locations: [{ lon: from[1], lat: from[0] }, { lon: to[1], lat: to[0] }],
      costing: costing,
      costing_options: options ? { [costing]: options } : undefined,
      units: 'km',
    });
    var res = await fetch('https://valhalla1.openstreetmap.de/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
    });
    if (!res.ok) return null;
    var data = await res.json();
    if (!data.trip || !data.trip.legs || !data.trip.legs.length) return null;
    var leg = data.trip.legs[0];
    var coords = decodePolyline6(leg.shape);
    return { coords: coords, distM: leg.summary.length * 1000 };
  } catch(e) { return null; }
}

function valhallaCosting(cat) {
  if (cat === 'cycling') return { costing: 'auto', options: {} };
  if (cat === 'running') return { costing: 'auto', options: {} };
  if (cat === 'hiking')  return { costing: 'pedestrian', options: { max_hiking_difficulty: 1 } };
  return null;
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
async function routeSegment(fromIdx) {
  var from = waypoints[fromIdx];
  var to   = waypoints[fromIdx+1];
  if (!from || !to) return;
  pendingRouting++;
  showLoading(pendingRouting > 0);

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
  if (pendingRouting > 0) return;
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
function done() {
  if (waypoints.length < 2) return;
  var track = buildFullTrack();
  var distKm = Math.round(totalDistM()/100)/10;
  send({
    type: 'done',
    waypoints: waypoints.map(function(wp){return wp.latlng;}),
    track: track,
    distanceKm: distKm,
    elevGain: window._elevGain || 0,
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
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}).addTo(map);

map.on('click', function(e) {
  if (pendingRouting > 0) return;
  addWaypoint([e.latlng.lat, e.latlng.lng]);
});

renderCats();
window._elevGain = 0;

// ── Load initial waypoints ────────────────────────────────────────────────
var initWaypoints = ${waypointsJson};
if (initWaypoints.length > 0) {
  (async function() {
    showLoading(true);
    for (var i=0; i<initWaypoints.length; i++) {
      addWaypoint(initWaypoints[i]);
      if (i < initWaypoints.length-1) await new Promise(function(r){setTimeout(r,60);});
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
      .then(({ data }) => {
        const route = data.data
        if (route.creator?.id !== user?.id) { router.back(); return }
        setTitle(route.title ?? '')
        setInitCategory(route.category?.value ?? 'running')
        setIsPublic(route.is_public ?? true)
        if (Array.isArray(route.waypoints) && route.waypoints.length >= 2) {
          setInitWaypoints(route.waypoints)
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
      const gpxContent = buildGpx(payload.track, title)
      const tempUri = FileSystem.cacheDirectory + `route-${Date.now()}.gpx`
      await FileSystem.writeAsStringAsync(tempUri, gpxContent, { encoding: FileSystem.EncodingType.UTF8 })

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
    } catch {
      Alert.alert('Error', 'Could not save the route. Please try again.')
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

  const html = buildDrawRouteHtml(initCategory, initWaypoints, insets.top, insets.bottom)

  return (
    <View style={styles.root}>
      <WebView
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
