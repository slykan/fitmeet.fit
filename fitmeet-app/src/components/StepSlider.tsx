import { useRef, useState } from 'react'
import { PanResponder, StyleSheet, View } from 'react-native'
import type { LayoutChangeEvent } from 'react-native'

type Props = {
  min: number
  max: number
  value: number
  onChange: (value: number) => void
  activeColor: string
}

export function StepSlider({ min, max, value, onChange, activeColor }: Props) {
  const [trackWidth, setTrackWidth] = useState(0)
  const trackRef = useRef<View>(null)
  const trackPageX = useRef(0)
  const steps = Math.max(1, max - min)

  function handleLayout(e: LayoutChangeEvent) {
    setTrackWidth(e.nativeEvent.layout.width)
    trackRef.current?.measure((_x, _y, _width, _height, pageX) => {
      trackPageX.current = pageX
    })
  }

  function valueFromPageX(pageX: number) {
    if (trackWidth <= 0) return value
    const ratio = Math.min(1, Math.max(0, (pageX - trackPageX.current) / trackWidth))
    return min + Math.round(ratio * steps)
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => onChange(valueFromPageX(evt.nativeEvent.pageX)),
      onPanResponderMove: (_evt, gestureState) => onChange(valueFromPageX(gestureState.moveX)),
    }),
  ).current

  const ratio = steps > 0 ? (value - min) / steps : 0

  return (
    <View ref={trackRef} style={styles.track} onLayout={handleLayout} {...panResponder.panHandlers}>
      <View style={styles.trackBg} />
      <View style={[styles.trackFill, { width: `${ratio * 100}%`, backgroundColor: activeColor }]} />
      <View style={[styles.thumb, { left: `${ratio * 100}%`, backgroundColor: activeColor }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  track: { height: 28, justifyContent: 'center' },
  trackBg: {
    position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  trackFill: { position: 'absolute', left: 0, height: 4, borderRadius: 2 },
  thumb: {
    position: 'absolute', width: 16, height: 16, borderRadius: 8, marginLeft: -8,
    borderWidth: 2, borderColor: '#0A0A12',
  },
})
