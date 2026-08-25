import { Ionicons } from '@expo/vector-icons'
import { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { COUNTRIES } from '@/src/lib/countries'
import { palette, spacing } from '@/src/theme'

interface Props {
  visible: boolean
  value: string
  onClose: () => void
  onSelect: (country: string) => void
}

export function CountryPicker({ visible, value, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter(c => c.toLowerCase().includes(q))
  }, [query])

  function handleClose() {
    setQuery('')
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>

          <View style={styles.header}>
            <Text style={styles.title}>Select country</Text>
            <Pressable onPress={handleClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={palette.textMuted} />
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={palette.textDim} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search countries..."
              placeholderTextColor={palette.textDim}
              autoFocus
              autoCorrect={false}
            />
          </View>

          <FlatList
            data={results}
            keyExtractor={(item) => item}
            style={{ maxHeight: 360 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.emptyText}>No countries found.</Text>}
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => { onSelect(item); handleClose() }}
              >
                <Text style={[styles.rowText, item === value && styles.rowTextActive]}>{item}</Text>
                {item === value && <Ionicons name="checkmark" size={18} color={palette.accent} />}
              </Pressable>
            )}
          />

        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  card: { backgroundColor: palette.panel, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: palette.line, padding: spacing.lg, gap: 14, maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: palette.text, fontSize: 18, fontWeight: '800' },

  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.bg, borderRadius: 12, borderWidth: 1, borderColor: palette.line, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, color: palette.text, fontSize: 15 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: palette.line },
  rowText: { color: palette.text, fontSize: 15 },
  rowTextActive: { color: palette.accent, fontWeight: '700' },
  emptyText: { color: palette.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 20 },
})
