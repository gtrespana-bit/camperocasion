/**
 * Utilidades SEO compartidas.
 *
 * Reglas que aplica todo el sitio:
 *  · Una sola URL canónica por página, absoluta, en el dominio de producción
 *    y sin barra final (la raíz es la única excepción: `https://…online`).
 *  · Solo se anuncia español (`es-ES` + `x-default`): `/en` se sirve para
 *    usuarios pero lleva `X-Robots-Tag: noindex` y no compite en Google.
 *  · El título visible en Google ronda los 60 caracteres. El layout raíz ya
 *    añade « | CamperOcasión» con su plantilla, así que aquí se decide si la
 *    marca cabe o si conviene recortar antes de que Google corte por su cuenta
 *    (que suele partir palabras a la mitad).
 */

export const SITE_URL = 'https://camperocasion.online'
export const NOMBRE_SITIO = 'CamperOcasión'

/** Máximo recomendado para un `<title>` completo, marca incluida. */
export const MAX_TITULO = 62

/** Máximo recomendado para una meta description (Google muestra ~155-160). */
export const MAX_DESCRIPCION = 158

/** URL absoluta y normalizada (sin barra final salvo la portada). */
export function urlSeo(path = '/'): string {
  if (!path || path === '/') return SITE_URL
  const limpio = path.startsWith('/') ? path : `/${path}`
  return `${SITE_URL}${limpio.replace(/\/+$/, '')}`
}

/**
 * `alternates` de una página pública: canonical + `es-ES` + `x-default`.
 * Se usa tal cual en `Metadata.alternates`.
 */
export function alternatesSeo(path: string) {
  const canonical = urlSeo(path)
  return {
    canonical,
    languages: {
      'es-ES': canonical,
      'x-default': canonical,
    },
  }
}

/** Quita comillas envolventes (frontmatter YAML, títulos copiados, etc.). */
export function limpiarComillas(valor: string | null | undefined): string {
  return (valor || '').trim().replace(/^["'«“]+|["'»”]+$/g, '').trim()
}

/**
 * Recorta a `max` caracteres sin partir palabras ni dejar signos colgando.
 * No añade puntos suspensivos: en un `<title>` Google los reemplaza por su
 * propio corte y en una description preferimos una frase completa.
 */
export function recortarTexto(valor: string, max: number): string {
  const texto = (valor || '').replace(/\s+/g, ' ').trim()
  if (texto.length <= max) return texto
  const corte = texto.slice(0, max)
  const ultimoEspacio = corte.lastIndexOf(' ')
  const base = ultimoEspacio > max * 0.55 ? corte.slice(0, ultimoEspacio) : corte
  return base.replace(/[\s,;:–—-]+$/, '')
}

/**
 * Título para `Metadata.title` teniendo en cuenta la plantilla del layout.
 *
 * - Si «texto | CamperOcasión» cabe en `max`, devuelve el texto y deja que la
 *   plantilla añada la marca.
 * - Si no cabe pero el texto solo sí, devuelve `{ absolute }` (sin marca) para
 *   no perder la parte descriptiva.
 * - Si tampoco cabe el texto, lo recorta por palabra.
 */
export function tituloSeo(
  texto: string,
  max: number = MAX_TITULO,
): string | { absolute: string } {
  const limpio = limpiarComillas(texto)
  const conMarca = `${limpio} | ${NOMBRE_SITIO}`
  if (conMarca.length <= max) return limpio
  if (limpio.length <= max) return { absolute: limpio }
  return { absolute: recortarTexto(limpio, max) }
}

/** Meta description: una sola línea, sin duplicar espacios y sin cortar palabras. */
export function descripcionSeo(
  texto: string | null | undefined,
  max: number = MAX_DESCRIPCION,
): string {
  const limpio = (texto || '').replace(/\s+/g, ' ').trim()
  if (limpio.length <= max) return limpio
  const recortado = recortarTexto(limpio, max - 1)
  return `${recortado}…`
}
