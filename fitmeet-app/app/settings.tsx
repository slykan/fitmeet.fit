import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { CATEGORIES } from '@/src/lib/categories'
import { api } from '@/src/lib/api'
import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'

const RADIUS_OPTIONS: { label: string; value: 'nearby' | 'city' | 'region' | 'unlimited'; desc: string }[] = [
  { value: 'nearby',    label: 'Nearby',    desc: '50 km'  },
  { value: 'city',      label: 'City',      desc: '200 km' },
  { value: 'region',    label: 'Region',    desc: '500 km' },
  { value: 'unlimited', label: 'Unlimited', desc: '∞'      },
]

const SKILL_OPTIONS = [
  { value: 'beginner', label: 'Beginner', desc: 'Just starting' },
  { value: 'advanced', label: 'Advanced', desc: 'Regular'        },
  { value: 'pro',      label: 'Pro',      desc: 'Expert'         },
] as const

const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.emoji])
)

export default function SettingsScreen() {
  const user       = useAuthStore(s => s.user)
  const refreshMe  = useAuthStore(s => s.refreshMe)
  const deleteAccount = useAuthStore(s => s.deleteAccount)

  const [name,       setName]       = useState(user?.name ?? '')
  const [phone,      setPhone]      = useState(user?.phone ?? '')
  const [hidePhone,  setHidePhone]  = useState(user?.hide_phone ?? false)
  const [city,       setCity]       = useState(user?.home?.city ?? '')
  const [country,    setCountry]    = useState(user?.home?.country ?? '')
  const [radius,     setRadius]     = useState<'nearby'|'city'|'region'|'unlimited'>(user?.radius ?? 'nearby')
  const [categories, setCategories] = useState<string[]>(user?.categories ?? [])
  const [skillLevel, setSkillLevel] = useState(user?.skill_level ?? '')

  const [saving,     setSaving]     = useState(false)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [saved,      setSaved]      = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar ?? null)

  useEffect(() => {
    setAvatarPreview(user?.avatar ?? null)
  }, [user?.avatar])

  function toggleCategory(value: string) {
    setCategories(prev =>
      prev.includes(value) ? prev.filter(c => c !== value) : [...prev, value]
    )
  }

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [1, 1],
    })
    if (result.canceled || !result.assets[0]) return
    setAvatarPreview(result.assets[0].uri)
    setAvatarSaving(true)
    try {
      const fd = new FormData()
      fd.append('avatar_file', {
        uri: result.assets[0].uri,
        name: 'avatar.jpg',
        type: 'image/jpeg',
      } as never)
      await api.post('/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      await refreshMe()
    } catch {
      Alert.alert('Error', 'Could not update avatar.')
    } finally {
      setAvatarSaving(false)
    }
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Missing', 'Name is required.'); return }
    if (!city.trim() || !country.trim()) { Alert.alert('Missing', 'City and country/address are required.'); return }
    setSaving(true); setError(null); setSaved(false)
    try {
      await api.patch('/me', {
        name: name.trim(),
        phone: phone.trim() || null,
        hide_phone: hidePhone,
        home_city: city.trim(),
        home_country: country.trim(),
        radius,
        categories,
        skill_level: skillLevel || null,
      })
      await refreshMe()
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Could not save settings.')
    } finally {
      setSaving(false)
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete my account?',
      'This will permanently delete your profile, events, messages and settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true)
            try {
              await deleteAccount()
              router.replace('/welcome')
            } catch (e: unknown) {
              const msg = (e as { message?: string })?.message
              Alert.alert('Error', msg ?? 'Could not delete account.')
            } finally {
              setDeletingAccount(false)
            }
          },
        },
      ]
    )
  }

  if (!user) return null

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </Pressable>
        <Text style={styles.heading}>Settings</Text>
        <Pressable style={[styles.saveBtn, saved && styles.saveBtnDone]} onPress={handleSave} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color="#041109" />
            : <Text style={styles.saveBtnLabel}>{saved ? '✓ Saved' : 'Save'}</Text>
          }
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Avatar ── */}
        <SectionHeader title="Profile photo" icon="camera-outline" />
        <View style={styles.avatarRow}>
          <Pressable onPress={pickAvatar} disabled={avatarSaving}>
            {avatarPreview
              ? <Image source={{ uri: avatarPreview }} style={styles.avatar} />
              : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{user.name.charAt(0).toUpperCase()}</Text>
                </View>
              )
            }
            <View style={styles.cameraOverlay}>
              {avatarSaving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="camera" size={16} color="#fff" />
              }
            </View>
          </Pressable>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.avatarName}>{user.name}</Text>
            <Text style={styles.avatarEmail}>{user.email}</Text>
          </View>
        </View>

        {/* ── Basic info ── */}
        <SectionHeader title="Basic info" icon="person-outline" />

        <Field label="Name *">
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder="Your name" placeholderTextColor={palette.textDim} />
        </Field>

        <Field label="Phone">
          <TextInput style={styles.input} value={phone} onChangeText={setPhone}
            placeholder="+385 91 234 5678" placeholderTextColor={palette.textDim}
            keyboardType="phone-pad" />
        </Field>

        <Pressable style={styles.toggleRow} onPress={() => setHidePhone(v => !v)}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Hide phone from others</Text>
            <Text style={styles.toggleDesc}>Your phone number won't be visible on your profile</Text>
          </View>
          <View style={[styles.toggle, hidePhone && styles.toggleOn]}>
            <View style={[styles.knob, hidePhone && styles.knobOn]} />
          </View>
        </Pressable>

        {/* ── Location ── */}
        <SectionHeader title="Location" icon="location-outline" />

        <View style={styles.row}>
          <Field label="City *" style={{ flex: 1 }}>
            <TextInput style={styles.input} value={city} onChangeText={setCity}
              placeholder="Zagreb" placeholderTextColor={palette.textDim} />
          </Field>
          <Field label="Country / address *" style={{ flex: 1 }}>
            <TextInput style={styles.input} value={country} onChangeText={setCountry}
              placeholder="Croatia" placeholderTextColor={palette.textDim} />
          </Field>
        </View>

        <Field label="Discovery radius">
          <View style={styles.radiusGrid}>
            {RADIUS_OPTIONS.map(r => (
              <Pressable
                key={r.value}
                style={[styles.radiusCard, radius === r.value && styles.radiusCardActive]}
                onPress={() => setRadius(r.value)}
              >
                <Text style={[styles.radiusLabel, radius === r.value && styles.radiusLabelActive]}>
                  {r.label}
                </Text>
                <Text style={styles.radiusDesc}>{r.desc}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        {/* ── Interests ── */}
        <SectionHeader title="Interests" icon="heart-outline" />

        <Field label="Categories">
          <View style={styles.catGrid}>
            {CATEGORIES.map(cat => {
              const active = categories.includes(cat.value)
              return (
                <Pressable
                  key={cat.value}
                  style={[styles.catChip, active && styles.catChipActive]}
                  onPress={() => toggleCategory(cat.value)}
                >
                  <Text style={[styles.catText, active && styles.catTextActive]}>
                    {cat.emoji} {cat.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </Field>

        <Field label="Skill level">
          <View style={styles.skillRow}>
            {SKILL_OPTIONS.map(opt => (
              <Pressable
                key={opt.value}
                style={[styles.skillCard, skillLevel === opt.value && styles.skillCardActive]}
                onPress={() => setSkillLevel(v => v === opt.value ? '' : opt.value)}
              >
                <Text style={[styles.skillLabel, skillLevel === opt.value && styles.skillLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={styles.skillDesc}>{opt.desc}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        {error && (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          style={[styles.submitBtn, (saving || saved) && styles.submitBtnDone]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#041109" size="small" />
            : <Text style={styles.submitLabel}>{saved ? '✓ Saved!' : 'Save changes'}</Text>
          }
        </Pressable>

        <View style={styles.dangerZone}>
          <View style={styles.dangerHeader}>
            <Ionicons name="warning-outline" size={16} color="#fca5a5" />
            <Text style={styles.dangerTitle}>Danger zone</Text>
          </View>
          <Text style={styles.dangerText}>
            Permanently remove your account and all FitMeet data connected to it.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.deleteAccountBtn,
              pressed && styles.deleteAccountBtnPressed,
              deletingAccount && styles.deleteAccountBtnDisabled,
            ]}
            onPress={confirmDeleteAccount}
            disabled={deletingAccount}
          >
            {deletingAccount
              ? <ActivityIndicator size="small" color="#fecaca" />
              : (
                <>
                  <Ionicons name="trash-outline" size={17} color="#fecaca" />
                  <Text style={styles.deleteAccountLabel}>Delete my account</Text>
                </>
              )
            }
          </Pressable>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <View style={sh.wrap}>
      <Ionicons name={icon as never} size={15} color={palette.accent} />
      <Text style={sh.title}>{title}</Text>
    </View>
  )
}
const sh = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 2 },
  title: { color: palette.text, fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
})

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: palette.bg },
  topBar:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, paddingBottom: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, color: palette.text, fontSize: 20, fontWeight: '800' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: palette.accent, minWidth: 60, alignItems: 'center' },
  saveBtnDone: { backgroundColor: 'rgba(57,255,20,0.2)', borderWidth: 1, borderColor: palette.accent },
  saveBtnLabel: { color: '#041109', fontSize: 14, fontWeight: '800' },

  content: { padding: spacing.md, gap: spacing.md },
  fieldLabel: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.sm },

  avatarRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar:       { width: 72, height: 72, borderRadius: 18, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panelRaised },
  avatarFallback: { width: 72, height: 72, borderRadius: 18, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  avatarInitial:  { color: '#041109', fontSize: 28, fontWeight: '800' },
  cameraOverlay: {
    position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center',
  },
  avatarName:  { color: palette.text, fontSize: 16, fontWeight: '800' },
  avatarEmail: { color: palette.textMuted, fontSize: 13 },

  input: {
    height: 50, borderRadius: 14, backgroundColor: palette.panel,
    borderWidth: 1, borderColor: palette.line,
    paddingHorizontal: spacing.md, color: palette.text, fontSize: 15,
  },

  toggleRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  toggleInfo: { flex: 1, gap: 2 },
  toggleLabel:{ color: palette.text, fontSize: 14, fontWeight: '700' },
  toggleDesc: { color: palette.textDim, fontSize: 12 },
  toggle:     { width: 48, height: 28, borderRadius: 999, backgroundColor: palette.panelRaised, borderWidth: 1, borderColor: palette.line, justifyContent: 'center', paddingHorizontal: 3 },
  toggleOn:   { backgroundColor: palette.accent, borderColor: palette.accent },
  knob:       { width: 22, height: 22, borderRadius: 11, backgroundColor: palette.textDim },
  knobOn:     { backgroundColor: '#041109', alignSelf: 'flex-end' },

  radiusGrid:       { flexDirection: 'row', gap: 8 },
  radiusCard:       { flex: 1, borderRadius: 14, paddingVertical: 10, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, alignItems: 'center', gap: 2 },
  radiusCardActive: { borderColor: 'rgba(0,168,255,0.5)', backgroundColor: 'rgba(0,168,255,0.08)' },
  radiusLabel:      { color: palette.textMuted, fontSize: 12, fontWeight: '800' },
  radiusLabelActive:{ color: '#58beff' },
  radiusDesc:       { color: palette.textDim, fontSize: 11 },

  catGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip:       { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: palette.panelRaised, borderWidth: 1, borderColor: palette.line },
  catChipActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  catText:       { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  catTextActive: { color: '#041109' },

  skillRow:        { flexDirection: 'row', gap: 10 },
  skillCard:       { flex: 1, borderRadius: 14, paddingVertical: 12, backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line, alignItems: 'center', gap: 2 },
  skillCardActive: { borderColor: palette.accent, backgroundColor: `${palette.accent}12` },
  skillLabel:      { color: palette.textMuted, fontSize: 13, fontWeight: '800' },
  skillLabelActive:{ color: palette.accent },
  skillDesc:       { color: palette.textDim, fontSize: 11 },

  errorWrap: { backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 12, padding: 12 },
  errorText: { color: '#f87171', fontSize: 13 },

  submitBtn:     { height: 56, borderRadius: 18, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitBtnDone: { backgroundColor: 'rgba(57,255,20,0.15)', borderWidth: 1, borderColor: palette.accent },
  submitLabel:   { color: '#041109', fontSize: 16, fontWeight: '800' },

  dangerZone: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    backgroundColor: 'rgba(127,29,29,0.12)',
    padding: spacing.md,
    gap: 10,
  },
  dangerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dangerTitle: { color: '#fecaca', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  dangerText: { color: '#fca5a5', fontSize: 13, lineHeight: 18 },
  deleteAccountBtn: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.6)',
    backgroundColor: 'rgba(239,68,68,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteAccountBtnPressed: { backgroundColor: 'rgba(239,68,68,0.22)' },
  deleteAccountBtnDisabled: { opacity: 0.65 },
  deleteAccountLabel: { color: '#fecaca', fontSize: 14, fontWeight: '800' },
})
