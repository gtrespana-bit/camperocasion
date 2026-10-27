/**
 * Helpers para distinguir errores de PostgREST.
 *
 * El endpoint /api/publicar tenía un fallback que reintentaba el INSERT cada
 * vez que el mensaje de error mencionaba la palabra "especificaciones". Eso es
 * peligroso: un error de un TRIGGER, de un CHECK o de un JSON mal formado que
 * nombre la columna también dispararía un SEGUNDO insert (posible duplicado),
 * y además escondería el fallo real. Solo queremos reintentar cuando PostgREST
 * dice explícitamente "no conozco esa columna" (PGRST204).
 */

export interface ErrorPostgrestMinimo {
  code?: unknown
  message?: unknown
  details?: unknown
  hint?: unknown
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * ¿Es el PGRST204 de "la columna X no existe en el schema cache"?
 * Requiere código Y mensaje: así un error de lógica que mencione la columna
 * devuelve 500 en vez de publicar un anuncio a medias.
 */
export function esErrorColumnaAusente(error: unknown, columna: string): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as ErrorPostgrestMinimo
  const codigo = typeof e.code === 'string' ? e.code.toUpperCase() : ''
  const mensaje = typeof e.message === 'string' ? e.message : ''
  if (codigo !== 'PGRST204') return false

  const patron = new RegExp(
    `Could not find the ['"\`]?${escaparRegex(columna)}['"\`]? column`,
    'i',
  )
  return patron.test(mensaje)
}
