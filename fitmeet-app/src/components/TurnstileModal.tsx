import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { palette, spacing } from '@/src/theme'

const SITE_KEY = '0x4AAAAAAA272FNBOuqwbiqe'

const HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #050816;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  <div
    class="cf-turnstile"
    data-sitekey="${SITE_KEY}"
    data-callback="onSuccess"
    data-theme="dark"
    data-size="normal"
  ></div>
  <script>
    function onSuccess(token) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'token', token }));
    }
  </script>
</body>
</html>`

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
            <WebView
              source={{ html: HTML }}
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
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: palette.bg,
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
