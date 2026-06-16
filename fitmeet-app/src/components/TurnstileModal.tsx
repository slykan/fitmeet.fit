import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { palette, spacing } from '@/src/theme'

const TURNSTILE_URL = 'https://api.fitmeet.fit/api/turnstile'

export function TurnstileModal({
  visible,
  onToken,
  onDismiss,
}: {
  visible: boolean
  onToken: (token: string) => void
  onDismiss: () => void
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Security check</Text>
          <Text style={styles.subtitle}>Verify you're not a robot</Text>
          <View style={styles.webviewWrap}>
            {visible && (
              <WebView
                source={{ uri: TURNSTILE_URL }}
                style={styles.webview}
                javaScriptEnabled
                originWhitelist={['*']}
                onMessage={e => {
                  try {
                    const msg = JSON.parse(e.nativeEvent.data)
                    if (msg.type === 'token' && msg.token) {
                      onToken(msg.token)
                    }
                  } catch {}
                }}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
              />
            )}
          </View>
          <Pressable onPress={onDismiss} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: palette.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 360,
    gap: spacing.md,
  },
  title:    { color: palette.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: palette.textMuted, fontSize: 14, textAlign: 'center', marginTop: -8 },
  webviewWrap: {
    height: 116,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: palette.bg,
    borderWidth: 1,
    borderColor: palette.line,
  },
  webview: { flex: 1, backgroundColor: 'transparent' },
  cancelBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: palette.textMuted, fontSize: 14, fontWeight: '600' },
})
