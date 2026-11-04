import { Platform, StyleProp, TextInput, TextStyle } from 'react-native'

/**
 * Read-only text where a long press selects part of it (handles to adjust, then Copy).
 * <Text selectable> only offers "copy all" on iOS and is unreliable on Android with the
 * new architecture, so this is a TextInput that never opens the keyboard and drops any edit.
 */
export function SelectableText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  return (
    <TextInput
      value={text}
      onChangeText={() => {}}
      multiline
      scrollEnabled={false}
      showSoftInputOnFocus={false}
      caretHidden
      autoCorrect={false}
      spellCheck={false}
      underlineColorAndroid="transparent"
      style={[{ padding: 0, margin: 0, textAlignVertical: 'top' }, Platform.OS === 'ios' && { paddingTop: 0 }, style]}
    />
  )
}
