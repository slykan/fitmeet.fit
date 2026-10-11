import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { api } from '@/src/lib/api'
import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'

const ZONES = [
  { name: 'Z1', label: 'Recovery', color: '#8f9bbd' },
  { name: 'Z2', label: 'Endurance', color: '#3399ff' },
  { name: 'Z3', label: 'Tempo', color: '#6cff2f' },
  { name: 'Z4', label: 'Threshold', color: '#ffaa00' },
  { name: 'Z5', label: 'Max', color: '#ff3b30' },
]
const SHARES = [0.5, 0.6, 0.7, 0.8, 0.9]
const fromMax = (max: number) => SHARES.map(s => Math.round(max * s))

const SOURCE_TEXT: Record<string, string> = {
  manual: 'Your own zones',
  max: 'From your max HR',
  age: 'Estimated from age (220 − age) — set your max HR for accurate zones',
  observed: 'Estimated from your highest recorded HR — set your max HR',
}

/** Personal heart-rate zones on the own profile — used by the charts, reports and AI coach. */
export function HrZonesCard() {
  const zones = useAuthStore(s => s.user?.hr_zones)
  const refreshMe = useAuthStore(s => s.refreshMe)
  const [editing, setEditing] = useState(false)
  const [mode, setMode] = useState<'max' | 'manual'>('max')
  const [max, setMax] = useState('')
  const [bounds, setBounds] = useState<string[]>(['', '', '', '', ''])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setMode(zones?.source === 'manual' ? 'manual' : 'max')
    setMax(zones?.max ? String(zones.max) : '')
    setBounds((zones?.bounds ?? []).map(String).concat(['', '', '', '', '']).slice(0, 5))
  }, [zones, editing])

  const shown = zones?.bounds ?? null
  const previewBounds = mode === 'max' && Number(max) >= 120 ? fromMax(Number(max)) : bounds.map(Number)

  async function save(payload: Record<string, unknown>) {
    setSaving(true)
    try {
      await api.patch('/me', payload)
      await refreshMe()
      setEditing(false)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      Alert.alert('Could not save', msg ?? 'Please check the values and try again.')
    } finally {
      setSaving(false)
    }
  }

  function onSave() {
    if (mode === 'max') {
      const m = Number(max)
      if (!m || m < 120 || m > 230) return Alert.alert('Max HR', 'Enter a max heart rate between 120 and 230 bpm.')
      save({ hr_max: m, hr_zones: null })
    } else {
      const b = bounds.map(Number)
      if (b.some(v => !v) || b.some((v, i) => i > 0 && v <= b[i - 1])) {
        return Alert.alert('Zones', 'Enter all five zones, each starting higher than the one before.')
      }
      save({ hr_zones: b, hr_max: max ? Number(max) : null })
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="heart-circle" size={22} color="#ff3b30" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Heart rate zones</Text>
          <Text style={styles.subtitle}>{zones?.source ? SOURCE_TEXT[zones.source] : 'Set your max HR to get your zones'}</Text>
        </View>
        {!editing && (
          <Pressable style={styles.editBtn} onPress={() => setEditing(true)} hitSlop={8}>
            <Ionicons name="create-outline" size={15} color={palette.accent} />
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        )}
      </View>

      {!editing && shown && (
        <View style={styles.zones}>
          {ZONES.map((z, i) => (
            <View key={z.name} style={styles.zoneRow}>
              <View style={[styles.zoneDot, { backgroundColor: z.color }]} />
              <Text style={styles.zoneName}>{z.name} {z.label}</Text>
              <Text style={styles.zoneRange}>
                {shown[i]}{i < 4 ? `–${shown[i + 1] - 1}` : '+'} bpm
              </Text>
            </View>
          ))}
        </View>
      )}

      {editing && (
        <View style={{ gap: 12 }}>
          <View style={styles.toggle}>
            {(['max', 'manual'] as const).map(m => (
              <Pressable key={m} style={[styles.toggleItem, mode === m && styles.toggleOn]} onPress={() => setMode(m)}>
                <Text style={[styles.toggleText, mode === m && styles.toggleTextOn]}>{m === 'max' ? 'From max HR' : 'Manual zones'}</Text>
              </Pressable>
            ))}
          </View>

          {mode === 'max' ? (
            <>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Max HR</Text>
                <TextInput style={styles.input} value={max} onChangeText={setMax} keyboardType="number-pad" maxLength={3} placeholder="e.g. 185" placeholderTextColor={palette.textDim} />
                <Text style={styles.unit}>bpm</Text>
              </View>
              {zones?.highest_recorded ? (
                <Pressable onPress={() => setMax(String(zones.highest_recorded))}>
                  <Text style={styles.suggest}>Highest HR in your trainings: <Text style={{ fontWeight: '800' }}>{zones.highest_recorded} bpm</Text> — tap to use</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            ZONES.map((z, i) => (
              <View key={z.name} style={styles.inputRow}>
                <View style={[styles.zoneDot, { backgroundColor: z.color }]} />
                <Text style={styles.inputLabel}>{z.name} from</Text>
                <TextInput
                  style={styles.input}
                  value={bounds[i]}
                  onChangeText={v => setBounds(prev => prev.map((p, k) => (k === i ? v : p)))}
                  keyboardType="number-pad"
                  maxLength={3}
                  placeholderTextColor={palette.textDim}
                />
                <Text style={styles.unit}>bpm</Text>
              </View>
            ))
          )}

          {previewBounds.every(v => v > 0) && (
            <Text style={styles.preview}>
              {ZONES.map((z, i) => `${z.name} ${previewBounds[i]}`).join(' · ')}
            </Text>
          )}

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={() => setEditing(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={onSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#041109" /> : <Text style={styles.saveText}>Save</Text>}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.panel, borderRadius: 22, borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.25)', padding: spacing.md, gap: spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: palette.text, fontSize: 16, fontWeight: '800' },
  subtitle: { color: palette.textDim, fontSize: 11, marginTop: 1 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: 'rgba(108,255,47,0.08)' },
  editText: { color: palette.accent, fontSize: 12, fontWeight: '800' },
  zones: { gap: 8 },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoneDot: { width: 10, height: 10, borderRadius: 5 },
  zoneName: { flex: 1, color: palette.textMuted, fontSize: 13 },
  zoneRange: { color: palette.text, fontSize: 13, fontWeight: '800' },
  toggle: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: palette.panelRaised },
  toggleItem: { flex: 1, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  toggleOn: { backgroundColor: palette.accent },
  toggleText: { color: palette.textMuted, fontSize: 12, fontWeight: '800' },
  toggleTextOn: { color: '#041109' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputLabel: { flex: 1, color: palette.textMuted, fontSize: 13 },
  input: { width: 80, height: 40, borderRadius: 10, borderWidth: 1, borderColor: palette.line, color: palette.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  unit: { color: palette.textDim, fontSize: 12, width: 28 },
  suggest: { color: palette.accent, fontSize: 12 },
  preview: { color: palette.textDim, fontSize: 11 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { height: 40, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: palette.textMuted, fontSize: 14, fontWeight: '700' },
  saveBtn: { height: 40, minWidth: 90, paddingHorizontal: 18, borderRadius: 12, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#041109', fontSize: 14, fontWeight: '800' },
})
