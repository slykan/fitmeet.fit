import { Ionicons } from '@expo/vector-icons'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { FoodLog, type Meal, type MealTemplate, type QuickDrink } from '@/src/components/FoodLog'
import { HealthGauge, type EnergyDay } from '@/src/components/HealthGauge'
import { HrZonesCard } from '@/src/components/HrZonesCard'
import { api } from '@/src/lib/api'
import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'

type Sex = 'male' | 'female' | 'na'
type Goal = 'lose' | 'maintain' | 'gain'

interface HealthPayload {
  complete: boolean
  missing: string[]
  profile: {
    sex: Sex | null
    birth_date: string | null
    age: number | null
    weight_kg: number | null
    height_cm: number | null
    body_fat_pct: number | null
    avg_daily_steps: number | null
    ftp_w: number | null
    goal: Goal | null
    target_weight_kg: number | null
  }
  bmr: { kcal: number; formula: 'katch_mcardle' | 'mifflin_st_jeor' } | null
  today: EnergyDay | null
  week: EnergyDay | null
  w_per_kg?: number | null
  date: string
  is_today: boolean
  meals: Meal[]
  recent: MealTemplate[]
  quick_drinks: QuickDrink[]
  estimates_left: number
}

const shiftDay = (iso: string, by: number) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + by)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const dayLabel = (iso: string, isToday: boolean) => {
  if (isToday) return 'Today'
  const d = new Date(iso + 'T12:00:00')
  const y = new Date(); y.setDate(y.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

const SEX: { value: Sex; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'na', label: 'Prefer not to say' },
]
const GOALS: { value: Goal; label: string }[] = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Gain weight' },
]
const str = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))
const num = (s: string) => {
  const n = parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Health: first visit (or "Edit health data") shows the form — fields we already have
 * (birth date from the profile) come prefilled; after saving, the energy gauge.
 * Used in the Feed "Health" tab and in Profile › Health settings (startEditing).
 */
export function HealthPanel({ startEditing = false, onSaved }: { startEditing?: boolean; onSaved?: () => void }) {
  const refreshMe = useAuthStore(s => s.refreshMe)
  const [data, setData] = useState<HealthPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(startEditing)
  const [saving, setSaving] = useState(false)

  const [sex, setSex] = useState<Sex | null>(null)
  const [day, setDay] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [fat, setFat] = useState('')
  const [steps, setSteps] = useState('')
  const [ftp, setFtp] = useState('')
  const [goal, setGoal] = useState<Goal | null>(null)
  const [target, setTarget] = useState('')

  const fill = (p: HealthPayload['profile']) => {
    setSex(p.sex)
    if (p.birth_date) {
      const [y, m, d] = p.birth_date.split('-')
      setYear(y); setMonth(String(parseInt(m, 10))); setDay(String(parseInt(d, 10)))
    }
    setWeight(str(p.weight_kg)); setHeight(str(p.height_cm)); setFat(str(p.body_fat_pct))
    setSteps(str(p.avg_daily_steps)); setFtp(str(p.ftp_w)); setGoal(p.goal); setTarget(str(p.target_weight_kg))
  }

  const [date, setDate] = useState<string | null>(null)
  const [dayLoading, setDayLoading] = useState(false)

  const load = useCallback((d: string | null) => {
    setError(null)
    setDayLoading(true)
    api.get<HealthPayload>('/health', { params: d ? { date: d } : {} })
      .then(({ data }) => { setData(data); fill(data.profile); if (!data.complete) setEditing(true) })
      .catch(() => setError('Could not load your health data.'))
      .finally(() => setDayLoading(false))
  }, [])
  useEffect(() => load(date), [load, date])

  async function save() {
    const d = parseInt(day, 10), m = parseInt(month, 10), y = parseInt(year, 10)
    if (!sex) return setError('Choose your sex — it is needed for the calorie formula.')
    if (!d || !m || !y || year.length !== 4) return setError('Enter your date of birth.')
    if (!num(weight) || !num(height)) return setError('Enter your weight and height.')
    setSaving(true)
    setError(null)
    try {
      const { data } = await api.put<HealthPayload>('/health', {
        sex,
        birth_date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        weight_kg: num(weight),
        height_cm: Math.round(num(height) ?? 0),
        body_fat_pct: num(fat),
        avg_daily_steps: steps.trim() ? Math.round(num(steps) ?? 0) : null,
        ftp_w: ftp.trim() ? Math.round(num(ftp) ?? 0) : null,
        goal,
        target_weight_kg: num(target),
      })
      setData(data)
      fill(data.profile)
      setEditing(false)
      refreshMe?.()
      onSaved?.()
    } catch (e: unknown) {
      const res = (e as { response?: { data?: { message?: string } } })?.response?.data
      setError(res?.message ?? 'Saving failed. Check the values and try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!data) {
    return <View style={styles.loading}>{error ? <Text style={styles.muted}>{error}</Text> : <ActivityIndicator color={palette.accent} />}</View>
  }

  if (!editing && data.complete && data.today && data.week) {
    return (
      <View style={{ gap: spacing.md }}>
        <View style={styles.dayNav}>
          <Pressable hitSlop={10} style={styles.dayBtn} onPress={() => setDate(shiftDay(data.date, -1))} disabled={dayLoading}>
            <Ionicons name="chevron-back" size={18} color={palette.text} />
          </Pressable>
          <Pressable style={{ flex: 1, alignItems: 'center' }} onPress={() => setDate(null)} disabled={data.is_today}>
            <Text style={styles.dayText}>{dayLabel(data.date, data.is_today)}</Text>
            {!data.is_today && <Text style={styles.dayHint}>tap for today</Text>}
          </Pressable>
          <Pressable hitSlop={10} style={[styles.dayBtn, data.is_today && { opacity: 0.3 }]} onPress={() => setDate(shiftDay(data.date, 1))} disabled={data.is_today || dayLoading}>
            <Ionicons name="chevron-forward" size={18} color={palette.text} />
          </Pressable>
        </View>
        <HealthGauge key={data.date} today={data.today} week={data.week} todayLabel={data.is_today ? 'Today' : 'Day'} avgSteps={data.profile.avg_daily_steps} />
        <FoodLog<HealthPayload>
          date={data.date}
          meals={data.meals}
          recent={data.recent}
          quickDrinks={data.quick_drinks}
          estimatesLeft={data.estimates_left}
          onChange={p => setData(p)}
        />
        <View style={styles.facts}>
          <Fact label="Weight" value={`${data.profile.weight_kg} kg`} />
          <Fact label="Height" value={`${data.profile.height_cm} cm`} />
          {data.profile.body_fat_pct ? <Fact label="Body fat" value={`${data.profile.body_fat_pct} %`} /> : null}
          {data.profile.ftp_w ? <Fact label="FTP" value={`${data.profile.ftp_w} W${data.w_per_kg ? ` · ${data.w_per_kg} W/kg` : ''}`} /> : null}
        </View>
        <Text style={styles.formula}>
          BMR {data.bmr?.kcal} kcal — {data.bmr?.formula === 'katch_mcardle' ? 'Katch-McArdle (uses body fat)' : 'Mifflin-St Jeor'}
          {data.profile.avg_daily_steps ? '' : ' · add your average steps for a better daily estimate'}
        </Text>
        <Pressable style={styles.editBtn} onPress={() => setEditing(true)}>
          <Ionicons name="create-outline" size={16} color={palette.accent} />
          <Text style={styles.editText}>Edit health data</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={{ gap: spacing.md }}>
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="heart" size={18} color="#ff3b30" />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Health data</Text>
          <Text style={styles.subtitle}>For your BMR, daily calories and a smarter AI coach. Only you can see it.</Text>
        </View>
      </View>

      <Text style={styles.label}>Sex <Text style={styles.req}>*</Text> <Text style={styles.hint}>(for the calorie formula)</Text></Text>
      <View style={styles.toggle}>
        {SEX.map(o => (
          <Pressable key={o.value} style={[styles.toggleItem, sex === o.value && styles.toggleOn]} onPress={() => setSex(o.value)}>
            <Text style={[styles.toggleText, sex === o.value && styles.toggleTextOn]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Date of birth <Text style={styles.req}>*</Text></Text>
      <View style={styles.row}>
        <TextInput style={[styles.input, { width: 56 }]} value={day} onChangeText={setDay} placeholder="DD" placeholderTextColor={palette.textDim} keyboardType="number-pad" maxLength={2} />
        <TextInput style={[styles.input, { width: 56 }]} value={month} onChangeText={setMonth} placeholder="MM" placeholderTextColor={palette.textDim} keyboardType="number-pad" maxLength={2} />
        <TextInput style={[styles.input, { width: 80 }]} value={year} onChangeText={setYear} placeholder="YYYY" placeholderTextColor={palette.textDim} keyboardType="number-pad" maxLength={4} />
      </View>

      <Field label="Weight" unit="kg" value={weight} onChange={setWeight} required decimal />
      <Field label="Height" unit="cm" value={height} onChange={setHeight} required />
      <Field label="Body fat" unit="%" value={fat} onChange={setFat} decimal hint="optional — from a smart scale, roughly is fine" />
      <Field label="Average daily steps" unit="" value={steps} onChange={setSteps} hint="optional — roughly, from your phone or watch" />
      <Field label="FTP" unit="W" value={ftp} onChange={setFtp} hint="optional — cycling" />

      <Text style={styles.label}>Goal <Text style={styles.hint}>(optional)</Text></Text>
      <View style={styles.toggle}>
        {GOALS.map(o => (
          <Pressable key={o.value} style={[styles.toggleItem, goal === o.value && styles.toggleOn]} onPress={() => setGoal(goal === o.value ? null : o.value)}>
            <Text style={[styles.toggleText, goal === o.value && styles.toggleTextOn]} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
      {goal && goal !== 'maintain' && <Field label="Target weight" unit="kg" value={target} onChange={setTarget} decimal />}

      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.actions}>
        {data.complete && (
          <Pressable style={styles.cancelBtn} onPress={() => { fill(data.profile); setEditing(false); setError(null) }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        )}
        <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color="#041109" /> : <Text style={styles.saveText}>Save</Text>}
        </Pressable>
      </View>
    </View>
    <HrZonesCard />
    </View>
  )
}

function Field({ label, unit, value, onChange, required, decimal, hint }: {
  label: string; unit: string; value: string; onChange: (s: string) => void; required?: boolean; decimal?: boolean; hint?: string
}) {
  return (
    <View style={styles.fieldRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}{required ? <Text style={styles.req}> *</Text> : null}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType={decimal ? 'decimal-pad' : 'number-pad'} placeholderTextColor={palette.textDim} />
      <Text style={styles.unit}>{unit}</Text>
    </View>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: 'center' },
  dayNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.panel, borderWidth: 1, borderColor: palette.line },
  dayText: { color: palette.text, fontSize: 15, fontWeight: '800' },
  dayHint: { color: palette.textDim, fontSize: 10 },
  muted: { color: palette.textMuted, fontSize: 13 },
  card: { backgroundColor: palette.panel, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,59,48,0.25)', padding: spacing.md, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: palette.text, fontSize: 16, fontWeight: '800' },
  subtitle: { color: palette.textDim, fontSize: 11, marginTop: 1 },
  label: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  req: { color: '#ff3b30' },
  hint: { color: palette.textDim, fontSize: 11, fontWeight: '400' },
  toggle: { flexDirection: 'row', padding: 3, borderRadius: 12, backgroundColor: palette.panelRaised },
  toggleItem: { flex: 1, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  toggleOn: { backgroundColor: palette.accent },
  toggleText: { color: palette.textMuted, fontSize: 12, fontWeight: '800' },
  toggleTextOn: { color: '#041109' },
  row: { flexDirection: 'row', gap: 8 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fieldLabel: { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  input: { width: 84, height: 40, borderRadius: 10, borderWidth: 1, borderColor: palette.line, color: palette.text, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  unit: { color: palette.textDim, fontSize: 12, width: 22 },
  error: { color: '#ff6b6b', fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { height: 42, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: palette.textMuted, fontSize: 14, fontWeight: '700' },
  saveBtn: { height: 42, minWidth: 110, paddingHorizontal: 18, borderRadius: 12, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#041109', fontSize: 14, fontWeight: '800' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fact: { backgroundColor: palette.panel, borderRadius: 12, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 12, paddingVertical: 8 },
  factLabel: { color: palette.textDim, fontSize: 10 },
  factValue: { color: palette.text, fontSize: 13, fontWeight: '800' },
  formula: { color: palette.textDim, fontSize: 11 },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(108,255,47,0.35)', backgroundColor: 'rgba(108,255,47,0.06)' },
  editText: { color: palette.accent, fontSize: 14, fontWeight: '800' },
})
