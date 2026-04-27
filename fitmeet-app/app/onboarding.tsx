import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native'
import { useState } from 'react'

import { useAuthStore } from '@/src/store/auth'
import { CATEGORIES } from '@/src/lib/categories'
import { palette, spacing } from '@/src/theme'

const RADIUS_OPTIONS = [
  { value: 'nearby',    label: 'Nearby',    km: '50 km' },
  { value: 'city',      label: 'City',      km: '200 km' },
  { value: 'region',    label: 'Region',    km: '500 km' },
  { value: 'unlimited', label: 'Unlimited', km: '∞' },
] as const

const SKILL_OPTIONS = [
  { value: 'beginner', label: 'Beginner', desc: 'Just getting started' },
  { value: 'advanced', label: 'Advanced', desc: 'Regular practitioner' },
  { value: 'pro',      label: 'Pro',      desc: 'Expert level' },
] as const

type Radius = 'nearby' | 'city' | 'region' | 'unlimited'
type Skill  = 'beginner' | 'advanced' | 'pro'

export default function OnboardingScreen() {
  const { user, token, refreshMe } = useAuthStore()

  const [name,       setName]       = useState(user?.name ?? '')
  const [phone,      setPhone]      = useState(user?.phone ?? '')
  const [hidePhone,  setHidePhone]  = useState(false)
  const [city,       setCity]       = useState(user?.home?.city ?? '')
  const [country,    setCountry]    = useState(user?.home?.country ?? '')
  const [radius,     setRadius]     = useState<Radius>(user?.radius ?? 'nearby')
  const [categories, setCategories] = useState<string[]>(user?.categories ?? [])
  const [skill,           setSkill]           = useState<Skill | null>(user?.skill_level ?? null)
  const [emailFriendReq,  setEmailFriendReq]  = useState(user?.email_preferences?.friend_requests ?? true)
  const [emailNewEvents,  setEmailNewEvents]  = useState(user?.email_preferences?.new_events ?? true)
  const [emailReminders,  setEmailReminders]  = useState(user?.email_preferences?.event_reminders ?? true)
  const [emailFriendEvt,  setEmailFriendEvt]  = useState(user?.email_preferences?.friend_events ?? true)
  const [locating,        setLocating]        = useState(false)
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState<string | null>(null)

  const API_URL = 'https://api.fitmeet.fit/api'

  function toggleCategory(value: string) {
    setCategories(prev =>
      prev.includes(value) ? prev.filter(c => c !== value) : [...prev, value]
    )
  }

  async function geocodeCity() {
    const q = [city, country].filter(Boolean).join(', ')
    if (!q.trim()) return
    setLocating(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const results = await res.json()
      if (results[0]) {
        return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) }
      }
    } catch {}
    finally { setLocating(false) }
    return null
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const coords = await geocodeCity()
      const payload: Record<string, unknown> = {
        name:         name.trim(),
        phone:        phone.trim(),
        hide_phone:   hidePhone,
        home_city:    city.trim(),
        home_country: country.trim(),
        radius,
        onboarding_complete: true,
      }
      if (coords) {
        payload.home_lat = coords.lat
        payload.home_lng = coords.lng
      }
      if (categories.length > 0) payload.categories = categories
      if (skill)                  payload.skill_level = skill
      payload.email_friend_requests = emailFriendReq
      payload.email_new_events      = emailNewEvents
      payload.email_event_reminders = emailReminders
      payload.email_friend_events   = emailFriendEvt

      await fetch(`${API_URL}/me`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      await refreshMe()
      router.replace('/(tabs)/hub')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>FITMEET</Text>
          <Text style={styles.title}>Set up your profile</Text>
          <Text style={styles.subtitle}>Help others find and match with you.</Text>
        </View>

        {/* Name */}
        <Section label="Full name">
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={palette.textDim}
            autoCapitalize="words"
          />
        </Section>

        {/* Phone */}
        <Section label="Phone (optional)">
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+385 91 234 5678"
            placeholderTextColor={palette.textDim}
            keyboardType="phone-pad"
          />
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Hide phone from others</Text>
            <Switch
              value={hidePhone}
              onValueChange={setHidePhone}
              trackColor={{ false: palette.line, true: palette.accent }}
              thumbColor="#fff"
            />
          </View>
        </Section>

        {/* Home location */}
        <Section label="Home location">
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={setCity}
            placeholder="City"
            placeholderTextColor={palette.textDim}
          />
          <TextInput
            style={[styles.input, { marginTop: 10 }]}
            value={country}
            onChangeText={setCountry}
            placeholder="Country"
            placeholderTextColor={palette.textDim}
          />
        </Section>

        {/* Radius */}
        <Section label="Event search radius">
          <View style={styles.chipRow}>
            {RADIUS_OPTIONS.map(r => (
              <Pressable
                key={r.value}
                onPress={() => setRadius(r.value)}
                style={[styles.chip, radius === r.value && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, radius === r.value && styles.chipLabelActive]}>
                  {r.label}
                </Text>
                <Text style={[styles.chipSub, radius === r.value && styles.chipSubActive]}>
                  {r.km}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* Categories */}
        <Section label="Your interests">
          <View style={styles.categoryGrid}>
            {CATEGORIES.map(cat => {
              const active = categories.includes(cat.value)
              return (
                <Pressable
                  key={cat.value}
                  onPress={() => toggleCategory(cat.value)}
                  style={[styles.catChip, active && styles.catChipActive]}
                >
                  <Text style={styles.catEmoji}>{cat.emoji}</Text>
                  <Text style={[styles.catLabel, active && styles.catLabelActive]}>
                    {cat.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </Section>

        {/* Skill level */}
        <Section label="Skill level">
          <View style={styles.chipRow}>
            {SKILL_OPTIONS.map(s => (
              <Pressable
                key={s.value}
                onPress={() => setSkill(s.value)}
                style={[styles.chip, styles.chipWide, skill === s.value && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, skill === s.value && styles.chipLabelActive]}>
                  {s.label}
                </Text>
                <Text style={[styles.chipSub, skill === s.value && styles.chipSubActive]}>
                  {s.desc}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>

        {/* Email preferences */}
        <Section label="Email notifications">
          {[
            { label: 'Friend requests',         value: emailFriendReq,  set: setEmailFriendReq },
            { label: 'New events near you',      value: emailNewEvents,  set: setEmailNewEvents },
            { label: "Friends' new events",      value: emailFriendEvt,  set: setEmailFriendEvt },
            { label: 'Event reminders',          value: emailReminders,  set: setEmailReminders },
          ].map(row => (
            <View key={row.label} style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>{row.label}</Text>
              <Switch
                value={row.value}
                onValueChange={row.set}
                trackColor={{ false: palette.line, true: palette.accent }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </Section>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
        >
          <Text style={styles.primaryLabel}>
            {saving ? (locating ? 'Finding location…' : 'Saving…') : 'Continue'}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.replace('/(tabs)/hub')} style={styles.skipButton}>
          <Text style={styles.skipLabel}>Skip for now</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl * 2 },

  header: { gap: 6, marginTop: spacing.sm },
  brand: { color: palette.accent, fontSize: 12, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' },
  title: { color: palette.text, fontSize: 28, lineHeight: 34, fontWeight: '800' },
  subtitle: { color: palette.textMuted, fontSize: 15 },

  section: { gap: 10 },
  sectionLabel: { color: palette.text, fontSize: 14, fontWeight: '700' },

  input: {
    height: 52,
    borderRadius: 16,
    backgroundColor: palette.panel,
    borderWidth: 1,
    borderColor: palette.line,
    paddingHorizontal: spacing.md,
    color: palette.text,
    fontSize: 16,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  toggleLabel: { color: palette.textMuted, fontSize: 14 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chipWide: { flex: 1, minWidth: 90 },
  chipActive: { borderColor: palette.accent, backgroundColor: 'rgba(108,255,47,0.1)' },
  chipLabel: { color: palette.text, fontSize: 13, fontWeight: '700' },
  chipLabelActive: { color: palette.accent },
  chipSub: { color: palette.textDim, fontSize: 11, marginTop: 2 },
  chipSubActive: { color: palette.accent, opacity: 0.8 },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.panel,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  catChipActive: { borderColor: palette.accent, backgroundColor: 'rgba(108,255,47,0.1)' },
  catEmoji: { fontSize: 16 },
  catLabel: { color: palette.text, fontSize: 13, fontWeight: '600' },
  catLabelActive: { color: palette.accent },

  errorText: { color: '#ff8b8b', fontSize: 14, lineHeight: 20 },

  primaryButton: {
    height: 56,
    borderRadius: 18,
    backgroundColor: palette.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  primaryButtonDisabled: { opacity: 0.55 },
  primaryLabel: { color: '#041109', fontSize: 16, fontWeight: '800' },

  skipButton: { alignItems: 'center', paddingVertical: spacing.sm },
  skipLabel: { color: palette.textDim, fontSize: 14 },
})
