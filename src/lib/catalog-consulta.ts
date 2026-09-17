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
import {
  PARAMETROS_RANGO,
  RANGOS_NUMERICOS,
  especificacionesDeFiltros,
  limpiarFiltrosRango,
} from './filtros-tecnicos'

/**
 * Filtro del catálogo "solo anuncios con homologación verificada". Es el único
 * filtro que no vive en `especificaciones` (es una columna de `productos`), así
 * que se aplica aparte, pero desde aquí para que los tres sitios que consultan
 * el catálogo lo hagan igual.
 */
export const FILTRO_VERIFICADA_PARAM = 'verificada'

export function filtroVerificadaActivo(valor: unknown): boolean {
  return valor === '1' || valor === true || valor === 'si' || valor === 'sí'
}

interface QueryCatalogo {
  contains: (column: string, value: Record<string, string>) => unknown
  eq: (column: string, value: string) => unknown
  gte: (column: string, value: number) => unknown
  lte: (column: string, value: number) => unknown
  textSearch?: (column: string, query: string, opts?: unknown) => unknown
}

/** Filtros que entiende la consulta compartida del catálogo (y /buscar). */
export type FiltrosCatalogo = {
  categoria?: string
  subcategoria?: string
  marca?: string
  q?: string
  precioMin?: string
  precioMax?: string
  ubicacionEstado?: string
  ubicacionCiudad?: string
  condicion?: string
  /** Rangos numéricos: kmMax, anioMin, placaWatiosMin, inversorWatiosMin. */
} & Record<string, unknown>

/**
 * Aplica a una query los filtros comunes a catálogo y buscador:
 * categoría, subcategoría, marca, búsqueda de texto, ubicación, precio,
 * condición y el bloque de filtros técnicos propios del catálogo
 * (contención JSONB + homologación verificada + rangos numéricos).
 *
 * Existía duplicado en `useProductLoader`, `usePrefetch` y `BuscarClient`,
 * derivando en el mismo bug tres veces. Ahora vive aquí, una sola vez.
 */
export function aplicarFiltrosBase<T extends QueryCatalogo>(
  query: T,
  filters: FiltrosCatalogo
): T {
  let q: any = query

  if (filters.subcategoria) q = q.eq('subcategoria', filters.subcategoria)
  if (filters.marca) q = q.eq('marca', filters.marca)
  if (filters.q) q = q.textSearch('search_vector', filters.q, { config: 'spanish', type: 'plain' })

  if (filters.ubicacionCiudad) {
    q = q.eq('ubicacion_ciudad', filters.ubicacionCiudad)
  } else if (filters.ubicacionEstado) {
    q = q.eq('ubicacion_estado', filters.ubicacionEstado)
  }

  if (filters.precioMin) q = q.gte('precio_usd', parseFloat(filters.precioMin))
  if (filters.precioMax) q = q.lte('precio_usd', parseFloat(filters.precioMax))

  if (filters.condicion) q = q.eq('estado', filters.condicion)

  // Ficha técnica camper: contención JSONB + verificación + rangos numéricos.
  q = aplicarFiltrosCatalogo(q, filters)
  return q as T
}

/** ¿Tiene alguno de los filtros de rango numérico un valor activo? */
export function tieneRangosNumericos(filtros?: Record<string, unknown> | null): boolean {
  return Object.keys(limpiarFiltrosRango(filtros)).length > 0
}

/**
 * Aplica los filtros técnicos (JSONB + verificación + rangos) a la consulta:
 *  - filtros técnicos → una condición de contención sobre el JSONB (índice GIN);
 *  - "solo verificados" → igualdad sobre la columna de estado del expediente;
 *  - rangos numéricos → `aplicarRangosNumericos` (abajo).
 */
export function aplicarFiltrosCatalogo<T extends QueryCatalogo>(
  query: T,
  filtros?: Record<string, unknown> | null
): T {
  let q: any = query
  const specs = especificacionesDeFiltros(filtros)
  if (Object.keys(specs).length > 0) q = q.contains('especificaciones', specs)
  if (filtroVerificadaActivo(filtros?.[FILTRO_VERIFICADA_PARAM])) {
    // `eq` (no `contains`): es una columna de texto, no el JSONB.
    q = q.eq('verificacion_homologacion', 'verificada')
  }
  return aplicarRangosNumericos(q as T, filtros)
}

/**
 * Límites sugeridos para los rangos numéricos de la UI (kilómetros máximos,
 * año mínimo y watios). Acotan el input a valores sensatos; la query acepta
 * cualquier número.
 */
export const RANGOS_SUGERIDOS: Record<string, { min: number; max: number; step: number }> = {
  kmMax: { min: 0, max: 500000, step: 5000 },
  anioMin: { min: 1980, max: new Date().getFullYear(), step: 1 },
  placaWatiosMin: { min: 0, max: 2000, step: 50 },
  inversorWatiosMin: { min: 0, max: 5000, step: 250 },
}

/**
 * Traduce los filtros de rango activos a condiciones sobre las columnas
 * generadas `espec_km` / `espec_anio` / `espec_placa_w` / `espec_inversor_w`
 * (migración 202609170003). Comparación NUMÉRICA y con índice funcional: es lo
 * opuesto a filtrar por `especificaciones->>'Kilómetros'`, que compara texto
 * alfabéticamente.
 */
export function aplicarRangosNumericos<T extends QueryCatalogo>(
  query: T,
  filtros?: Record<string, unknown> | null
): T {
  const activos = limpiarFiltrosRango(filtros)
  if (Object.keys(activos).length === 0) return query

  let q: any = query
  for (const rango of RANGOS_NUMERICOS) {
    const valor = activos[rango.param]
    if (valor == null) continue
    if (rango.operador === 'lte') q = q.lte(rango.columnaGenerada, valor)
    else q = q.gte(rango.columnaGenerada, valor)
  }
  return q as T
}

/**
 * Copa los filtros quitando los rangos numéricos. Útil como plan B: si la base
 * de datos aún no tiene las columnas generadas (migración sin aplicar), la
 * query con rangos falla con "column does not exist" y se reintenta sin ellos,
 * dejando funcionar el resto de filtros.
 */
export function quitarRangos(filtros?: Record<string, unknown> | null): Record<string, unknown> {
  if (!filtros) return {}
  const copia: Record<string, unknown> = { ...filtros }
  for (const p of PARAMETROS_RANGO) delete copia[p]
  return copia
}

/**
 * ¿Es el error de "la columna de rangos no existe" (migración 202609170003 sin
 * aplicar)? La comparación por nombre de columna es deliberada: cuando PostgREST
 * no conoce `espec_km`/`espec_anio`/… responde con un error que menciona la
 * columna. Si coincide, los cargadores reintentan sin rangos.
 */
export function esErrorColumnasRango(err: unknown): boolean {
  const msg = err && typeof err === 'object'
    ? String((err as { message?: unknown }).message || err)
    : String(err)
  if (!msg) return false
  const nombre = msg.toLowerCase()
  return ['espec_km', 'espec_anio', 'espec_placa_w', 'espec_inversor_w'].some(
    c => nombre.includes(c.toLowerCase())
  )
}

/**
 * Columnas de la tarjeta del catálogo. `slug` es imprescindible: la URL
 * canónica del producto se construye con él (`productUrl`).
 */
export const CATALOG_PRODUCT_COLUMNS =
  'id, slug, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, ubicacion_estado, creado_en, subcategoria, boosteado_en, destacado, destacado_hasta, vendedor_verificado, verificacion_homologacion, reservado'

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
  /** Estado del expediente de homologación (Fase 0.2). */
  verificacion_homologacion?: string | null
  /** Reserva con señal vigente (Fase 1.2): el anuncio está comprometido. */
  reservado?: boolean | null
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
