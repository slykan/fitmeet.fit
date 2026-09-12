import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Pressable, Share, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { MomentsGrid } from '@/src/components/MomentsGrid'
import { palette, spacing } from '@/src/theme'

export default function MomentsScreen() {
  function handleShare() {
    Share.share({
      message: 'Check out FitMeet Moments — real people, real events 📸 https://fitmeet.fit/moments',
    })
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={palette.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Moments</Text>
          <Text style={styles.headerSub}>Real events, real people</Text>
          <Text style={styles.headerNote}>Organizers can add one photo after each event ends.</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Pressable onPress={() => router.push('/moments-slideshow' as never)} hitSlop={12}>
            <Ionicons name="play-circle-outline" size={26} color={palette.accent} />
          </Pressable>
          <Pressable onPress={handleShare} hitSlop={12}>
            <Ionicons name="share-social-outline" size={22} color={palette.accent} />
          </Pressable>
        </View>
      </View>

      <MomentsGrid />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerCenter: { alignItems: 'center', gap: 1 },
  headerTitle: { color: palette.text, fontSize: 17, fontWeight: '800' },
  headerSub:   { color: palette.textDim, fontSize: 11 },
  headerNote:  { color: palette.textDim, fontSize: 10, opacity: 0.6, textAlign: 'center', marginTop: 1 },
})
