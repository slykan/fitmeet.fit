import { Ionicons } from '@expo/vector-icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import type { WebView as WebViewType } from 'react-native-webview'

import { CurrentWeather, fetchCurrentWeather, fetchRelevantEventWeather, isLiveEventWeatherWindow } from '@/src/lib/weather'
import { fetchRadarFrames, type RadarFrame } from '@/src/lib/radar'
import type { TrackSegment } from '@/src/lib/gpx'
import { palette } from '@/src/theme'

export type LiveParticipant = {
  id: number
  name: string
  avatar: string | null
  lat: number
  lng: number
  speed_kmh: number | null
  /** Hasn't moved meaningfully in ~60s — shown as a pulsing red ring (approximate safety cue, not a real incident detector). */
  stopped?: boolean
}

type Props = {
  lat: number
  lng: number
  startAt?: string
  emoji?: string
  coloredSegments?: TrackSegment[]
  elevationSegments?: TrackSegment[]
  surfaceSegments?: TrackSegment[]
  /** Live positions of checked-in, sharing participants, polled by the caller. */
  participants?: LiveParticipant[]
  /** Fired when a clustered "N people" badge is tapped. */
  onClusterTap?: (participants: LiveParticipant[]) => void
  /** Number of joined participants currently viewing this event's live map. */
  viewersCount?: number
  /** When provided, shows a tappable applause button that broadcasts a sound to everyone checked in. */
  onApplausePress?: () => void
  /** Once true, the applause button shows as already used (one clap per viewer per event). */
  hasApplauded?: boolean
  /** 0..1 reveal fraction while the route "play" animation runs. Omit/null for the normal, fully-drawn route. */
  playProgress?: number | null
  /** Shows a "X km" badge above the play-animation head marker while a distance milestone is being announced. */
  playMilestone?: { km: number; exiting: boolean } | null
  /** When provided (with onPlayToggle), shows a Play/Pause control overlaid on the map. */
  playState?: 'idle' | 'playing' | 'paused'
  onPlayToggle?: () => void
  /** When provided (with onSpeedToggle), shows a 1x/1.5x speed control next to Play while animating. */
  playSpeed?: number
  onSpeedToggle?: () => void
  onMapEnabledChange?: (enabled: boolean) => void
  loading?: boolean
}

type MapLayer = 'standard' | 'satellite' | 'terrain'

const MAP_LAYER_LABELS: Record<MapLayer, string> = {
  standard: 'Standard',
  satellite: 'Satellite',
  terrain: 'Terrain',
}

const WIND_CSS = `
  .wd { position:absolute;inset:0;pointer-events:none;z-index:440;background:rgba(4,10,22,0.32);opacity:0;transition:opacity .45s ease; }
  .wd.active { opacity:1; }
  .wo { position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:450; }
  .wo{opacity:0;transition:opacity .45s ease;}
  .wo.ready{opacity:1;}
  .wo.interacting{opacity:0;}
  .wo.interacting *{animation-play-state:paused!important;}
  .wp {
    position:absolute; width:18px; height:1.6px; border-radius:999px;
    background:linear-gradient(90deg, rgba(210,232,255,0), rgba(210,232,255,0.55) 55%, rgba(255,255,255,0.95));
    box-shadow:0 0 2px rgba(210,232,255,0.35);
    transform-origin:right center;
    animation:wm linear infinite; opacity:0;
  }
  @keyframes wm {
    0%   { opacity:0; transform:translate3d(0,0,0) rotate(var(--rot)) scale(0.9); }
    10%  { opacity:1; }
    32%  { transform:translate3d(var(--dx1),var(--dy1),0) rotate(var(--rot)) scale(0.95); }
    58%  { transform:translate3d(var(--dx2),var(--dy2),0) rotate(var(--rot)) scale(1); }
    82%  { transform:translate3d(var(--dx3),var(--dy3),0) rotate(var(--rot)) scale(1.02); }
    85%  { opacity:1; }
    100% { opacity:0; transform:translate3d(var(--dx),var(--dy),0) rotate(var(--rot)) scale(1.04); }
  }
  .lightning-bolt {
    position:absolute; width:16px; height:16px; border-radius:999px;
    background:radial-gradient(circle,rgba(255,244,160,0.98),rgba(255,214,64,0.6) 55%,transparent 100%);
    box-shadow:0 0 18px 7px rgba(255,214,64,0.55);
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
`

function buildHtml(
  lat: number,
  lng: number,
  center: { lat: number; lng: number },
  emoji: string,
  weather: CurrentWeather | null,
  showWind: boolean,
  showClouds: boolean,
  radarPath: string | null,
  coloredSegments: TrackSegment[],
  elevationSegments: TrackSegment[],
  surfaceSegments: TrackSegment[],
  initialLayer: MapLayer,
  initialShowElevation: boolean,
  initialShowSurface: boolean,
  initialShowKm: boolean,
) {
  const wJson = JSON.stringify(weather)
  const radarPathJson = JSON.stringify(radarPath)
  const segsJson = JSON.stringify(coloredSegments)
  const elevSegsJson = JSON.stringify(elevationSegments)
  const surfaceSegsJson = JSON.stringify(surfaceSegments)
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
      width:18px;height:18px;border-radius:999px;
      background:radial-gradient(circle at 35% 30%, #ff9a8a 0%, #ff2d2d 55%, #8b0000 100%);
      box-shadow:0 1px 4px rgba(0,0,0,0.5), inset 0 -1px 2px rgba(0,0,0,0.35);
    }
    @keyframes fmStoppedPulse{
      0%,100%{box-shadow:0 0 0 0 rgba(255,59,48,0.9);}
      50%{box-shadow:0 0 0 7px rgba(255,59,48,0);}
    }
    .fm-stopped-ring{animation:fmStoppedPulse 1.2s ease-in-out infinite;}
    ${WIND_CSS}
  </style>
</head>
<body>
  <div id="map"></div>
  <div class="wd" id="wd"></div>
  <div class="wo" id="wo"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const weather = ${wJson};
    let showWind = ${showWind};
    let showClouds = ${showClouds};
    let radarPath = ${radarPathJson};
    const coloredSegments = ${segsJson};
    const elevationSegments = ${elevSegsJson};
    const surfaceSegments = ${surfaceSegsJson};
    const map = L.map('map',{zoomControl:false,attributionControl:false,preferCanvas:true})
      .setView([${center.lat},${center.lng}],13);
    L.control.zoom({position:'bottomright'}).addTo(map);
    const baseLayers = {
      standard: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}),
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19}),
      terrain: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17})
    };
    let activeBaseLayer = null;
    function setBaseLayer(layer) {
      const next = baseLayers[layer] ? layer : 'standard';
      if (activeBaseLayer) map.removeLayer(activeBaseLayer);
      activeBaseLayer = baseLayers[next];
      activeBaseLayer.addTo(map);
    }
    setBaseLayer('${initialLayer}');

    function buildRadarUrl(path) {
      return 'https://tilecache.rainviewer.com' + path + '/512/{z}/{x}/{y}/2/1_1.png';
    }
    let radarTileLayer = null;
    function updateRadarTiles(show) {
      if (show && radarPath) {
        const url = buildRadarUrl(radarPath);
        if (!radarTileLayer) {
          radarTileLayer = L.tileLayer(url, { maxZoom:18, maxNativeZoom:7, opacity:0.85, zIndex:221 }).addTo(map);
        } else if (radarTileLayer._url !== url) {
          radarTileLayer.setUrl(url);
        }
      } else if (radarTileLayer) {
        radarTileLayer.remove();
        radarTileLayer = null;
      }
    }
    updateRadarTiles(showClouds);

    const icon = L.divIcon({className:'fm-marker',html:'<div class="fm-pin"></div>',iconSize:[18,18],iconAnchor:[9,9]});
    L.marker([${lat},${lng}],{icon}).addTo(map);

    const hasLayeredSegments = (surfaceSegments && surfaceSegments.length > 0) || (elevationSegments && elevationSegments.length > 0);
    const elevationLayers = [];
    const surfaceLayersArr = [];
    let baseLine = null;
    // The route itself is always fully drawn (below) — play/scrub only moves
    // this head marker along it, it doesn't reveal/redraw the line.
    let snakeHeadDot = null;
    let lastHeadLatLng = null;
    let milestoneMarker = null;
    let showElevation = ${initialShowElevation ? 'true' : 'false'};
    let showSurface = ${initialShowSurface ? 'true' : 'false'};
    let showKm = ${initialShowKm ? 'true' : 'false'};
    let isStaticView = true;
    // Single, sequentially-ordered segment list for the "play" reveal animation.
    // (Concatenating surface + elevation segments would re-trace the whole route twice,
    // since each layer independently covers it start-to-end.) Elevation-graded
    // color takes priority so the reveal paints in the same grade colors as
    // the static Elevation toggle, not a flat color.
    let playSegments = null;
    if (elevationSegments && elevationSegments.length > 0) {
      playSegments = elevationSegments;
    } else if (surfaceSegments && surfaceSegments.length > 0) {
      playSegments = surfaceSegments;
    } else if (coloredSegments && coloredSegments.length > 0) {
      playSegments = coloredSegments;
    }
    const allTrackCoords = playSegments ? [].concat(...playSegments.map(function(seg) { return seg.coords; })) : [];
    // Cumulative real-world distance at each allTrackCoords point — lets play
    // progress map to distance travelled instead of raw point count (GPX points
    // cluster far more densely on hilly/curvy stretches than flat/straight ones,
    // which made the head marker speed up and stutter on longer, hillier routes).
    const allTrackCumKm = (function() {
      const cum = [0];
      for (let i = 1; i < allTrackCoords.length; i++) {
        cum.push(cum[i - 1] + haversineKm(allTrackCoords[i - 1][0], allTrackCoords[i - 1][1], allTrackCoords[i][0], allTrackCoords[i][1]));
      }
      return cum;
    })();
    function pointerForProgress(progress) {
      if (allTrackCumKm.length < 2) return null;
      const total = allTrackCumKm[allTrackCumKm.length - 1];
      if (total <= 0) return null;
      const target = Math.max(0, Math.min(1, progress)) * total;
      let lo = 0, hi = allTrackCumKm.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (allTrackCumKm[mid] <= target) lo = mid; else hi = mid - 1;
      }
      const index = Math.min(lo, allTrackCumKm.length - 2);
      const segLen = allTrackCumKm[index + 1] - allTrackCumKm[index];
      const t = segLen > 0 ? (target - allTrackCumKm[index]) / segLen : 0;
      return { index: index, t: t };
    }
    function lerpCoord(a, b, t) {
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    function popupText(seg) {
      const arrow = seg.avgGrade > 0 ? '↑' : (seg.avgGrade < 0 ? '↓' : '');
      return seg.distanceKm + ' km · ' + arrow + Math.abs(seg.avgGrade) + '%';
    }
    let routeBounds = null;
    if (allTrackCoords.length > 1) {
      baseLine = L.polyline(allTrackCoords, { color:'#39ff14', weight:4, opacity:0.9, lineCap:'round', lineJoin:'round' });
      routeBounds = L.latLngBounds(allTrackCoords).extend([${lat},${lng}]);
    }
    if (hasLayeredSegments || (coloredSegments && coloredSegments.length > 0)) {
      const allBounds = [];
      function drawSegments(segments, options, bucket, bindPopups) {
        (segments || []).forEach(function(seg) {
          if (seg.coords.length > 1) {
            const hasInfo = bindPopups && seg.distanceKm != null && seg.avgGrade != null;
            // Near-invisible wide twin under the visible line purely to widen
            // the tap target - a 4-5px line is hard to hit precisely on a touchscreen.
            if (hasInfo) {
              const hitLine = L.polyline(seg.coords, {
                color: seg.color, weight: 24, opacity: 0.02, lineJoin: 'round', lineCap: 'round'
              });
              hitLine.bindPopup(popupText(seg));
              allBounds.push(hitLine.getBounds());
              bucket.push(hitLine);
            }
            const poly = L.polyline(seg.coords,{
              color:seg.color,
              weight:options.weight,
              opacity:options.opacity,
              lineJoin:'round',
              lineCap:'round',
              dashArray:seg.dashArray||null
            });
            if (hasInfo) poly.bindPopup(popupText(seg));
            allBounds.push(poly.getBounds());
            bucket.push(poly);
          }
        });
      }
      if (hasLayeredSegments) {
        drawSegments(surfaceSegments, { weight: 9, opacity: 0.72 }, surfaceLayersArr, false);
        drawSegments(elevationSegments, { weight: 4, opacity: 0.98 }, elevationLayers, true);
      } else {
        drawSegments(coloredSegments, { weight: 4, opacity: 0.95 }, elevationLayers, true);
      }
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
    let finishMarker = null;
    if (allTrackCoords.length > 1) {
      const finishIcon = L.divIcon({
        className:'fm-finish-marker',
        html:'<div style="display:flex;align-items:center;justify-content:center;font-size:22px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.6));">🏁</div>',
        iconSize:[26,26],
        iconAnchor:[13,13]
      });
      finishMarker = L.marker(allTrackCoords[allTrackCoords.length - 1], { icon: finishIcon });
    }
    function haversineKm(lat1, lng1, lat2, lng2) {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2) * Math.sin(dLng/2);
      return 2 * R * Math.asin(Math.sqrt(a));
    }
    let kmMarkerLayers = [];
    function refreshKmMarkers() {
      kmMarkerLayers.forEach(function(m) { map.removeLayer(m); });
      kmMarkerLayers = [];
      if (!isStaticView || !showKm || allTrackCoords.length < 2) return;
      let cum = 0;
      let next = 10;
      for (let i = 1; i < allTrackCoords.length; i++) {
        const a = allTrackCoords[i - 1], b = allTrackCoords[i];
        const segLen = haversineKm(a[0], a[1], b[0], b[1]);
        while (segLen > 0 && next <= cum + segLen) {
          const t = (next - cum) / segLen;
          const lat = a[0] + (b[0] - a[0]) * t;
          const lng = a[1] + (b[1] - a[1]) * t;
          const km = Math.round(next);
          const icon = L.divIcon({
            className:'fm-static-km-marker',
            html:'<div style="width:70px;height:22px;display:flex;align-items:center;justify-content:center;"><span style="background:#0b1120;border:1px solid #39ff14;color:#eafff0;font-weight:800;font-size:11px;padding:3px 8px;border-radius:999px;box-shadow:0 2px 6px rgba(0,0,0,0.4);white-space:nowrap;">' + km + ' km</span></div>',
            iconSize:[70,22],
            iconAnchor:[35,32]
          });
          kmMarkerLayers.push(L.marker([lat, lng], { icon }).addTo(map));
          next += 10;
        }
        cum += segLen;
      }
    }
    function applyStaticLayers() {
      if (!isStaticView) return;
      const anyColor = showElevation || showSurface;
      if (baseLine) {
        if (!anyColor) { if (!map.hasLayer(baseLine)) baseLine.addTo(map); }
        else if (map.hasLayer(baseLine)) map.removeLayer(baseLine);
      }
      surfaceLayersArr.forEach(function(l) {
        if (showSurface) { if (!map.hasLayer(l)) l.addTo(map); }
        else if (map.hasLayer(l)) map.removeLayer(l);
      });
      elevationLayers.forEach(function(l) {
        if (showElevation) { if (!map.hasLayer(l)) l.addTo(map); }
        else if (map.hasLayer(l)) map.removeLayer(l);
      });
      refreshKmMarkers();
    }
    function setLayerToggles(toggles) {
      showElevation = toggles.showElevation;
      showSurface = toggles.showSurface;
      showKm = toggles.showKm;
      applyStaticLayers();
    }
    applyStaticLayers();
    let followZoom = null;
    function setPlayProgress(progress) {
      if (allTrackCoords.length < 2) return;
      if (progress >= 1) {
        isStaticView = true;
        followZoom = null;
        if (snakeHeadDot) { map.removeLayer(snakeHeadDot); snakeHeadDot = null; }
        applyStaticLayers();
        if (finishMarker && !map.hasLayer(finishMarker)) finishMarker.addTo(map);
        if (routeBounds) map.fitBounds(routeBounds, { padding: [32, 32] });
        return;
      }
      const wasStatic = isStaticView;
      isStaticView = false;
      if (finishMarker && map.hasLayer(finishMarker)) map.removeLayer(finishMarker);
      // The static route/layers (baseLine, surfaceLayersArr, elevationLayers)
      // are left on the map throughout — they used to get removed here to make
      // room for a progressively-revealed "snake" polyline, but the route is
      // now always fully drawn and play/scrub just moves the head dot below.
      kmMarkerLayers.forEach(function(l) { if (map.hasLayer(l)) map.removeLayer(l); });
      const pointer = pointerForProgress(progress);
      const head = pointer
        ? lerpCoord(allTrackCoords[pointer.index], allTrackCoords[pointer.index + 1], pointer.t)
        : allTrackCoords[allTrackCoords.length - 1];
      lastHeadLatLng = head;
      // Only force the zoom-in on the static->active transition; every later
      // update just pans, so a manual zoom mid-playback isn't stomped every
      // frame the way a repeated setView(head, zoom) would.
      if (wasStatic) {
        followZoom = Math.min(map.getZoom() + 2, 17);
        map.setView(head, followZoom, { animate: false });
      } else {
        map.panTo(head, { animate: false });
      }
      if (!snakeHeadDot) {
        const headIcon = L.divIcon({
          className:'fm-head-marker',
          html:'<div style="width:14px;height:14px;border-radius:999px;background:radial-gradient(circle at 35% 30%, #ff9a8a 0%, #ff2d2d 55%, #8b0000 100%);box-shadow:0 1px 3px rgba(0,0,0,0.5), inset 0 -1px 2px rgba(0,0,0,0.35);"></div>',
          iconSize:[14,14],
          iconAnchor:[7,7]
        });
        snakeHeadDot = L.marker(head, { icon: headIcon }).addTo(map);
      } else {
        snakeHeadDot.setLatLng(head);
      }
    }
    function milestoneIcon(km, exiting) {
      return L.divIcon({
        className:'fm-milestone-marker',
        html:'<style>@keyframes fmMilestonePopIn{0%{opacity:0;transform:scale(0.4);}65%{opacity:1;transform:scale(1.15);}100%{opacity:1;transform:scale(1);}}@keyframes fmMilestonePopOut{0%{opacity:1;transform:scale(1) translateY(0);}100%{opacity:0;transform:scale(0.5) translateY(-6px);}}</style>' +
          '<div style="width:90px;height:30px;display:flex;align-items:center;justify-content:center;animation:' + (exiting ? 'fmMilestonePopOut 0.35s ease-in both' : 'fmMilestonePopIn 0.35s cubic-bezier(.34,1.56,.64,1) both') + ';">' +
          '<span style="background:#0b1120;border:1px solid #39ff14;color:#eafff0;font-weight:800;font-size:12px;padding:4px 10px;border-radius:999px;box-shadow:0 4px 10px rgba(0,0,0,0.45);white-space:nowrap;">' + km + ' km</span></div>',
        iconSize:[90,30],
        iconAnchor:[45,44]
      });
    }
    function setPlayMilestone(milestone) {
      if (milestoneMarker) { map.removeLayer(milestoneMarker); milestoneMarker = null; }
      if (!milestone || !lastHeadLatLng) return;
      milestoneMarker = L.marker(lastHeadLatLng, { icon: milestoneIcon(milestone.km, milestone.exiting), zIndexOffset: 1000 }).addTo(map);
    }

    // Live participant markers. Updates arrive every ~10-15s for a small
    // (event-sized) group, and clustering needs to see all points together
    // each time anyway, so a full clear-and-rebuild per update is simpler
    // and plenty cheap here — unlike the play-animation head marker (30x/sec),
    // this doesn't need the create-once/setLatLng optimization.
    let currentParticipants = [];
    let participantMarkers = {};
    let clusterMarkers = {};
    function initialsFor(name) {
      const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
      if (parts.length === 0) return '?';
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    function participantIconHtml(p) {
      const ringClass = p.stopped ? ' fm-stopped-ring' : '';
      const avatarHtml = p.avatar
        ? '<div class="' + ringClass.trim() + '" style="position:relative;width:32px;height:32px;border-radius:999px;background:#0b1120;background-image:url(\\'' + p.avatar + '\\');background-size:cover;background-position:center;border:2px solid ' + (p.stopped ? '#ff3b30' : '#39ff14') + ';box-shadow:0 2px 6px rgba(0,0,0,0.5);"><div style="position:absolute;right:-4px;bottom:-4px;min-width:16px;height:16px;padding:0 3px;border-radius:999px;background:#39ff14;border:1.5px solid #0b1120;display:flex;align-items:center;justify-content:center;color:#041109;font-weight:800;font-size:8px;line-height:1;">' + initialsFor(p.name) + '</div></div>'
        : '<div class="' + ringClass.trim() + '" style="width:32px;height:32px;border-radius:999px;background:#0b1120;border:2px solid ' + (p.stopped ? '#ff3b30' : '#39ff14') + ';display:flex;align-items:center;justify-content:center;color:#eafff0;font-weight:800;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,0.5);">' + initialsFor(p.name) + '</div>';
      const speedHtml = p.speed_kmh != null
        ? '<div style="margin-top:2px;background:#0b1120;border:1px solid rgba(57,255,20,0.5);color:#eafff0;font-size:9px;font-weight:700;padding:1px 5px;border-radius:999px;white-space:nowrap;">' + p.speed_kmh.toFixed(1) + ' km/h</div>'
        : '';
      return '<div style="display:flex;flex-direction:column;align-items:center;">' + avatarHtml + speedHtml + '</div>';
    }
    // Icons are cached by content key so an unchanged participant (same avatar,
    // speed rounded to the nearest km/h) gets the same L.divIcon instance back
    // across polls — otherwise setIcon() tears down and rebuilds the marker's
    // DOM every tick, flashing empty/black for a frame before it repaints.
    var participantIconCache = {};
    var clusterIconCache = {};
    function participantDivIcon(p) {
      var speedKey = p.speed_kmh != null ? Math.round(p.speed_kmh) : 'x';
      var key = p.id + '|' + (p.avatar || '') + '|' + speedKey + '|' + (p.stopped ? 1 : 0);
      if (participantIconCache[key]) return participantIconCache[key];
      var icon = L.divIcon({ className:'fm-participant-marker', html: participantIconHtml(p), iconSize:[60,50], iconAnchor:[30,25] });
      participantIconCache[key] = icon;
      return icon;
    }
    function clusterDivIcon(count) {
      if (clusterIconCache[count]) return clusterIconCache[count];
      var icon = L.divIcon({
        className:'fm-cluster-marker',
        html:'<div style="width:34px;height:34px;border-radius:999px;background:#39ff14;color:#041109;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,0.5);border:2px solid #0b1120;">' + count + '</div>',
        iconSize:[34,34],
        iconAnchor:[17,17]
      });
      clusterIconCache[count] = icon;
      return icon;
    }
    // Individual participant markers persist across updates (keyed by id) and
    // are only moved/re-iconned, not destroyed and recreated — L.marker/L.divIcon
    // churn on every ~12s poll was causing a visible black flash each tick.
    // Cluster markers persist too, keyed by the sorted set of member ids.
    function recomputeParticipantDisplay() {
      if (!currentParticipants.length) {
        Object.keys(participantMarkers).forEach(function(id) { map.removeLayer(participantMarkers[id]); });
        participantMarkers = {};
        Object.keys(clusterMarkers).forEach(function(key) { map.removeLayer(clusterMarkers[key]); });
        clusterMarkers = {};
        return;
      }

      const pts = currentParticipants.map(function(p) {
        return { p: p, pt: map.latLngToContainerPoint([p.lat, p.lng]) };
      });
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
          if (Math.sqrt(dx * dx + dy * dy) < 40) {
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
          const iconKey = p.id + '|' + (p.avatar || '') + '|' + (p.speed_kmh != null ? Math.round(p.speed_kmh) : 'x') + '|' + (p.stopped ? 1 : 0);
          const existing = participantMarkers[p.id];
          if (existing) {
            existing.setLatLng([p.lat, p.lng]);
            if (existing._fmIconKey !== iconKey) {
              existing.setIcon(participantDivIcon(p));
              existing._fmIconKey = iconKey;
            }
          } else {
            const marker = L.marker([p.lat, p.lng], { icon: participantDivIcon(p) }).addTo(map);
            marker._fmIconKey = iconKey;
            participantMarkers[p.id] = marker;
          }
        } else {
          const key = group.map(function(g) { return g.p.id; }).sort().join('-');
          nextClusterKeys[key] = true;
          let sumLat = 0, sumLng = 0;
          group.forEach(function(g) { sumLat += g.p.lat; sumLng += g.p.lng; });
          const centroid = [sumLat / group.length, sumLng / group.length];
          const existing = clusterMarkers[key];
          if (existing) {
            existing.setLatLng(centroid);
          } else {
            const marker = L.marker(centroid, { icon: clusterDivIcon(group.length) }).addTo(map);
            marker.on('click', function() {
              send('clusterTap', { participants: group.map(function(g) { return g.p; }) });
            });
            clusterMarkers[key] = marker;
          }
        }
      });

      Object.keys(participantMarkers).forEach(function(id) {
        if (!nextIds[id]) { map.removeLayer(participantMarkers[id]); delete participantMarkers[id]; }
      });
      Object.keys(clusterMarkers).forEach(function(key) {
        if (!nextClusterKeys[key]) { map.removeLayer(clusterMarkers[key]); delete clusterMarkers[key]; }
      });
    }
    function updateParticipants(participants) {
      currentParticipants = participants || [];
      recomputeParticipantDisplay();
    }
    map.on('zoomend', recomputeParticipantDisplay);

    const wo = document.getElementById('wo');
    const wd = document.getElementById('wd');
    let moveTimer = null;
    let userInteracting = false;
    let windDimShouldShow = false;
    function send(type, payload) {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...(payload || {}) }));
    }
    function markUserInteracting() {
      userInteracting = true;
    }
    function movementStarted() {
      if (!userInteracting) return;
      wo.classList.add('interacting');
      wd.classList.remove('active');
      send('mapMoveStart');
    }
    function movementEnded() {
      if (!userInteracting) return;
      window.clearTimeout(moveTimer);
      moveTimer = window.setTimeout(() => {
        const c = map.getCenter();
        send('mapMoveEnd', { center:{ lat:c.lat, lng:c.lng } });
        userInteracting = false;
        wd.classList.toggle('active', windDimShouldShow);
      }, 160);
    }
    const container = map.getContainer();
    container.addEventListener('touchstart', markUserInteracting, { passive:true });
    container.addEventListener('mousedown', markUserInteracting);
    container.addEventListener('wheel', markUserInteracting, { passive:true });
    map.on('movestart zoomstart dragstart', movementStarted);
    map.on('moveend zoomend dragend', movementEnded);

    function renderWeather(nextWeather, nextShowWind, nextShowClouds) {
      wo.classList.remove('ready', 'interacting');
      wo.innerHTML = '';
      windDimShouldShow = !!(nextWeather && nextShowWind);
      wd.classList.toggle('active', windDimShouldShow);
      if (!nextWeather) return;

      if (nextShowWind) {
      const windDir = nextWeather.windDir||270;
      const flowBearing = (windDir + 180) % 360;
      const rad = flowBearing*Math.PI/180;
      const spd = Math.max(6,nextWeather.windSpeed||10);
      const dist = Math.min(80,26+spd*2);
      const dx = Math.sin(rad)*dist;
      const dy = -Math.cos(rad)*dist;
      const perpRad = rad + Math.PI / 2;
      const px = Math.sin(perpRad);
      const py = -Math.cos(perpRad);
      const dur = Math.max(2.2,7.5-spd*0.05);
      const cssRot = flowBearing-90;
      for(let i=0;i<30;i++){
        const el=document.createElement('div');
        el.className='wp';
        el.style.left=(Math.random()*110-5)+'%';
        el.style.top=(Math.random()*110-5)+'%';
        el.style.setProperty('--rot', cssRot+'deg');
        el.style.setProperty('--dx',dx+'px');
        el.style.setProperty('--dy',dy+'px');
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
        el.style.animationDuration=(dur+Math.random()*1.6)+'s';
        el.style.animationDelay=(0.2+Math.random()*4.3)+'s';
        wo.appendChild(el);
      }
      }

      const isThunder = [95, 96, 99].includes(Math.round(nextWeather.code || 0));
      if (nextShowClouds && isThunder) {
        const count = 4 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          const bolt = document.createElement('div');
          bolt.className = 'lightning-bolt';
          bolt.style.left = (2 + Math.random() * 90) + '%';
          bolt.style.top = (2 + Math.random() * 85) + '%';
          bolt.style.animationDuration = (2.6 + Math.random() * 2.4) + 's';
          bolt.style.animationDelay = (Math.random() * 3) + 's';
          wo.appendChild(bolt);
        }
      }

      setTimeout(() => wo.classList.add('ready'), 220);
    }

    function handleMessage(event) {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'weatherUpdate') {
          showWind = data.showWind;
          showClouds = data.showClouds;
          updateRadarTiles(showClouds);
          renderWeather(data.weather, data.showWind, data.showClouds);
        }
        if (data.type === 'radarUpdate') {
          radarPath = data.path;
          updateRadarTiles(showClouds);
        }
        if (data.type === 'mapLayer') setBaseLayer(data.layer);
        if (data.type === 'playProgress') setPlayProgress(data.progress);
        if (data.type === 'playMilestone') setPlayMilestone(data.milestone);
        if (data.type === 'layerToggles') setLayerToggles(data.toggles);
        if (data.type === 'participantsUpdate') updateParticipants(data.participants);
      } catch (e) {}
    }
    document.addEventListener('message', handleMessage);
    window.addEventListener('message', handleMessage);

    renderWeather(weather, showWind, showClouds);
  </script>
</body>
</html>`
}

function LiveBadge() {
  const pulse = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [pulse])
  return (
    <View style={styles.liveBadge}>
      <Animated.View style={[styles.liveBadgeDot, { opacity: pulse }]} />
      <Text style={styles.liveBadgeText}>LIVE</Text>
    </View>
  )
}

export function EventMapCard({ lat, lng, startAt, emoji = '📍', coloredSegments, elevationSegments, surfaceSegments, participants, onClusterTap, viewersCount = 0, onApplausePress, hasApplauded = false, playProgress = null, playMilestone = null, playState, onPlayToggle, playSpeed, onSpeedToggle, onMapEnabledChange, loading }: Props) {
  const webViewRef = useRef<WebViewType>(null)
  const [weather, setWeather] = useState<CurrentWeather | null>(null)
  const [center, setCenter] = useState({ lat, lng })
  const [mapEnabled, setMapEnabled] = useState(false)
  const [mapLayer, setMapLayer] = useState<MapLayer>('standard')
  const [showWind, setShowWind] = useState(false)
  const [showClouds, setShowClouds] = useState(false)
  const rainReliable = startAt ? isLiveEventWeatherWindow(startAt) : true
  const effectiveShowClouds = showClouds && rainReliable
  const [layerPickerOpen, setLayerPickerOpen] = useState(false)
  const [weatherRefreshTick, setWeatherRefreshTick] = useState(0)
  const [radarPath, setRadarPath] = useState<string | null>(null)
  const [showElevationLayer, setShowElevationLayer] = useState(true)
  const [showSurfaceLayer, setShowSurfaceLayer] = useState(false)
  const [showKmMarkers, setShowKmMarkers] = useState(false)
  const hasSurfaceOrElevation = Boolean(surfaceSegments?.length || elevationSegments?.length)
  const isAnimating = playState === 'playing' || playState === 'paused'
  const html = useMemo(
    () => buildHtml(lat, lng, { lat, lng }, emoji, null, showWind, effectiveShowClouds, radarPath, coloredSegments ?? [], elevationSegments ?? [], surfaceSegments ?? [], 'standard', true, false, false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lat, lng, emoji, coloredSegments, elevationSegments, surfaceSegments],
  )
  // `source` must keep referential identity across renders that don't change `html` --
  // WebView reloads the whole page whenever it receives a new `source` object, and
  // during live tracking this component re-renders every ~6s (position poll), which
  // was silently reloading the map on each poll and wiping the wind/weather/elevation
  // toggle state inside the page (only patched back in by onLoadEnd a beat later).
  const source = useMemo(() => ({ html }), [html])

  useEffect(() => {
    setCenter({ lat, lng })
    setMapEnabled(false)
  }, [lat, lng])

  useEffect(() => {
    onMapEnabledChange?.(mapEnabled)
  }, [mapEnabled, onMapEnabledChange])

  useEffect(() => {
    const id = setInterval(() => setWeatherRefreshTick((current) => current + 1), 15 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const request = startAt
      ? fetchRelevantEventWeather(center.lat, center.lng, startAt)
      : fetchCurrentWeather(center.lat, center.lng)
    request.then(setWeather).catch(() => {})
  }, [center.lat, center.lng, startAt, weatherRefreshTick])

  useEffect(() => {
    if (!rainReliable) {
      setRadarPath(null)
      return
    }
    fetchRadarFrames()
      .then((result) => setRadarPath(result ? result.frames[result.nowIndex]?.path ?? null : null))
      .catch(() => setRadarPath(null))
  }, [rainReliable, weatherRefreshTick])

  const weatherRef = useRef<CurrentWeather | null>(null)
  weatherRef.current = weather

  useEffect(() => {
    webViewRef.current?.postMessage(JSON.stringify({
      type: 'weatherUpdate', weather,
      showWind: showWind && !isAnimating,
      showClouds: effectiveShowClouds && !isAnimating,
    }))
  }, [weather, showWind, effectiveShowClouds, isAnimating])

  useEffect(() => {
    if (radarPath) webViewRef.current?.postMessage(JSON.stringify({ type: 'radarUpdate', path: radarPath }))
  }, [radarPath])

  useEffect(() => {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'mapLayer', layer: mapLayer }))
  }, [mapLayer])

  useEffect(() => {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'playProgress', progress: playProgress == null ? 1 : playProgress }))
  }, [playProgress])

  useEffect(() => {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'playMilestone', milestone: playMilestone }))
  }, [playMilestone])

  useEffect(() => {
    webViewRef.current?.postMessage(JSON.stringify({
      type: 'layerToggles',
      toggles: { showElevation: showElevationLayer, showSurface: showSurfaceLayer, showKm: showKmMarkers },
    }))
  }, [showElevationLayer, showSurfaceLayer, showKmMarkers])

  useEffect(() => {
    webViewRef.current?.postMessage(JSON.stringify({ type: 'participantsUpdate', participants: participants ?? [] }))
  }, [participants])

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
        onLoadEnd={() => {
          if (weatherRef.current) {
            webViewRef.current?.postMessage(
              JSON.stringify({
                type: 'weatherUpdate', weather: weatherRef.current,
                showWind: showWind && !isAnimating,
                showClouds: effectiveShowClouds && !isAnimating,
              }),
            )
          }
          if (radarPath) webViewRef.current?.postMessage(JSON.stringify({ type: 'radarUpdate', path: radarPath }))
          webViewRef.current?.postMessage(JSON.stringify({ type: 'mapLayer', layer: mapLayer }))
          webViewRef.current?.postMessage(JSON.stringify({ type: 'playProgress', progress: playProgress == null ? 1 : playProgress }))
          webViewRef.current?.postMessage(JSON.stringify({
            type: 'layerToggles',
            toggles: { showElevation: showElevationLayer, showSurface: showSurfaceLayer, showKm: showKmMarkers },
          }))
          webViewRef.current?.postMessage(JSON.stringify({ type: 'participantsUpdate', participants: participants ?? [] }))
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
            if (data.type === 'clusterTap' && Array.isArray(data.participants)) {
              onClusterTap?.(data.participants)
            }
          } catch {}
        }}
        style={styles.webview}
      />
      <View pointerEvents="box-none" style={styles.mapOverlay}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Pressable
            onPress={() => setMapEnabled((current) => !current)}
            style={[styles.mapModeBtn, mapEnabled && styles.mapModeBtnActive]}
          >
            <Text style={[styles.mapModeBtnText, mapEnabled && styles.mapModeBtnTextActive]}>
              {mapEnabled ? 'Done' : 'Move map'}
            </Text>
          </Pressable>
          {((participants?.length ?? 0) > 0 || viewersCount > 0) && (
            <>
              <LiveBadge />
              {viewersCount > 0 && (
                <View style={styles.viewersBadge}>
                  <Ionicons name="eye-outline" size={13} color={palette.text} />
                  <Text style={styles.viewersBadgeText}>{viewersCount}</Text>
                </View>
              )}
              {onApplausePress && (
                <Pressable
                  style={[styles.applauseBtn, hasApplauded && styles.applauseBtnUsed]}
                  onPress={hasApplauded ? undefined : onApplausePress}
                  hitSlop={6}
                >
                  <Text style={[styles.applauseBtnText, hasApplauded && styles.applauseBtnTextUsed]}>👏</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      </View>
      <View pointerEvents="box-none" style={styles.layerOverlay}>
        <Pressable
          onPress={() => setLayerPickerOpen((current) => !current)}
          style={styles.layerModeBtn}
        >
          <Text style={styles.layerModeBtnText}>{MAP_LAYER_LABELS[mapLayer]}</Text>
        </Pressable>
        {layerPickerOpen && (
          <View style={styles.layerPicker}>
            {(Object.keys(MAP_LAYER_LABELS) as MapLayer[]).map((layer) => {
              const active = mapLayer === layer
              return (
                <Pressable
                  key={layer}
                  onPress={() => {
                    setMapLayer(layer)
                    setLayerPickerOpen(false)
                  }}
                  style={[styles.layerOption, active && styles.layerOptionActive]}
                >
                  <Text style={[styles.layerOptionText, active && styles.layerOptionTextActive]}>
                    {MAP_LAYER_LABELS[layer]}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        )}
      </View>
      <View style={styles.weatherToggles} pointerEvents="box-none">
        {onPlayToggle && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable
              style={[styles.weatherToggleBtn, playState === 'playing' && styles.weatherToggleBtnActive]}
              onPress={onPlayToggle}
              hitSlop={8}
            >
              <Ionicons
                name={playState === 'playing' ? 'pause' : 'play'}
                size={15}
                color={playState === 'playing' ? '#031109' : palette.text}
                style={playState !== 'playing' ? { marginLeft: 1 } : undefined}
              />
            </Pressable>
            {playState !== 'idle' && onSpeedToggle && (
              <Pressable
                style={[styles.weatherToggleBtn, playSpeed !== 1 && styles.weatherToggleBtnActive]}
                onPress={onSpeedToggle}
                hitSlop={8}
              >
                <Ionicons name="play-forward" size={15} color={playSpeed !== 1 ? '#031109' : palette.text} />
              </Pressable>
            )}
          </View>
        )}
        {hasSurfaceOrElevation && (
          <>
            <Pressable
              style={[styles.weatherToggleBtn, showElevationLayer && styles.weatherToggleBtnActive]}
              onPress={() => setShowElevationLayer((v) => !v)}
              hitSlop={8}
            >
              <Ionicons name="trending-up-outline" size={15} color={showElevationLayer ? '#031109' : palette.text} />
            </Pressable>
            <Pressable
              style={[styles.weatherToggleBtn, showSurfaceLayer && styles.weatherToggleBtnActive]}
              onPress={() => setShowSurfaceLayer((v) => !v)}
              hitSlop={8}
            >
              <Ionicons name="car-outline" size={15} color={showSurfaceLayer ? '#031109' : palette.text} />
            </Pressable>
            <Pressable
              style={[styles.weatherToggleBtn, showKmMarkers && styles.weatherToggleBtnActive]}
              onPress={() => setShowKmMarkers((v) => !v)}
              hitSlop={8}
            >
              <Ionicons name="location-outline" size={15} color={showKmMarkers ? '#031109' : palette.text} />
            </Pressable>
          </>
        )}
        <Pressable
          style={[styles.weatherToggleBtn, showClouds && styles.weatherToggleBtnActive]}
          onPress={() => setShowClouds((v) => !v)}
          hitSlop={8}
        >
          <Ionicons name="rainy-outline" size={15} color={showClouds ? '#031109' : palette.text} />
        </Pressable>
        <Pressable
          style={[styles.weatherToggleBtn, showWind && styles.weatherToggleBtnActive]}
          onPress={() => setShowWind((v) => !v)}
          hitSlop={8}
        >
          <Ionicons name="flag-outline" size={15} color={showWind ? '#031109' : palette.text} />
        </Pressable>
      </View>
      {loading && (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={palette.accent} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    height: 440,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: '#060c1a',
  },
  webview: { flex: 1, backgroundColor: 'transparent' },
  weatherToggles: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    gap: 6,
  },
  weatherToggleBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7,13,28,0.78)',
    borderWidth: 1,
    borderColor: palette.line,
  },
  weatherToggleBtnActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(6,12,26,0.35)',
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    padding: 12,
  },
  layerOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    alignItems: 'flex-end',
  },
  mapModeBtn: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(7,13,28,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  mapModeBtnActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  mapModeBtnText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '800',
  },
  mapModeBtnTextActive: {
    color: '#041109',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(7,13,28,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,90,0.4)',
  },
  liveBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#ff3b30',
  },
  liveBadgeText: {
    color: '#ff6b6b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  viewersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(7,13,28,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  viewersBadgeText: {
    color: palette.text,
    fontSize: 11,
    fontWeight: '800',
  },
  applauseBtn: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7,13,28,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  applauseBtnText: {
    fontSize: 14,
  },
  applauseBtnUsed: {
    opacity: 0.4,
  },
  applauseBtnTextUsed: {
    opacity: 0.7,
  },
  layerModeBtn: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(7,13,28,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  layerModeBtnText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '800',
  },
  layerPicker: {
    marginTop: 8,
    borderRadius: 14,
    padding: 4,
    gap: 2,
    backgroundColor: 'rgba(7,13,28,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  layerOption: {
    minWidth: 104,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  layerOptionActive: {
    backgroundColor: palette.accent,
  },
  layerOptionText: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '800',
  },
  layerOptionTextActive: {
    color: '#041109',
  },
})
