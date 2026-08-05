/**
 * Browser-side file helpers for the demo's uploads.
 *
 * Nothing is ever sent to a server: a picked file is read with `FileReader` and,
 * for images, re-encoded through a canvas so the in-memory demo database stores
 * a thumbnail-sized data URL instead of a multi-megabyte original.
 */

/** Longest edge kept when an uploaded photo is re-encoded. */
export const PHOTO_MAX_EDGE = 900
/** JPEG quality used for the re-encode — small files, still presentable. */
const PHOTO_QUALITY = 0.7

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read-failed'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
}

/**
 * Shrinks an image data URL to at most `PHOTO_MAX_EDGE` on its longest side.
 * Falls back to the original string whenever the browser cannot decode it, so a
 * picked file always ends up stored even if the optimisation is unavailable.
 */
export async function shrinkImageDataUrl(dataUrl: string): Promise<string> {
  try {
    const image = await loadImage(dataUrl)
    const longest = Math.max(image.width, image.height)
    const scale = longest > 0 ? Math.min(1, PHOTO_MAX_EDGE / longest) : 1
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) return dataUrl
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const encoded = canvas.toDataURL('image/jpeg', PHOTO_QUALITY)
    // A re-encode of a tiny source can be *larger* than the original — keep the smaller one.
    return encoded.length < dataUrl.length ? encoded : dataUrl
  } catch {
    return dataUrl
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('decode-failed'))
    image.src = src
  })
}

/** File size in whole KB, never rounded down to a meaningless zero. */
export function sizeInKb(bytes: number) {
  return Math.max(1, Math.round(bytes / 1024))
}
