import { Ionicons } from '@expo/vector-icons'
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'

import { palette, spacing } from '@/src/theme'

export interface PickerOption {
  value: string
  label: string
}

interface Props {
  visible: boolean
  title: string
  options: PickerOption[]
  value: string
  onClose: () => void
  onSelect: (value: string) => void
}

export function OptionPicker({ visible, title, options, value, onClose, onSelect }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.overlay} onPress={onClose}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>

            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={20} color={palette.textMuted} />
              </Pressable>
            </View>

            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              style={{ maxHeight: 360 }}
              initialScrollIndex={Math.max(0, options.findIndex(o => o.value === value))}
              getItemLayout={(_, index) => ({ length: 46, offset: 46 * index, index })}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.row}
                  onPress={() => { onSelect(item.value); onClose() }}
                >
                  <Text style={[styles.rowText, item.value === value && styles.rowTextActive]}>{item.label}</Text>
                  {item.value === value && <Ionicons name="checkmark" size={18} color={palette.accent} />}
                </Pressable>
              )}
            />

          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  card: { backgroundColor: palette.panel, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: palette.line, padding: spacing.lg, gap: 14, maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: palette.text, fontSize: 18, fontWeight: '800' },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, height: 46, borderBottomWidth: 1, borderBottomColor: palette.line },
  rowText: { color: palette.text, fontSize: 15 },
  rowTextActive: { color: palette.accent, fontWeight: '700' },
})
