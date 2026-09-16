/**
 * Compresión de imágenes en el navegador (lado cliente).
 *
 * Convierte la imagen a WebP y la redimensiona a un máximo de MAX_DIM px
 * por su lado más largo, ANTES de subirla a R2. Esto reduce cada foto de
 * "varios MB" (fotos crudas de teléfono) a ~150-300 KB, lo que hace que el
 * optimizador de imágenes de Vercel trabaje mucho menos (menos 503 por cuota)
 * y que el sitio cargue más rápido.
 *
 * Importante: la orientación EXIF se preserva usando imageOrientation
 * 'from-image'. Si algo falla (canvas no soportado, formato exótico, etc.)
 * se devuelve el archivo original sin modificar, para no perder la subida.
 */

const MAX_DIM = 1600
const QUALITY = 0.8
const WEBP_MIME = 'image/webp'

export function isWebPSupported(): boolean {
  if (typeof window === 'undefined' || !HTMLCanvasElement.prototype.toBlob) return false
  const c = document.createElement('canvas')
  return c.toDataURL(WEBP_MIME).indexOf('data:image/webp') === 0
}

async function loadBitmap(file: File): Promise<ImageBitmap> {
  // createImageBitmap respeta la orientación EXIF con 'from-image'
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* fallback abajo */
    }
  }
  // Fallback clásico: <img> + objectURL (no corrige orientación EXIF, mejor que nada)
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img as unknown as ImageBitmap)
    img.onerror = () => reject(new Error('No se pudo decodificar la imagen'))
    img.src = url
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  })
}

/**
 * Redimensiona/optimiza un File a WebP. Devuelve un nuevo File (lista para
 * subir) o el archivo original si la compresión no es posible.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.type === WEBP_MIME) {
    // Ya es WebP: solo redimensionar si es muy grande (evita decodificar de más)
    if (file.size <= 1024 * 1024) return file
  }
  if (!isWebPSupported()) return file

  try {
    const bitmap = await loadBitmap(file)
    const sw = bitmap.width
    const sh = bitmap.height
    if (!sw || !sh) return file

    // No agrandar imágenes pequeñas; solo reducir si superan MAX_DIM
    const scale = Math.min(1, MAX_DIM / Math.max(sw, sh))
    const w = Math.max(1, Math.round(sw * scale))
    const h = Math.max(1, Math.round(sh * scale))

    // Si no hay reducción y ya es pequeña, devolvemos el original
    if (scale === 1 && file.size <= 1024 * 1024) {
      bitmap.close?.()
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.drawImage(bitmap as unknown as CanvasImageSource, 0, 0, w, h)
    bitmap.close?.()

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, WEBP_MIME, QUALITY)
    )
    if (!blob || blob.size === 0) return file

    // Si el "optimizado" resultó más pesado que el original, usar el original
    if (blob.size >= file.size) return file

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'imagen'
    const compressed = new File([blob], `${baseName}.webp`, {
      type: WEBP_MIME,
      lastModified: Date.now(),
    })
    return compressed
  } catch (err) {
    console.error('[compress] No se pudo optimizar la imagen:', err)
    return file
  }
}

/**
 * Procesa una lista de archivos en paralelo y devuelve los optimizados.
 */
export async function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map(f => compressImage(f)))
}
