import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { api } from '@/src/lib/api'
import { palette, spacing } from '@/src/theme'

interface Broadcast {
  id: number
  title: string
  body: string
  target_platform: string | null
  target_country: string | null
  sent_by: string
  created_at: string
}

const PLATFORMS = [
  { value: null,       label: 'All platforms' },
  { value: 'android',  label: 'Android' },
  { value: 'ios',      label: 'iOS' },
  { value: 'web',      label: 'Web only' },
]

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function AdminBroadcastScreen() {
  const [title,     setTitle]     = useState('')
  const [body,      setBody]      = useState('')
  const [link,      setLink]      = useState('')
  const [platform,  setPlatform]  = useState<string | null>(null)
  const [country,   setCountry]   = useState<string | null>(null)
  const [countries, setCountries] = useState<string[]>([])
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading,   setLoading]   = useState(true)
  const [sending,   setSending]   = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')
  const [showCountryPicker, setShowCountryPicker] = useState(false)
  const [showPlatformPicker, setShowPlatformPicker] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/admin/broadcasts'),
      api.get('/admin/countries'),
    ]).then(([bRes, cRes]) => {
      setBroadcasts(bRes.data)
      setCountries(cRes.data)
    }).finally(() => setLoading(false))
  }, [])

  async function send() {
    if (!title.trim() || !body.trim()) return
    setSending(true)
    setError('')
    setSuccess('')
    try {
      await api.post('/admin/broadcast', {
        title: title.trim(),
        body:  body.trim(),
        data:  link.trim() ? { url: link.trim() } : undefined,
        target_platform: platform,
        target_country:  country,
      })
      setSuccess('Broadcast sent!')
      setTitle('')
      setBody('')
      setLink('')
      setPlatform(null)
      setCountry(null)
      const { data } = await api.get('/admin/broadcasts')
      setBroadcasts(data)
    } catch {
      setError('Failed to send broadcast.')
    } finally {
      setSending(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={palette.text} />
          </Pressable>
          <View>
            <Text style={styles.eyebrow}>Admin</Text>
            <Text style={styles.title}>Broadcast</Text>
          </View>
        </View>

        {/* Compose */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>New broadcast</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>TITLE</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Short headline…"
              placeholderTextColor={palette.textDim}
              maxLength={120}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>MESSAGE</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={body}
              onChangeText={setBody}
              placeholder="What do you want to tell users…"
              placeholderTextColor={palette.textDim}
              maxLength={500}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{body.length}/500</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>LINK (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              value={link}
              onChangeText={setLink}
              placeholder="https://…"
              placeholderTextColor={palette.textDim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          {/* Platform picker */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>PLATFORM</Text>
            <Pressable style={styles.picker} onPress={() => setShowPlatformPicker(v => !v)}>
              <Text style={styles.pickerText}>{PLATFORMS.find(p => p.value === platform)?.label ?? 'All platforms'}</Text>
              <Ionicons name={showPlatformPicker ? 'chevron-up' : 'chevron-down'} size={16} color={palette.textDim} />
            </Pressable>
            {showPlatformPicker && (
              <View style={styles.dropdown}>
                {PLATFORMS.map(p => (
                  <Pressable key={String(p.value)} style={styles.dropdownItem} onPress={() => { setPlatform(p.value); setShowPlatformPicker(false) }}>
                    <Text style={[styles.dropdownText, platform === p.value && styles.dropdownTextActive]}>
                      {p.label}
                    </Text>
                    {platform === p.value && <Ionicons name="checkmark" size={15} color={palette.accent} />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Country picker */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>COUNTRY</Text>
            <Pressable style={styles.picker} onPress={() => setShowCountryPicker(v => !v)}>
              <Text style={styles.pickerText}>{country ?? 'All countries'}</Text>
              <Ionicons name={showCountryPicker ? 'chevron-up' : 'chevron-down'} size={16} color={palette.textDim} />
            </Pressable>
            {showCountryPicker && (
              <View style={styles.dropdown}>
                <Pressable style={styles.dropdownItem} onPress={() => { setCountry(null); setShowCountryPicker(false) }}>
                  <Text style={[styles.dropdownText, country === null && styles.dropdownTextActive]}>All countries</Text>
                  {country === null && <Ionicons name="checkmark" size={15} color={palette.accent} />}
                </Pressable>
                {countries.map(c => (
                  <Pressable key={c} style={styles.dropdownItem} onPress={() => { setCountry(c); setShowCountryPicker(false) }}>
                    <Text style={[styles.dropdownText, country === c && styles.dropdownTextActive]}>{c}</Text>
                    {country === c && <Ionicons name="checkmark" size={15} color={palette.accent} />}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {error   ? <Text style={styles.errorText}>{error}</Text>   : null}
          {success ? <Text style={styles.successText}>{success}</Text> : null}

          <Pressable
            style={[styles.sendBtn, (sending || !title.trim() || !body.trim()) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={sending || !title.trim() || !body.trim()}
          >
            {sending
              ? <ActivityIndicator size="small" color="#041109" />
              : <>
                  <Ionicons name="send-outline" size={16} color="#041109" />
                  <Text style={styles.sendLabel}>Send broadcast</Text>
                </>
            }
          </Pressable>
        </View>

        {/* History */}
        <Text style={styles.historyLabel}>SENT BROADCASTS</Text>

        {loading && <ActivityIndicator color={palette.accent} style={{ marginTop: 16 }} />}

        {!loading && broadcasts.length === 0 && (
          <Text style={styles.emptyText}>No broadcasts yet.</Text>
        )}

        {broadcasts.map(b => (
          <View key={b.id} style={styles.broadcastCard}>
            <View style={styles.broadcastTop}>
              <Text style={styles.broadcastTitle}>{b.title}</Text>
              <Text style={styles.broadcastTime}>{timeAgo(b.created_at)}</Text>
            </View>
            <Text style={styles.broadcastBody}>{b.body}</Text>
            <View style={styles.broadcastTags}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{b.target_platform ?? 'all platforms'}</Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagText}>{b.target_country ?? 'all countries'}</Text>
              </View>
              <Text style={styles.broadcastBy}>by {b.sent_by}</Text>
            </View>
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: palette.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },

  header:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  backBtn: { padding: 4 },
  eyebrow: { color: palette.accent, fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  title:   { color: palette.text, fontSize: 20, fontWeight: '800' },

  card: {
    backgroundColor: palette.panel, borderRadius: 22,
    borderWidth: 1, borderColor: palette.line, padding: spacing.md, gap: spacing.sm,
  },
  sectionLabel: { color: palette.text, fontSize: 15, fontWeight: '800', marginBottom: 4 },

  field:      { gap: 6 },
  fieldLabel: { color: palette.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  input: {
    backgroundColor: palette.bg, borderRadius: 14,
    borderWidth: 1, borderColor: palette.line,
    paddingHorizontal: 14, paddingVertical: 12,
    color: palette.text, fontSize: 14,
  },
  inputMulti: { minHeight: 90, paddingTop: 12 },
  charCount:  { color: palette.textDim, fontSize: 11, textAlign: 'right' },

  picker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: palette.bg, borderRadius: 14,
    borderWidth: 1, borderColor: palette.line,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  pickerText: { color: palette.text, fontSize: 14 },

  dropdown: {
    backgroundColor: palette.panelRaised, borderRadius: 14,
    borderWidth: 1, borderColor: palette.line, overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: palette.line,
  },
  dropdownText:       { color: palette.text, fontSize: 14 },
  dropdownTextActive: { color: palette.accent, fontWeight: '700' },

  sendBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: palette.accent, borderRadius: 16,
    paddingVertical: 14, marginTop: 4,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendLabel: { color: '#041109', fontSize: 15, fontWeight: '800' },

  errorText:   { color: '#f87171', fontSize: 13 },
  successText: { color: palette.accent, fontSize: 13, fontWeight: '600' },

  historyLabel: { color: palette.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  emptyText:    { color: palette.textDim, fontSize: 14 },

  broadcastCard: {
    backgroundColor: palette.panel, borderRadius: 20,
    borderWidth: 1, borderColor: palette.line, padding: spacing.md, gap: 6,
  },
  broadcastTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  broadcastTitle: { color: palette.text, fontSize: 14, fontWeight: '700', flex: 1 },
  broadcastTime:  { color: palette.textDim, fontSize: 12, flexShrink: 0 },
  broadcastBody:  { color: palette.textMuted, fontSize: 13 },
  broadcastTags:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  tag: {
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(57,255,20,0.08)', borderWidth: 1, borderColor: 'rgba(57,255,20,0.2)',
  },
  tagText: { color: palette.accent, fontSize: 11, fontWeight: '700' },
  broadcastBy: { color: palette.textDim, fontSize: 12 },
})
