/**
 * Piezas compartidas de la consulta del catálogo.
 *
 * El catálogo se consulta desde tres sitios que TIENEN que coincidir fila a
 * fila, porque comparten la caché del cliente (`clientCache` indexa por
 * filtros + página, no por consulta):
 *
 *  1. `app/[locale]/catalogo/page.tsx` — primera página en servidor (SSR/ISR).
 *  2. `hooks/useProductLoader.ts` — páginas siguientes bajo demanda.
 *  3. `hooks/usePrefetch.ts` — precarga en segundo plano de la página siguiente.
 *
 * Si las columnas, el orden o el filtro de moderación se separan, el usuario ve
 * menos productos en una página que en otra (una página "come" filas) o
 * enlaces distintos según quién haya cargado los datos. De ahí este módulo.
 */

import { CATALOG_PAGE_SIZE } from './catalog-pagination'

/**
 * Columnas de la tarjeta del catálogo. `slug` es imprescindible: la URL
 * canónica del producto se construye con él (`productUrl`).
 */
export const CATALOG_PRODUCT_COLUMNS =
  'id, slug, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, ubicacion_estado, creado_en, subcategoria, boosteado_en, destacado, destacado_hasta, vendedor_verificado'

/**
 * Visibilidad pública: aprobados, pendientes de moderación (aún no revisados)
 * y los legados sin estado. Los rechazados quedan fuera.
 */
export const CATALOG_FILTRO_MODERACION =
  'estado_moderacion.is.null,estado_moderacion.eq.aprobado,estado_moderacion.eq.pendiente'

export interface ProductoCatalogo {
  id: string
  slug?: string | null
  titulo: string
  precio_usd: number
  estado: string
  imagen_url: string | null
  ubicacion_ciudad: string | null
  ubicacion_estado: string | null
  creado_en: string
  subcategoria: string | null
  boosteado_en: string | null
  destacado: boolean
  destacado_hasta: string | null
  vendedor_verificado: boolean | null
  /** Pre-computado para evitar hydration mismatch entre servidor y cliente. */
  _isFeatured?: boolean
}

/**
 * Orden de prioridad del catálogo: boost > destacado vigente > más reciente.
 *
 * El servidor ordena por `creado_en` en SQL para paginar por rangos, pero la
 * prioridad real se resuelve aquí, en memoria, sobre las filas de la página.
 */
export function ordenarProductosCatalogo<T extends ProductoCatalogo>(productos: T[]): T[] {
  const ahora = new Date().toISOString()
  return [...productos].sort((a, b) => {
    const aBoost = a.boosteado_en || null
    const bBoost = b.boosteado_en || null
    if (aBoost && !bBoost) return -1
    if (!aBoost && bBoost) return 1
    if (aBoost && bBoost) return bBoost.localeCompare(aBoost)

    const aDest = !!(a.destacado && a.destacado_hasta && a.destacado_hasta > ahora)
    const bDest = !!(b.destacado && b.destacado_hasta && b.destacado_hasta > ahora)
    if (aDest && !bDest) return -1
    if (!aDest && bDest) return 1
    if (aDest && bDest) return b.destacado_hasta!.localeCompare(a.destacado_hasta!)

    return b.creado_en.localeCompare(a.creado_en)
  })
}

/** Añade `_isFeatured` ya resuelto para que el cliente no recalcule el flag. */
export function marcarDestacados<T extends ProductoCatalogo>(productos: T[]): T[] {
  const ahora = new Date().toISOString()
  return productos.map(p => ({
    ...p,
    _isFeatured: !!(p.destacado && p.destacado_hasta && p.destacado_hasta > ahora),
  }))
}

export { CATALOG_PAGE_SIZE }
