import { useEffect, useRef } from 'react'
import {
  Animated,
  PanResponder,
  StyleSheet,
  type ImageResizeMode,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

interface Props {
  source: ImageSourcePropType
  style?: StyleProp<ViewStyle>
  resizeMode?: ImageResizeMode
  maxScale?: number
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function touchDistance(touches: { pageX: number; pageY: number }[]) {
  const [a, b] = touches
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY)
}

/** Full-screen image with two-finger pinch-to-zoom and single-finger pan while
 * zoomed in. Built on core RN Animated + PanResponder (no gesture-handler/
 * reanimated dependency) since this app doesn't otherwise depend on those. */
export function ZoomableImage({ source, style, resizeMode = 'contain', maxScale = 4 }: Props) {
  const scale = useRef(new Animated.Value(1)).current
  const translateX = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(0)).current

  const currentScale = useRef(1)
  const currentTranslateX = useRef(0)
  const currentTranslateY = useRef(0)
  const pinchStartDistance = useRef<number | null>(null)
  const pinchStartScale = useRef(1)
  const panStartTouch = useRef<{ x: number; y: number } | null>(null)
  const panStartTranslate = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const scaleId = scale.addListener(({ value }) => { currentScale.current = value })
    const txId = translateX.addListener(({ value }) => { currentTranslateX.current = value })
    const tyId = translateY.addListener(({ value }) => { currentTranslateY.current = value })
    return () => {
      scale.removeListener(scaleId)
      translateX.removeListener(txId)
      translateY.removeListener(tyId)
    }
  }, [scale, translateX, translateY])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gestureState) =>
        Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches
        if (touches.length === 2) {
          pinchStartDistance.current = touchDistance(touches)
          pinchStartScale.current = currentScale.current
          panStartTouch.current = null
        } else if (touches.length === 1) {
          panStartTouch.current = { x: touches[0].pageX, y: touches[0].pageY }
          panStartTranslate.current = { x: currentTranslateX.current, y: currentTranslateY.current }
          pinchStartDistance.current = null
        }
      },
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches
        if (touches.length === 2) {
          if (pinchStartDistance.current == null) {
            pinchStartDistance.current = touchDistance(touches)
            pinchStartScale.current = currentScale.current
            return
          }
          const nextScale = clamp(
            pinchStartScale.current * (touchDistance(touches) / pinchStartDistance.current),
            1,
            maxScale,
          )
          scale.setValue(nextScale)
        } else if (touches.length === 1 && currentScale.current > 1 && panStartTouch.current) {
          const dx = touches[0].pageX - panStartTouch.current.x
          const dy = touches[0].pageY - panStartTouch.current.y
          // Loosely bounds how far the image can be dragged so it can't be
          // panned entirely out of view — scales with zoom level so more
          // zoom allows more room to pan around.
          const maxOffset = 90 * (currentScale.current - 1)
          translateX.setValue(clamp(panStartTranslate.current.x + dx, -maxOffset, maxOffset))
          translateY.setValue(clamp(panStartTranslate.current.y + dy, -maxOffset, maxOffset))
        }
      },
      onPanResponderRelease: () => {
        pinchStartDistance.current = null
        panStartTouch.current = null
        if (currentScale.current <= 1) {
          Animated.parallel([
            Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
          ]).start()
        }
      },
    }),
  ).current

  return (
    <Animated.View {...panResponder.panHandlers} style={[styles.wrap, style]}>
      <Animated.Image
        source={source}
        resizeMode={resizeMode}
        style={[StyleSheet.absoluteFillObject, { transform: [{ translateX }, { translateY }, { scale }] }]}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
})
