/**
 * Shrinks a photo in the browser before upload: max 1600px, JPEG.
 * Re-drawing it also strips hidden metadata such as the GPS location
 * phones store in photos.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  if (file.size > 20 * 1024 * 1024) throw new Error('That photo is too big (max 20 MB).')

  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new Error('Could not read that photo. Try a JPG or PNG.')

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not process that photo.'))), 'image/jpeg', quality),
  )
}

export const MAX_PHOTOS_PER_POST = 6

/** Square, centred crop for profile photos (default 480×480 JPEG). */
export async function cropSquare(file: File, size = 480, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new Error('Could not read that photo. Try a JPG or PNG.')
  const side = Math.min(bitmap.width, bitmap.height)
  // Centre horizontally; for portraits keep a little more of the top (faces).
  const sx = (bitmap.width - side) / 2
  const sy = bitmap.height > bitmap.width ? (bitmap.height - side) * 0.3 : (bitmap.height - side) / 2
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = Math.min(size, side)
  canvas.getContext('2d')!.drawImage(bitmap, sx, sy, side, side, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process that photo.'))), 'image/jpeg', quality),
  )
}
