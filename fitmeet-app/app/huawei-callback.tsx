import { router, useLocalSearchParams } from 'expo-router'
import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'

import { dispatchHuaweiCode } from '@/src/lib/huawei-bridge'
import { palette } from '@/src/theme'

export default function HuaweiCallbackScreen() {
  const { code } = useLocalSearchParams<{ code: string }>()

  useEffect(() => {
    if (!code) { router.replace('/'); return }

    const decoded = decodeURIComponent(code)
    const handled = dispatchHuaweiCode(decoded)
    if (handled) {
      router.back()
    } else {
      router.replace('/(tabs)/hub')
    }
  }, [code])

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={palette.accent} />
    </View>
  )
}
