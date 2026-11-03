// Downscale a picked photo to a JPEG before upload, so a 2+ MB PNG does not
// keep the submit button spinning on a slow uplink. Falls back to the original
// file if the browser cannot decode it.
export function compressImage(file: File, max = 1280, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    const img = document.createElement('img')
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > max || height > max) {
        if (width > height) { height = Math.round(height * max / width); width = max }
        else                { width  = Math.round(width  * max / height); height = max }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => {
        if (!blob || blob.size >= file.size) { resolve(file); return }
        const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
        resolve(new File([blob], name, { type: 'image/jpeg' }))
      }, 'image/jpeg', quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}
