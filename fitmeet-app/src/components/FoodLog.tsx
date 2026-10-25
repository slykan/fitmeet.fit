import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import { api } from '@/src/lib/api'
import { palette, spacing } from '@/src/theme'

export interface MealItem { name: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }
export interface Meal {
  id: number; kind: 'meal' | 'drink'; description: string; items: MealItem[]; kcal: number
  protein_g: number; carbs_g: number; fat_g: number; volume_ml: number | null; source: string; time: string
}
export type MealTemplate = Omit<Meal, 'id' | 'source' | 'time'>
export interface QuickDrink { key: string; label: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; volume_ml: number }
interface Estimate { items: MealItem[]; kind: 'meal' | 'drink'; volume_ml: number; note: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; estimates_left: number }

const phoneLanguage = () => Intl.DateTimeFormat().resolvedOptions().locale?.split('-')[0] ?? 'en'
const macros = (p: number, c: number, f: number) => `P ${Math.round(p)} g · C ${Math.round(c)} g · F ${Math.round(f)} g`
const errMsg = (e: unknown, fallback: string) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback

/**
 * Health › Food for one day: the day's meals and drinks, "+ Meal" (text → AI estimate →
 * check → save), quick drink buttons and "repeat" of recent meals (no AI, free).
 * Every change returns the whole Health payload, passed up via onChange.
 */
export function FoodLog<T>({ date, meals, recent, quickDrinks, estimatesLeft, onChange }: {
  date: string; meals: Meal[]; recent: MealTemplate[]; quickDrinks: QuickDrink[]; estimatesLeft: number; onChange: (payload: T) => void
}) {
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [kcal, setKcal] = useState('')
  const [busy, setBusy] = useState<'estimate' | 'save' | string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const eaten = meals.reduce((s, m) => s + m.kcal, 0)
  const fluids = meals.reduce((s, m) => s + (m.volume_ml ?? 0), 0)

  const reset = () => { setAdding(false); setText(''); setEstimate(null); setKcal(''); setError(null) }

  async function post(body: Record<string, unknown>, key: string) {
    setBusy(key)
    setError(null)
    try {
      const { data } = await api.post<T>('/meals', { date, ...body })
      onChange(data)
      return true
    } catch (e) {
      setError(errMsg(e, 'Could not save. Try again.'))
      return false
    } finally {
      setBusy(null)
    }
  }

  async function runEstimate() {
    if (text.trim().length < 2) return
    setBusy('estimate')
    setError(null)
    try {
      const { data } = await api.post<Estimate>('/meals/estimate', { description: text.trim(), language: phoneLanguage() })
      if (!data.items.length) { setError('That doesn\'t look like food or a drink — try describing it differently.'); return }
      setEstimate(data)
      setKcal(String(data.kcal))
    } catch (e) {
      setError(errMsg(e, 'Could not estimate right now. You can enter the calories by hand.'))
    } finally {
      setBusy(null)
    }
  }

  async function saveMeal() {
    const total = parseInt(kcal, 10)
    if (!text.trim() || !Number.isFinite(total)) return setError('Describe the meal and enter calories.')
    const ok = await post({
      description: text.trim(),
      kind: estimate?.kind ?? 'meal',
      source: estimate ? 'ai' : 'manual',
      kcal: total,
      // if the user changed the total, scale the macros along with it
      ...(estimate ? scaled(estimate, total) : { protein_g: 0, carbs_g: 0, fat_g: 0 }),
      volume_ml: estimate?.volume_ml || null,
      items: estimate?.items ?? null,
    }, 'save')
    if (ok) reset()
  }

  function remove(m: Meal) {
    Alert.alert('Remove?', m.description, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        setBusy(`del${m.id}`)
        try { const { data } = await api.delete<T>(`/meals/${m.id}`); onChange(data) } catch {}
        finally { setBusy(null) }
      } },
    ])
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="restaurant" size={17} color="#ff9f43" />
        <Text style={styles.title}>Food</Text>
        <View style={{ flex: 1 }} />
        {eaten > 0 && <Text style={styles.headTotal}>{eaten} kcal</Text>}
      </View>

      {meals.length > 0 && (
        <View style={styles.list}>
          {meals.map(m => (
            <View key={m.id} style={styles.meal}>
              <Text style={styles.time}>{m.time}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.mealText} numberOfLines={2}>{m.description}</Text>
                {m.kcal > 0 && <Text style={styles.mealMacros}>{macros(m.protein_g, m.carbs_g, m.fat_g)}</Text>}
              </View>
              <Text style={styles.mealKcal}>{m.kcal}</Text>
              <Pressable hitSlop={8} onPress={() => remove(m)} disabled={busy === `del${m.id}`}>
                <Ionicons name="close" size={16} color={palette.textDim} />
              </Pressable>
            </View>
          ))}
          <Text style={styles.dayMacros}>
            {macros(meals.reduce((s, m) => s + m.protein_g, 0), meals.reduce((s, m) => s + m.carbs_g, 0), meals.reduce((s, m) => s + m.fat_g, 0))}
            {fluids > 0 ? `  ·  fluids ${(fluids / 1000).toFixed(1)} l` : ''}
          </Text>
        </View>
      )}

      <Pressable style={styles.addBtn} onPress={() => setAdding(true)}>
        <Ionicons name="add" size={18} color="#041109" />
        <Text style={styles.addText}>Add meal</Text>
      </Pressable>

      {/* Bottom sheet that rises with the keyboard, so the text field is always visible */}
      <Modal visible={adding} transparent animationType="slide" onRequestClose={reset}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.overlay} onPress={reset}>
            <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHead}>
                <Ionicons name="restaurant" size={18} color="#ff9f43" />
                <Text style={styles.sheetTitle}>Add a meal or drink</Text>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.addBox}>
          <TextInput
            style={styles.textArea}
            value={text}
            onChangeText={t => { setText(t); if (estimate) { setEstimate(null); setKcal('') } }}
            placeholder="What did you eat or drink? e.g. 2 eggs, toast with butter, coffee with milk"
            placeholderTextColor={palette.textDim}
            multiline
            maxLength={500}
            autoFocus
          />
          {estimate && (
            <View style={styles.estimate}>
              {estimate.items.map((it, i) => (
                <View key={i} style={styles.estRow}>
                  <Text style={styles.estName} numberOfLines={2}>{it.name}</Text>
                  <Text style={styles.estKcal}>{it.kcal}</Text>
                </View>
              ))}
              <Text style={styles.mealMacros}>{macros(estimate.protein_g, estimate.carbs_g, estimate.fat_g)}</Text>
              {estimate.note ? <Text style={styles.note}>{estimate.note}</Text> : null}
            </View>
          )}
          {(estimate || kcal !== '') && (
            <View style={styles.kcalRow}>
              <Text style={styles.kcalLabel}>Total</Text>
              <TextInput style={styles.kcalInput} value={kcal} onChangeText={setKcal} keyboardType="number-pad" />
              <Text style={styles.kcalLabel}>kcal</Text>
            </View>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={reset}><Text style={styles.cancelText}>Cancel</Text></Pressable>
            {!estimate && kcal === '' && (
              <Pressable style={styles.linkBtn} onPress={() => setKcal('0')}><Text style={styles.linkText}>Enter kcal</Text></Pressable>
            )}
            {!estimate && kcal === '' ? (
              <Pressable style={[styles.saveBtn, (busy || text.trim().length < 2 || estimatesLeft <= 0) && styles.disabled]} onPress={runEstimate} disabled={!!busy || text.trim().length < 2 || estimatesLeft <= 0}>
                {busy === 'estimate' ? <ActivityIndicator color="#041109" /> : <Text style={styles.saveText}>Estimate</Text>}
              </Pressable>
            ) : (
              <Pressable style={[styles.saveBtn, busy && styles.disabled]} onPress={saveMeal} disabled={!!busy}>
                {busy === 'save' ? <ActivityIndicator color="#041109" /> : <Text style={styles.saveText}>Save</Text>}
              </Pressable>
            )}
          </View>
          <Text style={styles.note}>{estimatesLeft} AI estimates left this month · repeat and quick drinks are free</Text>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <Text style={styles.section}>Quick drinks</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {quickDrinks.map(q => (
          <Pressable key={q.key} style={[styles.chip, busy === q.key && styles.disabled]} disabled={!!busy}
            onPress={() => post({ description: q.label, kind: 'drink', source: 'quick', kcal: q.kcal, protein_g: q.protein_g, carbs_g: q.carbs_g, fat_g: q.fat_g, volume_ml: q.volume_ml }, q.key)}>
            <Text style={styles.chipText}>{q.label}</Text>
            <Text style={styles.chipKcal}>{q.kcal}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {recent.length > 0 && (
        <>
          <Text style={styles.section}>Repeat</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {recent.map((r, i) => (
              <Pressable key={i} style={[styles.chip, styles.chipWide, busy === `r${i}` && styles.disabled]} disabled={!!busy}
                onPress={() => post({ ...r, source: 'repeat' }, `r${i}`)}>
                <Ionicons name="refresh" size={13} color={palette.accent} />
                <Text style={styles.chipText} numberOfLines={1}>{r.description}</Text>
                <Text style={styles.chipKcal}>{r.kcal}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  )
}

function scaled(e: Estimate, total: number) {
  const k = e.kcal > 0 ? total / e.kcal : 1
  return { protein_g: Math.round(e.protein_g * k * 10) / 10, carbs_g: Math.round(e.carbs_g * k * 10) / 10, fat_g: Math.round(e.fat_g * k * 10) / 10 }
}

const styles = StyleSheet.create({
  card: { backgroundColor: palette.panel, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,159,67,0.3)', padding: spacing.md, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: palette.text, fontSize: 16, fontWeight: '800' },
  headTotal: { color: '#ff9f43', fontSize: 14, fontWeight: '800' },
  list: { gap: 2 },
  meal: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.line },
  time: { color: palette.textDim, fontSize: 11, width: 36 },
  mealText: { color: palette.text, fontSize: 13 },
  mealMacros: { color: palette.textDim, fontSize: 10, marginTop: 1 },
  mealKcal: { color: palette.text, fontSize: 13, fontWeight: '800' },
  dayMacros: { color: palette.textMuted, fontSize: 11, marginTop: 6 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 42, borderRadius: 12, backgroundColor: palette.accent },
  addText: { color: '#041109', fontSize: 14, fontWeight: '800' },
  addBox: { gap: 12, paddingBottom: 8 },
  // highlighted: green frame, bigger text, so it's obvious where to type
  textArea: { minHeight: 96, borderRadius: 14, borderWidth: 2, borderColor: palette.accent, backgroundColor: 'rgba(108,255,47,0.05)', color: palette.text, fontSize: 16, padding: 12, textAlignVertical: 'top' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { backgroundColor: palette.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: palette.line, padding: spacing.md, paddingBottom: spacing.lg, maxHeight: '85%', gap: 10 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: palette.line },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetTitle: { color: palette.text, fontSize: 17, fontWeight: '800' },
  estimate: { backgroundColor: palette.panelRaised, borderRadius: 12, padding: 10, gap: 4 },
  estRow: { flexDirection: 'row', gap: 8 },
  estName: { flex: 1, color: palette.textMuted, fontSize: 12 },
  estKcal: { color: palette.text, fontSize: 12, fontWeight: '800' },
  kcalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end' },
  kcalLabel: { color: palette.textMuted, fontSize: 13 },
  kcalInput: { width: 90, height: 40, borderRadius: 10, borderWidth: 1, borderColor: palette.line, color: palette.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  error: { color: '#ff6b6b', fontSize: 12 },
  note: { color: palette.textDim, fontSize: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 },
  cancelBtn: { height: 40, paddingHorizontal: 12, justifyContent: 'center' },
  cancelText: { color: palette.textMuted, fontSize: 14, fontWeight: '700' },
  linkBtn: { height: 40, paddingHorizontal: 8, justifyContent: 'center' },
  linkText: { color: palette.accent, fontSize: 13, fontWeight: '700' },
  saveBtn: { height: 40, minWidth: 100, paddingHorizontal: 16, borderRadius: 12, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#041109', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  section: { color: palette.textDim, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: palette.panelRaised, borderWidth: 1, borderColor: palette.line },
  chipWide: { maxWidth: 240 },
  chipText: { color: palette.text, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  chipKcal: { color: '#ff9f43', fontSize: 11, fontWeight: '800' },
})
