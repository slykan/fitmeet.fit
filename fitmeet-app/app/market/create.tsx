import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { api } from '@/src/lib/api'
import { CATEGORIES } from '@/src/lib/categories'
import { useAuthStore } from '@/src/store/auth'
import { palette, spacing } from '@/src/theme'

const CONDITIONS = [
  { value: 'new',      label: 'New' },
  { value: 'like_new', label: 'Like new' },
  { value: 'used',     label: 'Used' },
]

const CURRENCIES = ['EUR', 'USD', 'HRK', 'GBP']

interface ImageAsset {
  uri: string
  name: string
  type: string
}

export default function MarketCreateScreen() {
  const { id: editId } = useLocalSearchParams<{ id?: string }>()
  const token = useAuthStore(s => s.token)

  const [type,      setType]     = useState<'sell' | 'buy'>('sell')
  const [title,     setTitle]    = useState('')
  const [desc,      setDesc]     = useState('')
  const [price,     setPrice]    = useState('')
  const [currency,  setCurrency] = useState('EUR')
  const [condition, setCond]     = useState('used')
  const [category,  setCategory] = useState('running')
  const [images,    setImages]   = useState<ImageAsset[]>([])
  const [saving,    setSaving]   = useState(false)
  const [error,     setError]    = useState<string | null>(null)
  const [loadingEdit, setLoadingEdit] = useState(!!editId)

  useEffect(() => {
    if (!token) { router.replace('/(tabs)/meet' as never); return }
    if (!editId) return
    api.get(`/market/${editId}`).then(({ data }) => {
      const l = data.data
      setType(l.type ?? 'sell')
      setTitle(l.title ?? '')
      setDesc(l.description ?? '')
      setPrice(l.price ? String(l.price) : '')
      setCurrency(l.currency ?? 'EUR')
      setCond(l.condition ?? 'used')
      setCategory(l.category?.value ?? 'running')
    }).catch(() => router.back()).finally(() => setLoadingEdit(false))
  }, [editId, token])

  async function pickImages() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
      selectionLimit: 5 - images.length,
    })
    if (result.canceled) return
    const next = [...images, ...result.assets.map(a => ({
      uri:  a.uri,
      name: a.fileName ?? `image_${Date.now()}.jpg`,
      type: a.mimeType ?? 'image/jpeg',
    }))].slice(0, 5)
    setImages(next)
  }

  function removeImage(idx: number) {
    setImages(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!title.trim()) { setError('Enter a title.'); return }
    if (type === 'sell' && (!price || isNaN(Number(price)) || Number(price) < 0)) {
      setError('Enter a valid price.'); return
    }
    setError(null)
    setSaving(true)

    try {
      const fd = new FormData()
      fd.append('type', type)
      fd.append('title', title.trim())
      fd.append('description', desc.trim())
      if (price) fd.append('price', price)
      fd.append('currency', currency)
      if (type === 'sell') fd.append('condition', condition)
      fd.append('category', category)
      images.forEach(img => {
        fd.append('images[]', { uri: img.uri, name: img.name, type: img.type } as never)
      })

      if (editId) {
        await api.post(`/market/${editId}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        router.replace(`/market/${editId}` as never)
      } else {
        const { data } = await api.post('/market', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        router.replace(`/market/${data.data.id}` as never)
      }
    } catch {
      setError('Could not save listing. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loadingEdit) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ActivityIndicator color={palette.accent} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={20} color={palette.accent} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.screenTitle}>{editId ? 'Edit listing' : 'New listing'}</Text>
        </View>

        {/* Sell / Buy toggle — only when creating */}
        {!editId && (
          <View style={styles.typeToggle}>
            {(['sell', 'buy'] as const).map(t => (
              <Pressable
                key={t}
                style={[styles.typeBtn, type === t && styles.typeBtnActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>
                  {t === 'sell' ? '🏷️  Selling' : '🔍  Looking for'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Images — sell only */}
        {type === 'sell' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Photos <Text style={{ fontWeight: '400', color: palette.textMuted }}>(max 5)</Text>
            </Text>
            <View style={styles.imageRow}>
              {images.map((img, i) => (
                <View key={i} style={styles.imageThumb}>
                  <Image source={{ uri: img.uri }} style={styles.imageThumbImg} resizeMode="cover" />
                  <Pressable style={styles.imageRemove} onPress={() => removeImage(i)} hitSlop={4}>
                    <Ionicons name="close" size={12} color="#fff" />
                  </Pressable>
                </View>
              ))}
              {images.length < 5 && (
                <Pressable style={styles.imagePicker} onPress={pickImages}>
                  <Ionicons name="add" size={26} color={palette.textMuted} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Details</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{type === 'buy' ? 'What are you looking for? *' : 'Title *'}</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={type === 'buy' ? 'e.g. Road bike size L, ~500 EUR' : 'e.g. Shimano road bike shoes size 43'}
              placeholderTextColor={palette.textDim}
              maxLength={200}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={desc}
              onChangeText={setDesc}
              placeholder={type === 'buy' ? 'Size, brand, budget range…' : 'Describe the item, usage, reason for selling…'}
              placeholderTextColor={palette.textDim}
              maxLength={2000}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Price + Currency */}
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>{type === 'buy' ? 'Max budget (optional)' : 'Price *'}</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                placeholder="0"
                placeholderTextColor={palette.textDim}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.field, { width: 100 }]}>
              <Text style={styles.fieldLabel}>Currency</Text>
              <View style={[styles.input, styles.currencyPicker]}>
                {CURRENCIES.map(c => (
                  <Pressable
                    key={c}
                    onPress={() => setCurrency(c)}
                    style={[styles.currencyOpt, currency === c && styles.currencyOptActive]}
                  >
                    <Text style={[styles.currencyOptText, currency === c && styles.currencyOptTextActive]}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* Condition — sell only */}
          {type === 'sell' && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Condition *</Text>
              <View style={styles.row}>
                {CONDITIONS.map(c => (
                  <Pressable
                    key={c.value}
                    style={[styles.chip, condition === c.value && styles.chipActive]}
                    onPress={() => setCond(c.value)}
                  >
                    <Text style={[styles.chipText, condition === c.value && styles.chipTextActive]}>{c.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Category */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Category *</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map(cat => (
                <Pressable
                  key={cat.value}
                  style={[styles.catChip, category === cat.value && styles.catChipActive]}
                  onPress={() => setCategory(cat.value)}
                >
                  <Text style={styles.catEmoji}>{cat.emoji}</Text>
                  <Text style={[styles.catLabel, category === cat.value && styles.catLabelActive]} numberOfLines={1}>
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>

        {/* Buttons */}
        <View style={styles.row}>
          <Pressable style={[styles.btnBase, styles.btnCancel]} onPress={() => router.back()}>
            <Text style={styles.btnCancelText}>Cancel</Text>
          </Pressable>
          <Pressable style={[styles.btnBase, styles.btnSave]} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#031109" size="small" />
            ) : (
              <Text style={styles.btnSaveText}>
                {editId ? 'Save changes' : type === 'buy' ? 'Post request' : 'Post listing'}
              </Text>
            )}
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.bg },
  content:  { padding: spacing.lg, gap: spacing.md, paddingBottom: 40 },

  header:      { gap: 8 },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText:    { color: palette.accent, fontWeight: '700', fontSize: 14 },
  screenTitle: { color: palette.text, fontSize: 24, fontWeight: '900' },

  typeToggle: { flexDirection: 'row', gap: 6, padding: 4, backgroundColor: palette.panel, borderRadius: 16, borderWidth: 1, borderColor: palette.line },
  typeBtn:     { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  typeBtnActive: { backgroundColor: palette.accent },
  typeBtnText:   { color: palette.textMuted, fontWeight: '800', fontSize: 14 },
  typeBtnTextActive: { color: '#031109' },

  section:      { backgroundColor: palette.panel, borderRadius: 20, borderWidth: 1, borderColor: palette.line, padding: spacing.md, gap: 14 },
  sectionLabel: { color: palette.text, fontWeight: '800', fontSize: 14 },

  imageRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  imageThumb: { width: 80, height: 80, borderRadius: 14, overflow: 'hidden', position: 'relative' },
  imageThumbImg: { width: 80, height: 80 },
  imageRemove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  imagePicker: { width: 80, height: 80, borderRadius: 14, borderWidth: 2, borderColor: palette.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },

  field:       { gap: 6 },
  fieldLabel:  { color: palette.textMuted, fontSize: 12, fontWeight: '700' },
  input: {
    backgroundColor: palette.panelRaised, borderRadius: 14, borderWidth: 1, borderColor: palette.line,
    paddingHorizontal: 14, paddingVertical: 12, color: palette.text, fontSize: 14,
  },
  textarea: { minHeight: 80, paddingTop: 12 },

  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },

  currencyPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 6, height: 'auto' },
  currencyOpt:     { flex: 1, paddingVertical: 5, borderRadius: 8, alignItems: 'center', backgroundColor: palette.panel },
  currencyOptActive: { backgroundColor: palette.accent },
  currencyOptText:   { color: palette.textMuted, fontSize: 11, fontWeight: '700' },
  currencyOptTextActive: { color: '#031109' },

  chip:        { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: palette.panelRaised, borderWidth: 1, borderColor: palette.line },
  chipActive:  { backgroundColor: 'rgba(108,255,47,0.12)', borderColor: 'rgba(108,255,47,0.45)' },
  chipText:    { color: palette.textMuted, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: palette.accent },

  catGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catChip:  { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panelRaised },
  catChipActive: { borderColor: 'rgba(108,255,47,0.45)', backgroundColor: 'rgba(108,255,47,0.1)' },
  catEmoji: { fontSize: 14 },
  catLabel: { color: palette.textMuted, fontSize: 12, fontWeight: '700', maxWidth: 70 },
  catLabelActive: { color: palette.accent },

  errorBox:  { borderRadius: 12, borderWidth: 1, borderColor: 'rgba(248,113,113,0.4)', backgroundColor: 'rgba(248,113,113,0.08)', padding: 12 },
  errorText: { color: '#f87171', fontSize: 13 },

  btnBase:    { flex: 1, paddingVertical: 15, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnCancel:  { borderWidth: 1, borderColor: palette.line, backgroundColor: palette.panel },
  btnSave:    { backgroundColor: palette.accent },
  btnCancelText: { color: palette.textMuted, fontWeight: '800', fontSize: 14 },
  btnSaveText:   { color: '#031109', fontWeight: '900', fontSize: 14 },
})
