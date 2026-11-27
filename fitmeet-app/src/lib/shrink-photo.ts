import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import type * as ImagePicker from 'expo-image-picker'

// Phone photos/screenshots are 2–5 MB (PNG screenshots ignore the picker's `quality`).
// Long side max 1600 px, JPEG 82 % → a few hundred KB each. On failure returns null and the caller sends the original.
export async function shrinkPhoto(a: ImagePicker.ImagePickerAsset): Promise<{ uri: string } | null> {
  try {
    const ctx = ImageManipulator.manipulate(a.uri)
    if (Math.max(a.width ?? 0, a.height ?? 0) > 1600) {
      ctx.resize((a.width ?? 0) >= (a.height ?? 0) ? { width: 1600 } : { height: 1600 })
    }
    const img = await ctx.renderAsync()
    const out = await img.saveAsync({ compress: 0.82, format: SaveFormat.JPEG })
    return { uri: out.uri }
  } catch {
    return null
  }
}
