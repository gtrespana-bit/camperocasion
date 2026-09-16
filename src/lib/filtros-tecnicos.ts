/**
 * Registro único de los filtros técnicos del catálogo.
 *
 * Antes cada filtro técnico se declaraba en tres sitios que tenían que
 * mantenerse a mano: el bloque "Ficha técnica" de `CatalogFilters`, el mapa
 * `CAMPOS_TECNICOS` de `useProductLoader` y una copia de ese mismo mapa en
 * `usePrefetch`. Añadir un campo obligaba a tocar tres archivos y, si uno se
 * olvidaba, la caché del prefetch devolvía páginas con filtros distintos a los
 * que pedía el loader (la clave de caché es el conjunto de filtros).
 *
 * Aquí vive la única fuente de verdad: qué parámetro de la query string
 * corresponde a qué clave del JSONB `productos.especificaciones`, en qué grupo
 * de la UI se muestra y con qué opciones (las opciones salen de las mismas
 * listas que usa el formulario de publicación, así que captura y filtro no
 * pueden divergir).
 *
 * ── Sobre la consulta ────────────────────────────────────────────────────
 * Los filtros se aplican con contención JSONB (`@>`, en supabase-js
 * `.contains()`), que es exactamente el operador que cubre el índice GIN
 * `productos_especificaciones_idx` (migración 025). La extracción campo a campo
 * (`especificaciones->>'Campo' = 'valor'`) devuelve el mismo resultado pero NO
 * puede usar ese índice: fuerza un recorrido secuencial de `productos`.
 * Además, todos los filtros activos viajan en una sola condición `@>`, en vez
 * de una condición por campo.
 *
 * Las claves y los valores llevan espacios y acentos ("Plazas para dormir",
 * "C (Verde)"): supabase-js los envía percent-encoded y PostgREST los decodifica
 * como formulario (`+` → espacio, `%C3%A9` → `é`), así que llegan intactos y el
 * documento de contención se compara tal cual se guardó al publicar.
 */

import {
  OPCIONES_DGT,
  OPCIONES_HOMOLOGACION,
  OPCIONES_COMBUSTIBLE,
  OPCIONES_TRACCION,
  OPCIONES_MMA,
  OPCIONES_LONGITUD,
  OPCIONES_ALTURA,
  OPCIONES_PLAZAS_VIAJE,
  OPCIONES_PLAZAS_DORMIR,
  OPCIONES_CALEFACCION,
  OPCIONES_AGUA_CALIENTE,
  OPCIONES_BANO,
  OPCIONES_BATERIA_AUX,
  OPCIONES_SI_NO,
  OPCIONES_NEVERA,
} from './categorias'

/** Bloques en los que se agrupan los filtros técnicos en la barra lateral. */
export type GrupoFiltroTecnico = 'mecanica' | 'habitabilidad' | 'autonomia'

export interface FiltroTecnico {
  /** Parámetro de la query string: /catalogo?plazasDormir=4 */
  param: string
  /** Clave con la que el campo se guarda en el JSONB `especificaciones`. */
  campo: string
  grupo: GrupoFiltroTecnico
  /** Valores ofrecidos. Deben coincidir con las opciones del formulario. */
  opciones: readonly string[]
  /** Clave i18n completa, p. ej. `catalog.filters.plazasDormir`. */
  i18n: string
}

export const FILTROS_TECNICOS: readonly FiltroTecnico[] = [
  // Mecánica y arquitectura del vehículo
  { param: 'dgt', campo: 'Distintivo Ambiental DGT', grupo: 'mecanica', opciones: OPCIONES_DGT, i18n: 'catalog.filters.dgt' },
  { param: 'homologacion', campo: 'Homologación', grupo: 'mecanica', opciones: OPCIONES_HOMOLOGACION, i18n: 'catalog.filters.homologation' },
  { param: 'combustible', campo: 'Combustible', grupo: 'mecanica', opciones: OPCIONES_COMBUSTIBLE, i18n: 'catalog.filters.fuel' },
  { param: 'traccion', campo: 'Tracción', grupo: 'mecanica', opciones: OPCIONES_TRACCION, i18n: 'catalog.filters.drive' },
  { param: 'mma', campo: 'MMA / Peso máximo autorizado', grupo: 'mecanica', opciones: OPCIONES_MMA, i18n: 'catalog.filters.mma' },
  { param: 'longitud', campo: 'Longitud exterior', grupo: 'mecanica', opciones: OPCIONES_LONGITUD, i18n: 'catalog.filters.length' },
  { param: 'altura', campo: 'Altura exterior', grupo: 'mecanica', opciones: OPCIONES_ALTURA, i18n: 'catalog.filters.height' },

  // Habitabilidad
  { param: 'plazasViaje', campo: 'Plazas homologadas para viajar', grupo: 'habitabilidad', opciones: OPCIONES_PLAZAS_VIAJE, i18n: 'catalog.filters.travelSeats' },
  { param: 'plazasDormir', campo: 'Plazas para dormir', grupo: 'habitabilidad', opciones: OPCIONES_PLAZAS_DORMIR, i18n: 'catalog.filters.sleepSeats' },
  { param: 'calefaccion', campo: 'Calefacción estacionaria', grupo: 'habitabilidad', opciones: OPCIONES_CALEFACCION, i18n: 'catalog.filters.heating' },
  { param: 'aguaCaliente', campo: 'Agua caliente', grupo: 'habitabilidad', opciones: OPCIONES_AGUA_CALIENTE, i18n: 'catalog.filters.hotWater' },
  { param: 'bano', campo: 'Baño / Ducha', grupo: 'habitabilidad', opciones: OPCIONES_BANO, i18n: 'catalog.filters.bathroom' },

  // Autonomía y equipamiento camper
  { param: 'bateria', campo: 'Batería auxiliar', grupo: 'autonomia', opciones: OPCIONES_BATERIA_AUX, i18n: 'catalog.filters.battery' },
  { param: 'placaSolar', campo: 'Placa solar', grupo: 'autonomia', opciones: OPCIONES_SI_NO, i18n: 'catalog.filters.solar' },
  { param: 'inversor', campo: 'Inversor 220V', grupo: 'autonomia', opciones: OPCIONES_SI_NO, i18n: 'catalog.filters.inverter' },
  { param: 'nevera', campo: 'Nevera', grupo: 'autonomia', opciones: OPCIONES_NEVERA, i18n: 'catalog.filters.fridge' },
]

export const GRUPOS_FILTROS_TECNICOS: readonly {
  grupo: GrupoFiltroTecnico
  icono: string
  i18n: string
  filtros: FiltroTecnico[]
}[] = (
  [
    { grupo: 'mecanica', icono: '🔧', i18n: 'catalog.filters.groups.mechanics' },
    { grupo: 'habitabilidad', icono: '🛏️', i18n: 'catalog.filters.groups.liveability' },
    { grupo: 'autonomia', icono: '⚡', i18n: 'catalog.filters.groups.autonomy' },
  ] as const
).map(g => ({ ...g, filtros: FILTROS_TECNICOS.filter(f => f.grupo === g.grupo) }))

/** Parámetros de URL que corresponden a un filtro técnico. */
export const PARAMETROS_TECNICOS: readonly string[] = FILTROS_TECNICOS.map(f => f.param)

/** Mapa param → clave del JSONB, mantenido por compatibilidad con los hooks. */
export const CAMPOS_TECNICOS: Record<string, string> = Object.fromEntries(
  FILTROS_TECNICOS.map(f => [f.param, f.campo])
)

export const FILTROS_POR_PARAM: Record<string, FiltroTecnico> = Object.fromEntries(
  FILTROS_TECNICOS.map(f => [f.param, f])
)

/** Filtros técnicos activos: `{ plazasDormir: '4', ... }`. */
export type FiltrosTecnicos = Record<string, string>

type EntradaParams =
  | URLSearchParams
  | Record<string, string | string[] | undefined>
  | null
  | undefined

function leerParam(params: EntradaParams, param: string): string {
  if (!params) return ''
  if (typeof (params as URLSearchParams).get === 'function') {
    return (params as URLSearchParams).get(param) || ''
  }
  const raw = (params as Record<string, string | string[] | undefined>)[param]
  const valor = Array.isArray(raw) ? raw[0] : raw
  return valor || ''
}

/**
 * Extrae de la query string los filtros técnicos conocidos y con valor.
 * Descarta parámetros desconocidos y valores vacíos.
 */
export function leerFiltrosTecnicos(params: EntradaParams): FiltrosTecnicos {
  const filtros: FiltrosTecnicos = {}
  for (const { param } of FILTROS_TECNICOS) {
    const valor = leerParam(params, param).trim()
    if (valor) filtros[param] = valor
  }
  return filtros
}

/** Deja solo los filtros técnicos conocidos y no vacíos. */
export function limpiarFiltrosTecnicos(filtros?: Record<string, unknown> | null): FiltrosTecnicos {
  const limpios: FiltrosTecnicos = {}
  if (!filtros) return limpios
  for (const { param } of FILTROS_TECNICOS) {
    const raw = filtros[param]
    const valor = typeof raw === 'string' ? raw.trim() : ''
    if (valor) limpios[param] = valor
  }
  return limpios
}

/** ¿Hay algún filtro técnico activo? */
export function hayFiltrosTecnicos(filtros?: Record<string, unknown> | null): boolean {
  return Object.keys(limpiarFiltrosTecnicos(filtros)).length > 0
}

/**
 * Traduce los filtros activos al documento JSONB que se busca por contención:
 * `{ plazasDormir: '4', dgt: 'ECO' }` → `{ 'Plazas para dormir': '4', 'Distintivo Ambiental DGT': 'ECO' }`.
 */
export function especificacionesDeFiltros(filtros?: Record<string, unknown> | null): Record<string, string> {
  const specs: Record<string, string> = {}
  const limpios = limpiarFiltrosTecnicos(filtros)
  for (const [param, valor] of Object.entries(limpios)) {
    specs[FILTROS_POR_PARAM[param].campo] = valor
  }
  return specs
}

interface QueryConContains<T> {
  contains: (column: string, value: Record<string, string>) => T
}

/**
 * Aplica los filtros técnicos activos a una consulta de productos con una sola
 * condición `@>` sobre `especificaciones` (índice GIN). Sin filtros activos
 * devuelve la consulta intacta.
 */
export function aplicarFiltrosTecnicos<T extends QueryConContains<unknown>>(
  query: T,
  filtros?: Record<string, unknown> | null
): T {
  const specs = especificacionesDeFiltros(filtros)
  if (Object.keys(specs).length === 0) return query
  return query.contains('especificaciones', specs) as unknown as T
}

/**
 * Firma estable de los filtros técnicos activos. Se usa para detectar cambios
 * de filtro (y resetear la paginación) sin depender de la identidad del objeto.
 */
export function firmaFiltrosTecnicos(filtros?: Record<string, unknown> | null): string {
  const limpios = limpiarFiltrosTecnicos(filtros)
  return FILTROS_TECNICOS
    .filter(f => limpios[f.param])
    .map(f => `${f.param}=${limpios[f.param]}`)
    .join('&')
}
