import { useEffect, useMemo, useState } from 'react'
import { Image, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'

export interface MomentCoverPosition {
  x?: number | null
  y?: number | null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizedCover(cover?: MomentCoverPosition | null) {
  return {
    x: clamp(cover?.x ?? 0.5, 0, 1),
    y: clamp(cover?.y ?? 0.5, 0, 1),
  }
}

export function MomentCoverImage({
  uri,
  cover,
  style,
}: {
  uri: string
  cover?: MomentCoverPosition | null
  style?: StyleProp<ViewStyle>
}) {
  const [container, setContainer] = useState({ width: 0, height: 0 })
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const focal = normalizedCover(cover)

  useEffect(() => {
    let active = true
    setImageSize(null)
    Image.getSize(
      uri,
      (width, height) => {
        if (active) setImageSize({ width, height })
      },
      () => {
        if (active) setImageSize(null)
      },
    )
    return () => { active = false }
  }, [uri])

  const imageStyle = useMemo(() => {
    if (!imageSize || container.width <= 0 || container.height <= 0) return null

    const scale = Math.max(container.width / imageSize.width, container.height / imageSize.height)
    const width = imageSize.width * scale
    const height = imageSize.height * scale
    const minX = container.width - width
    const minY = container.height - height
    const translateX = clamp(container.width / 2 - focal.x * width, minX, 0)
    const translateY = clamp(container.height / 2 - focal.y * height, minY, 0)

    return {
      width,
      height,
      transform: [{ translateX }, { translateY }],
    }
  }, [container.height, container.width, focal.x, focal.y, imageSize])

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout
    setContainer({ width, height })
  }

  return (
    <View style={[styles.frame, style]} onLayout={handleLayout}>
      {imageStyle ? (
        <Image source={{ uri }} style={imageStyle} resizeMode="stretch" />
      ) : (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: '#050805',
  },
})
