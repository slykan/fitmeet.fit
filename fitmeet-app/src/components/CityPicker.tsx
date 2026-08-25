import { Ionicons } from '@expo/vector-icons'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { palette, spacing } from '@/src/theme'

interface Props {
  visible: boolean
  countryCode: string | null
  onClose: () => void
  onSelect: (city: string) => void
}

interface CityResult {
  key: string
  name: string
  region: string | null
}

function cityNameFromAddress(address: Record<string, string> | undefined, fallback: string): string {
  return address?.city ?? address?.town ?? address?.village ?? address?.municipality ?? address?.county ?? fallback
}

export function CityPicker({ visible, countryCode, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CityResult[]>([])
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    if (!visible) return
    const q = query.trim()
    if (q.length < 2 || !countryCode) {
      setResults([])
      return
    }
    const id = ++requestId.current
    setLoading(true)
    const timer = setTimeout(() => {
      fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=${countryCode.toLowerCase()}&format=json&addressdetails=1&limit=8`,
        { headers: { 'Accept-Language': 'en', 'User-Agent': 'FitMeetApp/1.0' } }
      )
        .then(res => res.json())
        .then((data: { place_id: number; display_name: string; address?: Record<string, string> }[]) => {
          if (id !== requestId.current) return
          const seen = new Set<string>()
          const cities: CityResult[] = []
          for (const r of data) {
            const name = cityNameFromAddress(r.address, r.display_name.split(',')[0].trim())
            if (seen.has(name)) continue
            seen.add(name)
            cities.push({ key: String(r.place_id), name, region: r.address?.state ?? null })
          }
          setResults(cities)
        })
        .catch(() => { if (id === requestId.current) setResults([]) })
        .finally(() => { if (id === requestId.current) setLoading(false) })
    }, 350)
    return () => clearTimeout(timer)
  }, [query, countryCode, visible])

  function handleClose() {
    setQuery('')
    setResults([])
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>

          <View style={styles.header}>
            <Text style={styles.title}>Select city</Text>
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
              placeholder={countryCode ? 'Search cities...' : 'Pick a country first'}
              placeholderTextColor={palette.textDim}
              autoFocus
              autoCorrect={false}
              editable={!!countryCode}
            />
            {loading && <ActivityIndicator size="small" color={palette.accent} />}
          </View>

          <FlatList
            data={results}
            keyExtractor={(item) => item.key}
            style={{ maxHeight: 360 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {!countryCode ? 'Select a country first.' : query.trim().length < 2 ? 'Type at least 2 letters.' : loading ? '' : 'No cities found.'}
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.row}
                onPress={() => { onSelect(item.name); handleClose() }}
              >
                <View>
                  <Text style={styles.rowText}>{item.name}</Text>
                  {item.region && <Text style={styles.rowSub}>{item.region}</Text>}
                </View>
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

  row: { paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: palette.line },
  rowText: { color: palette.text, fontSize: 15 },
  rowSub: { color: palette.textDim, fontSize: 12, marginTop: 2 },
  emptyText: { color: palette.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 20 },
})
