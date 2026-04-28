import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator, Alert, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { CATEGORIES } from '@/src/lib/categories'
import { api } from '@/src/lib/api'
import { palette, spacing } from '@/src/theme'

// ─── Types ────────────────────────────────────────────────────────────────────

const SKILL_LEVELS = ['beginner', 'advanced', 'pro'] as const

// ─── Nominatim geocode ────────────────────────────────────────────────────────

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'FitMeetApp/1.0' } },
    )
    const data = await res.json()
    if (!data[0]) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CreateEventScreen() {
  const [title,       setTitle]       = useState('')
  const [category,    setCategory]    = useState('')
  const [date,        setDate]        = useState('')       // YYYY-MM-DD
  const [time,        setTime]        = useState('')       // HH:MM
  const [duration,    setDuration]    = useState('')       // minutes
  const [address,     setAddress]     = useState('')
  const [description, setDescription] = useState('')
  const [maxPax,      setMaxPax]      = useState('')
  const [skillLevel,  setSkillLevel]  = useState('')
  const [distanceKm,  setDistanceKm]  = useState('')
  const [elevGain,    setElevGain]    = useState('')
  const [submitting,  setSubmitting]  = useState(false)

  const canSubmit = title.trim() && category && date.trim() && time.trim() && address.trim() && !submitting

  async function handleCreate() {
    if (!canSubmit) return

    // Validate date format
    const dtString = `${date.trim()}T${time.trim()}:00`
    if (isNaN(Date.parse(dtString))) {
      Alert.alert('Invalid date', 'Use format YYYY-MM-DD for date and HH:MM for time.')
      return
    }

    setSubmitting(true)
    try {
      // Geocode address
      const coords = await geocode(address.trim())
      if (!coords) {
        Alert.alert('Location not found', 'Try a more specific address.')
        setSubmitting(false)
        return
      }

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const startAt  = new Date(`${date.trim()}T${time.trim()}:00`).toISOString()

      const fd = new FormData()
      fd.append('title',    title.trim())
      fd.append('category', category)
      fd.append('start_at', startAt)
      fd.append('timezone', timezone)
      fd.append('lat',      String(coords.lat))
      fd.append('lng',      String(coords.lng))
      fd.append('address',  address.trim())
      if (description.trim()) fd.append('description',   description.trim())
      if (duration.trim())    fd.append('duration_minutes', duration.trim())
      if (maxPax.trim())      fd.append('max_participants', maxPax.trim())
      if (skillLevel)         fd.append('skill_level',   skillLevel)
      if (distanceKm.trim())  fd.append('distance_km',   distanceKm.trim())
      if (elevGain.trim())    fd.append('elevation_gain', elevGain.trim())

      const { data } = await api.post('/events', fd)
      router.replace(`/event/${data.data.id}` as never)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      Alert.alert('Error', msg ?? 'Could not create event.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </Pressable>
        <Text style={styles.heading}>New Event</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Title */}
        <Field label="Event title *">
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="What's happening?"
            placeholderTextColor={palette.textDim}
            maxLength={100}
          />
        </Field>

        {/* Category */}
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

        {/* Date + Time */}
        <View style={styles.row}>
          <Field label="Date * (YYYY-MM-DD)" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              value={date}
              onChangeText={setDate}
              placeholder="2026-06-15"
              placeholderTextColor={palette.textDim}
              keyboardType="numeric"
              maxLength={10}
            />
          </Field>
          <Field label="Time * (HH:MM)" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={setTime}
              placeholder="09:00"
              placeholderTextColor={palette.textDim}
              keyboardType="numeric"
              maxLength={5}
            />
          </Field>
        </View>

        {/* Location */}
        <Field label="Location *">
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="City, address or landmark"
            placeholderTextColor={palette.textDim}
          />
        </Field>

        {/* Description */}
        <Field label="Description">
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Tell people about this event…"
            placeholderTextColor={palette.textDim}
            multiline
            numberOfLines={4}
          />
        </Field>

        {/* Duration + Max participants */}
        <View style={styles.row}>
          <Field label="Duration (min)" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              value={duration}
              onChangeText={setDuration}
              placeholder="90"
              placeholderTextColor={palette.textDim}
              keyboardType="numeric"
            />
          </Field>
          <Field label="Max participants" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              value={maxPax}
              onChangeText={setMaxPax}
              placeholder="20"
              placeholderTextColor={palette.textDim}
              keyboardType="numeric"
            />
          </Field>
        </View>

        {/* Skill level */}
        <Field label="Skill level">
          <View style={styles.chipRow}>
            {SKILL_LEVELS.map(s => (
              <Pressable
                key={s}
                onPress={() => setSkillLevel(v => v === s ? '' : s)}
                style={[styles.chip, skillLevel === s && styles.chipActive]}
              >
                <Text style={[styles.chipText, skillLevel === s && styles.chipTextActive]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </Field>

        {/* Activity */}
        <View style={styles.row}>
          <Field label="Distance (km)" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              value={distanceKm}
              onChangeText={setDistanceKm}
              placeholder="10.5"
              placeholderTextColor={palette.textDim}
              keyboardType="decimal-pad"
            />
          </Field>
          <Field label="Elevation gain (m)" style={{ flex: 1 }}>
            <TextInput
              style={styles.input}
              value={elevGain}
              onChangeText={setElevGain}
              placeholder="250"
              placeholderTextColor={palette.textDim}
              keyboardType="numeric"
            />
          </Field>
        </View>

        {/* Submit */}
        <Pressable
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleCreate}
          disabled={!canSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#041109" size="small" />
          ) : (
            <Text style={styles.submitLabel}>Create Event</Text>
          )}
        </Pressable>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line,
    alignItems: 'center', justifyContent: 'center',
  },
  heading: { flex: 1, color: palette.text, fontSize: 20, fontWeight: '800' },
  content: { padding: spacing.md, gap: spacing.md },

  row:        { flexDirection: 'row', gap: spacing.sm },
  fieldLabel: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },

  input: {
    height: 50, borderRadius: 14,
    backgroundColor: palette.panel,
    borderWidth: 1, borderColor: palette.line,
    paddingHorizontal: spacing.md,
    color: palette.text, fontSize: 15,
  },
  textarea: {
    height: 100, paddingTop: 14,
    textAlignVertical: 'top',
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: palette.panelRaised,
    borderWidth: 1, borderColor: palette.line,
  },
  chipActive:     { backgroundColor: palette.accent, borderColor: palette.accent },
  chipText:       { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#041109' },

  submitBtn: {
    height: 56, borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.sm,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitLabel: { color: '#041109', fontSize: 16, fontWeight: '800' },
})
