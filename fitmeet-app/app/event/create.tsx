import { Ionicons } from '@expo/vector-icons'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'

import { CATEGORIES } from '@/src/lib/categories'
import { api } from '@/src/lib/api'
import { parseGpxText } from '@/src/lib/gpx'
import { palette, spacing } from '@/src/theme'

// ─── Constants ────────────────────────────────────────────────────────────────

const OW_KEY = '62d9f65c21e8b140487241223fae5a2e'

const SKILL_LEVELS = [
  { value: 'beginner', label: 'Beginner', desc: 'Just starting' },
  { value: 'advanced', label: 'Advanced', desc: 'Regular' },
  { value: 'pro',      label: 'Pro',      desc: 'Expert' },
] as const

const DURATION_PRESETS = [
  { label: '30 min', value: '30' },
  { label: '1 h',    value: '60' },
  { label: '1.5 h',  value: '90' },
  { label: '2 h',    value: '120' },
  { label: '3 h',    value: '180' },
]

// ─── Map HTML ─────────────────────────────────────────────────────────────────

function buildPickerMapHtml(lat: number | null, lng: number | null, track: [number,number][]) {
  const hasPin   = lat !== null && lng !== null
  const trackStr = JSON.stringify(track)
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>
    html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#050816;}
    .leaflet-control-attribution{display:none;}
    .fm-pin{
      width:32px;height:32px;border-radius:50%;
      background:rgba(7,13,28,0.92);border:2.5px solid #39FF14;
      box-shadow:0 0 0 4px rgba(57,255,20,0.18);
      display:flex;align-items:center;justify-content:center;
      font-size:14px;color:#39FF14;font-weight:900;
    }
    #gps-btn{
      position:absolute;top:10px;right:10px;z-index:900;
      width:38px;height:38px;border-radius:12px;
      background:rgba(5,8,22,0.88);border:1.5px solid rgba(255,255,255,0.14);
      display:flex;align-items:center;justify-content:center;
      cursor:pointer;font-size:18px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="gps-btn" onclick="useGPS()">📍</div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const initLat = ${hasPin ? lat : 45.5511};
    const initLng = ${hasPin ? lng : 18.6939};
    const initZoom = ${hasPin ? 13 : 6};
    const track = ${trackStr};

    const map = L.map('map',{zoomControl:false,attributionControl:false,preferCanvas:true})
      .setView([initLat,initLng],initZoom);
    L.control.zoom({position:'bottomright'}).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18}).addTo(map);
    L.tileLayer('https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${OW_KEY}',{maxZoom:18,opacity:0.7,zIndex:219}).addTo(map);
    L.tileLayer('https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OW_KEY}',{maxZoom:18,opacity:0.7,zIndex:220}).addTo(map);

    let marker = null;

    function placePin(lat, lng) {
      if (marker) map.removeLayer(marker);
      const icon = L.divIcon({className:'',html:'<div class="fm-pin">+</div>',iconSize:[32,32],iconAnchor:[16,16]});
      marker = L.marker([lat,lng],{icon}).addTo(map);
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
        JSON.stringify({type:'pin',lat,lng})
      );
    }

    ${hasPin ? `placePin(${lat},${lng});` : ''}

    if (track.length > 1) {
      const poly = L.polyline(track,{color:'#39FF14',weight:3,opacity:0.85,lineJoin:'round'}).addTo(map);
      setTimeout(function() {
        map.invalidateSize();
        map.fitBounds(poly.getBounds(),{padding:[32,32]});
      }, 200);
    }

    map.on('click',e => placePin(e.latlng.lat, e.latlng.lng));

    function useGPS() {
      navigator.geolocation.getCurrentPosition(
        pos => {
          placePin(pos.coords.latitude, pos.coords.longitude);
          map.setView([pos.coords.latitude, pos.coords.longitude], 14);
        },
        err => { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type:'gps_error'})); },
        {timeout:8000}
      );
    }
  </script>
</body>
</html>`
}


// ─── Nominatim ────────────────────────────────────────────────────────────────

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'FitMeetApp/1.0' } }
    )
    const data = await res.json()
    if (!data.address) return ''
    const a = data.address
    return [a.road, a.city || a.town || a.village, a.country].filter(Boolean).join(', ')
  } catch { return '' }
}

async function forwardGeocode(q: string): Promise<{ lat: number; lng: number; address: string } | null> {
  try {
    const res  = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'FitMeetApp/1.0' } }
    )
    const data = await res.json()
    if (!data[0]) return null
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      address: data[0].display_name.split(',').slice(0,3).join(',').trim(),
    }
  } catch { return null }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreateEventScreen() {
  const params = useLocalSearchParams<{ id?: string }>()
  const editId = typeof params.id === 'string' ? params.id : null
  const webViewRef = useRef<WebView>(null)

  // Basic
  const [title,       setTitle]       = useState('')
  const [category,    setCategory]    = useState('')
  const [description, setDescription] = useState('')

  // When
  const [date,        setDate]        = useState('')
  const [time,        setTime]        = useState('')
  const [duration,    setDuration]    = useState('')

  // Where
  const [lat,         setLat]         = useState<number | null>(null)
  const [lng,         setLng]         = useState<number | null>(null)
  const [address,     setAddress]     = useState('')
  const [geocoding,   setGeocoding]   = useState(false)
  const [gpxTrack,    setGpxTrack]    = useState<[number,number][]>([])

  // Details
  const [skillLevel,  setSkillLevel]  = useState('')
  const [maxPax,      setMaxPax]      = useState('')
  const [isPrivate,   setIsPrivate]   = useState(false)
  const [distanceKm,  setDistanceKm]  = useState('')
  const [elevGain,    setElevGain]    = useState('')
  const [maxGrade,    setMaxGrade]    = useState('')
  const [maxDowngrade,setMaxDowngrade]= useState('')
  const [pace,        setPace]        = useState('')

  // Image
  const [imageUri,    setImageUri]    = useState<string | null>(null)
  const [imageName,   setImageName]   = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageRemoved, setImageRemoved] = useState(false)

  // GPX
  const [gpxName,     setGpxName]     = useState<string | null>(null)
  const [gpxContent,  setGpxContent]  = useState<string | null>(null)

  const [submitting,  setSubmitting]  = useState(false)
  const [prefilling,  setPrefilling]  = useState(false)

  const mapKey = `${lat}-${lng}-${gpxTrack.length}`

  useEffect(() => {
    if (!editId) return

    let alive = true
    setPrefilling(true)
    api.get(`/events/${editId}`)
      .then(({ data }) => {
        if (!alive) return
        const ev = data.data
        const start = new Date(ev.schedule.start_at)
        const yyyy = start.getFullYear()
        const mm = String(start.getMonth() + 1).padStart(2, '0')
        const dd = String(start.getDate()).padStart(2, '0')
        const hh = String(start.getHours()).padStart(2, '0')
        const mi = String(start.getMinutes()).padStart(2, '0')

        setTitle(ev.title ?? '')
        setCategory(ev.category?.value ?? '')
        setDescription(ev.description ?? '')
        setDate(`${yyyy}-${mm}-${dd}`)
        setTime(`${hh}:${mi}`)
        setDuration(ev.schedule?.duration_minutes ? String(ev.schedule.duration_minutes) : '')
        setLat(typeof ev.location?.lat === 'number' ? ev.location.lat : null)
        setLng(typeof ev.location?.lng === 'number' ? ev.location.lng : null)
        setAddress(ev.location?.address ?? '')
        setSkillLevel(ev.skill_level ?? '')
        setMaxPax(ev.max_participants ? String(ev.max_participants) : '')
        setIsPrivate(Boolean(ev.is_private))
        setDistanceKm(ev.activity?.distance_km ? String(ev.activity.distance_km) : '')
        setElevGain(ev.activity?.elevation_gain ? String(ev.activity.elevation_gain) : '')
        setMaxGrade(ev.activity?.max_grade ? String(ev.activity.max_grade) : '')
        setMaxDowngrade(ev.activity?.max_downgrade ? String(ev.activity.max_downgrade) : '')
        setPace(ev.activity?.pace ?? '')
        setImagePreview(ev.image_url ?? null)
        setImageUri(null)
        setImageName(null)
        setImageRemoved(false)
      })
      .catch(() => {
        Alert.alert('Error', 'Could not load event for editing.')
      })
      .finally(() => {
        if (alive) setPrefilling(false)
      })

    return () => { alive = false }
  }, [editId])

  // ─── Handlers ───────────────────────────────────────────────────────────────

  async function handleWebViewMessage(e: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(e.nativeEvent.data)
      if (msg.type === 'pin') {
        setLat(msg.lat)
        setLng(msg.lng)
        if (!address) {
          const addr = await reverseGeocode(msg.lat, msg.lng)
          if (addr) setAddress(addr)
        }
      }
    } catch {}
  }

  async function handleGeocodeAddress() {
    if (!address.trim()) return
    setGeocoding(true)
    const result = await forwardGeocode(address.trim())
    setGeocoding(false)
    if (result) {
      setLat(result.lat)
      setLng(result.lng)
      setAddress(result.address)
    } else {
      Alert.alert('Not found', 'Could not find this address.')
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: false,
    })
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri)
      setImageName(result.assets[0].fileName ?? 'image.jpg')
      setImagePreview(result.assets[0].uri)
      setImageRemoved(false)
    }
  }

  function removeImage() {
    setImageUri(null)
    setImageName(null)
    setImagePreview(null)
    setImageRemoved(true)
  }

  async function pickGpx() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/gpx+xml', 'text/xml', 'application/xml', '*/*'],
      copyToCacheDirectory: true,
    })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    setGpxName(asset.name)
    try {
      const text = await fetch(asset.uri).then(r => r.text())
      setGpxContent(text)
      const parsed = parseGpxText(text)
      setGpxTrack(parsed.track)
      if (parsed.track.length > 0 && lat === null) {
        setLat(parsed.track[0][0])
        setLng(parsed.track[0][1])
      }
      if (parsed.distanceKm > 0)   setDistanceKm(String(parsed.distanceKm))
      if (parsed.elevGain > 0)     setElevGain(String(parsed.elevGain))
      if (parsed.maxGrade !== 0)   setMaxGrade(String(parsed.maxGrade))
      if (parsed.maxDowngrade !== 0) setMaxDowngrade(String(parsed.maxDowngrade))
    } catch {
      Alert.alert('Error', 'Could not parse GPX file.')
    }
  }

  async function handleSubmit() {
    if (!title.trim())    { Alert.alert('Missing', 'Add a title.'); return }
    if (!category)        { Alert.alert('Missing', 'Select a category.'); return }
    if (!date || !time)   { Alert.alert('Missing', 'Set date and time.'); return }
    if (lat === null)     { Alert.alert('Missing', 'Pin a location on the map.'); return }

    const dtString = `${date.trim()}T${time.trim()}:00`
    if (isNaN(Date.parse(dtString))) {
      Alert.alert('Invalid date', 'Use YYYY-MM-DD and HH:MM.')
      return
    }

    setSubmitting(true)
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const startAt  = new Date(dtString).toISOString()

      const fd = new FormData()
      fd.append('title',    title.trim())
      fd.append('category', category)
      fd.append('start_at', startAt)
      fd.append('timezone', timezone)
      fd.append('lat',      String(lat))
      fd.append('lng',      String(lng))
      fd.append('is_private', isPrivate ? '1' : '0')
      if (address.trim())     fd.append('address',          address.trim())
      if (description.trim()) fd.append('description',      description.trim())
      if (duration.trim())    fd.append('duration_minutes', duration.trim())
      if (maxPax.trim())      fd.append('max_participants', maxPax.trim())
      if (skillLevel)         fd.append('skill_level',      skillLevel)
      if (distanceKm.trim())  fd.append('distance_km',      distanceKm.trim())
      if (elevGain.trim())    fd.append('elevation_gain',   elevGain.trim())
      if (maxGrade.trim())    fd.append('max_grade',        maxGrade.trim())
      if (maxDowngrade.trim())fd.append('max_downgrade',    maxDowngrade.trim())
      if (pace.trim())        fd.append('pace',             pace.trim())

      if (imageUri) {
        fd.append('image_file', { uri: imageUri, name: imageName ?? 'image.jpg', type: 'image/jpeg' } as never)
      } else if (editId && imageRemoved) {
        fd.append('image_remove', '1')
      }
      if (gpxContent && gpxName) {
        fd.append('gpx_file', { uri: `data:application/gpx+xml;base64,${btoa(gpxContent)}`, name: gpxName, type: 'application/gpx+xml' } as never)
      }

      const { data } = editId
        ? await api.post(`/events/${editId}`, (() => {
            fd.append('_method', 'PATCH')
            return fd
          })(), {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        : await api.post('/events', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
      router.replace(`/event/${data.data.id}` as never)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      Alert.alert('Error', msg ?? (editId ? 'Could not update event.' : 'Could not create event.'))
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </Pressable>
        <Text style={styles.heading}>{editId ? 'Edit Event' : 'New Event'}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {prefilling ? (
          <View style={{ paddingVertical: spacing.md }}>
            <ActivityIndicator color={palette.accent} />
          </View>
        ) : null}

        {/* ── Basic info ── */}
        <SectionHeader title="Basic info" icon="information-circle-outline" />

        <Field label="Event title *">
          <TextInput
            style={styles.input} value={title} onChangeText={setTitle}
            placeholder="e.g. Morning run around Jarun"
            placeholderTextColor={palette.textDim} maxLength={100}
          />
        </Field>

        <Field label="Category *">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {CATEGORIES.map(cat => (
              <Pressable
                key={cat.value}
                onPress={() => setCategory(cat.value)}
                style={[styles.chip, category === cat.value && styles.chipActive]}
              >
                <Text style={[styles.chipText, category === cat.value && styles.chipTextActive]}>
                  {cat.emoji} {cat.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Field>

        <Field label="Description">
          <TextInput
            style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription}
            placeholder="What should attendees know? (optional)"
            placeholderTextColor={palette.textDim} multiline numberOfLines={3}
          />
        </Field>

        <Field label="Event image">
          <Pressable style={[styles.uploadBtn, imagePreview && styles.uploadBtnActive]} onPress={pickImage}>
            <Ionicons name="image-outline" size={16} color={imagePreview ? palette.accent : palette.textMuted} />
            <Text style={[styles.uploadLabel, imagePreview && styles.uploadLabelActive]}>
              {imageName ?? (imagePreview ? 'Change event image' : 'Add event image (optional)')}
            </Text>
          </Pressable>
          {imagePreview && (
            <View style={styles.imagePreviewWrap}>
              <Image source={{ uri: imagePreview }} style={styles.imagePreview} resizeMode="cover" />
              <Pressable style={styles.removeImageBtn} onPress={removeImage}>
                <Ionicons name="trash-outline" size={15} color="#f87171" />
                <Text style={styles.removeImageText}>Remove image</Text>
              </Pressable>
            </View>
          )}
        </Field>

        {/* ── When ── */}
        <SectionHeader title="When" icon="calendar-outline" />

        <View style={styles.row}>
          <Field label="Date * (YYYY-MM-DD)" style={{ flex: 1 }}>
            <TextInput
              style={styles.input} value={date} onChangeText={setDate}
              placeholder="2026-06-15" placeholderTextColor={palette.textDim}
              keyboardType="numeric" maxLength={10}
            />
          </Field>
          <Field label="Time * (HH:MM)" style={{ flex: 1 }}>
            <TextInput
              style={styles.input} value={time} onChangeText={setTime}
              placeholder="09:00" placeholderTextColor={palette.textDim}
              keyboardType="numeric" maxLength={5}
            />
          </Field>
        </View>

        <Field label="Duration">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, { marginBottom: 8 }]}>
            {DURATION_PRESETS.map(p => (
              <Pressable
                key={p.value}
                onPress={() => setDuration(duration === p.value ? '' : p.value)}
                style={[styles.chip, duration === p.value && styles.chipRadius]}
              >
                <Text style={[styles.chipText, duration === p.value && styles.chipTextRadius]}>{p.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput
            style={styles.input} value={duration} onChangeText={setDuration}
            placeholder="Or type custom (minutes)" placeholderTextColor={palette.textDim}
            keyboardType="numeric"
          />
        </Field>

        {/* ── Where ── */}
        <SectionHeader title="Where" icon="location-outline" />

        <Field label="Tap on map to pin location *">
          <View style={styles.mapWrap}>
            <WebView
              key={mapKey}
              ref={webViewRef}
              source={{ html: buildPickerMapHtml(lat, lng, gpxTrack) }}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              geolocationEnabled
              scrollEnabled={false}
              onMessage={handleWebViewMessage}
              style={styles.mapWebView}
            />
          </View>
          {lat !== null && (
            <Text style={styles.coordsLabel}>
              📍 {lat.toFixed(5)}, {lng?.toFixed(5)}
            </Text>
          )}
        </Field>

        <Field label="Address">
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { flex: 1 }]} value={address} onChangeText={setAddress}
              placeholder="Type city or address, then search"
              placeholderTextColor={palette.textDim}
              onSubmitEditing={handleGeocodeAddress}
              returnKeyType="search"
            />
            <Pressable
              style={styles.searchBtn}
              onPress={handleGeocodeAddress}
              disabled={geocoding}
            >
              {geocoding
                ? <ActivityIndicator size="small" color={palette.accent} />
                : <Ionicons name="search-outline" size={18} color={palette.accent} />
              }
            </Pressable>
          </View>
        </Field>

        <Field label="GPX route">
          <Pressable style={[styles.uploadBtn, gpxName && styles.uploadBtnActive]} onPress={pickGpx}>
            <Ionicons name="map-outline" size={16} color={gpxName ? palette.accent : palette.textMuted} />
            <Text style={[styles.uploadLabel, gpxName && styles.uploadLabelActive]}>
              {gpxName ? `${gpxName} · ${gpxTrack.length} pts` : 'Upload GPX file (optional)'}
            </Text>
          </Pressable>
        </Field>

        {/* ── Details ── */}
        <SectionHeader title="Details" icon="settings-outline" badge="optional" />

        <Field label="Skill level">
          <View style={styles.skillRow}>
            {SKILL_LEVELS.map(opt => (
              <Pressable
                key={opt.value}
                onPress={() => setSkillLevel(v => v === opt.value ? '' : opt.value)}
                style={[styles.skillCard, skillLevel === opt.value && styles.skillCardActive]}
              >
                <Text style={[styles.skillLabel, skillLevel === opt.value && styles.skillLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={styles.skillDesc}>{opt.desc}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <View style={styles.row}>
          <Field label="Max participants" style={{ flex: 1 }}>
            <TextInput
              style={styles.input} value={maxPax} onChangeText={setMaxPax}
              placeholder="Unlimited" placeholderTextColor={palette.textDim} keyboardType="numeric"
            />
          </Field>
          <Field label="Visibility" style={{ flex: 1 }}>
            <Pressable
              style={[styles.input, styles.toggleBtn, isPrivate && styles.toggleBtnActive]}
              onPress={() => setIsPrivate(v => !v)}
            >
              <Ionicons
                name={isPrivate ? 'lock-closed-outline' : 'lock-open-outline'}
                size={16}
                color={isPrivate ? palette.accent : palette.textMuted}
              />
              <Text style={[styles.toggleLabel, isPrivate && styles.toggleLabelActive]}>
                {isPrivate ? 'Private' : 'Public'}
              </Text>
            </Pressable>
          </Field>
        </View>

        <View style={styles.row}>
          <Field label="Distance (km)" style={{ flex: 1 }}>
            <TextInput
              style={styles.input} value={distanceKm} onChangeText={setDistanceKm}
              placeholder="10.5" placeholderTextColor={palette.textDim} keyboardType="decimal-pad"
            />
          </Field>
          <Field label="Elev. gain (m)" style={{ flex: 1 }}>
            <TextInput
              style={styles.input} value={elevGain} onChangeText={setElevGain}
              placeholder="250" placeholderTextColor={palette.textDim} keyboardType="numeric"
            />
          </Field>
        </View>

        <View style={styles.row}>
          <Field label="Max grade ▲ (%)" style={{ flex: 1 }}>
            <TextInput
              style={styles.input} value={maxGrade} onChangeText={setMaxGrade}
              placeholder="12" placeholderTextColor={palette.textDim} keyboardType="decimal-pad"
            />
          </Field>
          <Field label="Max grade ▼ (%)" style={{ flex: 1 }}>
            <TextInput
              style={styles.input} value={maxDowngrade} onChangeText={setMaxDowngrade}
              placeholder="-8" placeholderTextColor={palette.textDim} keyboardType="decimal-pad"
            />
          </Field>
        </View>

        <Field label="Pace">
          <TextInput
            style={styles.input} value={pace} onChangeText={setPace}
            placeholder="e.g. 5:30/km" placeholderTextColor={palette.textDim}
          />
        </Field>

        {/* ── Submit ── */}
        <Pressable
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? <ActivityIndicator color="#041109" size="small" />
            : <Text style={styles.submitLabel}>{editId ? 'Save Changes' : 'Create Event'}</Text>
          }
        </Pressable>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, icon, badge }: { title: string; icon: string; badge?: string }) {
  return (
    <View style={sh.wrap}>
      <Ionicons name={icon as never} size={15} color={palette.accent} />
      <Text style={sh.title}>{title}</Text>
      {badge && <View style={sh.badge}><Text style={sh.badgeText}>{badge}</Text></View>}
    </View>
  )
}
const sh = StyleSheet.create({
  wrap:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 2 },
  title:     { color: palette.text, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  badge:     { backgroundColor: palette.panelRaised, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: palette.textMuted, fontSize: 11, fontWeight: '600' },
})

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: palette.bg },
  topBar:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, paddingBottom: 8 },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line,
    alignItems: 'center', justifyContent: 'center',
  },
  heading: { flex: 1, color: palette.text, fontSize: 20, fontWeight: '800' },
  content: { padding: spacing.md, gap: spacing.md },

  fieldLabel: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  row:        { flexDirection: 'row', gap: spacing.sm },

  input: {
    height: 50, borderRadius: 14,
    backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line,
    paddingHorizontal: spacing.md, color: palette.text, fontSize: 15,
  },
  textarea: { height: 90, paddingTop: 14, textAlignVertical: 'top' },

  chipRow:      { flexDirection: 'row', gap: 8 },
  chip:         { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: palette.panelRaised, borderWidth: 1, borderColor: palette.line },
  chipActive:   { backgroundColor: palette.accent, borderColor: palette.accent },
  chipText:     { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#041109' },
  chipRadius:   { borderColor: 'rgba(0,168,255,0.5)', backgroundColor: 'rgba(0,168,255,0.08)' },
  chipTextRadius: { color: '#58beff', fontWeight: '700', fontSize: 13 },

  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, paddingHorizontal: spacing.md, paddingVertical: 14,
    backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, borderStyle: 'dashed',
  },
  uploadBtnActive: { borderColor: palette.accent, backgroundColor: `${palette.accent}12` },
  uploadLabel:       { color: palette.textMuted, fontSize: 14, flex: 1 },
  uploadLabelActive: { color: palette.accent },

  imagePreviewWrap: { gap: 10, marginTop: 8 },
  imagePreview: { width: '100%', height: 180, borderRadius: 14 },
  removeImageBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.25)',
  },
  removeImageText: { color: '#f87171', fontSize: 12, fontWeight: '700' },

  mapWrap: {
    height: 260, borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: palette.line,
  },
  mapWebView: { flex: 1, backgroundColor: 'transparent' },
  coordsLabel: { color: palette.textMuted, fontSize: 12, marginTop: 4 },

  searchBtn: {
    width: 50, height: 50, borderRadius: 14,
    backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  skillRow: { flexDirection: 'row', gap: 10 },
  skillCard: {
    flex: 1, borderRadius: 14, paddingVertical: 12,
    backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line,
    alignItems: 'center', gap: 2,
  },
  skillCardActive: { borderColor: palette.accent, backgroundColor: `${palette.accent}12` },
  skillLabel:       { color: palette.textMuted, fontSize: 13, fontWeight: '800' },
  skillLabelActive: { color: palette.accent },
  skillDesc:        { color: palette.textDim, fontSize: 11 },

  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  toggleBtnActive:   { borderColor: palette.accent, backgroundColor: `${palette.accent}12` },
  toggleLabel:       { color: palette.textMuted, fontSize: 14, fontWeight: '700' },
  toggleLabelActive: { color: palette.accent },

  submitBtn:         { height: 56, borderRadius: 18, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitBtnDisabled: { opacity: 0.5 },
  submitLabel:       { color: '#041109', fontSize: 16, fontWeight: '800' },
})
