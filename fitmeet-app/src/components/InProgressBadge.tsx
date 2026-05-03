import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'

export function InProgressBadge() {
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    ).start()
  }, [pulse])

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.dot, { opacity: pulse }]} />
      <Text style={styles.label}>Live</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,60,60,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,80,80,0.35)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#ff4444',
  },
  label: {
    color: '#ff6666',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
})
