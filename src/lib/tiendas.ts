/**
 * Reglas de la tienda de profesionales y camperizadores.
 *
 * Fuente única: la usan el formulario del panel, la página pública
 * `/tienda/[slug]`, el listado `/tiendas` y el sitemap. Si esto diverge,
 * aparecen tiendas que se listan pero dan 404, o URLs que el vendedor reparte
 * y dejan de funcionar.
 */

/** Tipos de vendedor que pueden abrir escaparate. Un particular, no. */
export const TIPOS_CON_TIENDA = ['camperizador', 'profesional'] as const
export type TipoConTienda = (typeof TIPOS_CON_TIENDA)[number]

export const LIMITES_TIENDA = {
  descripcion: 1500,
  horario: 200,
  direccion: 200,
  slugMin: 3,
  slugMax: 60,
} as const

export function puedeTenerTienda(tipoVendedor: string | null | undefined): boolean {
  return (TIPOS_CON_TIENDA as readonly string[]).includes(tipoVendedor || '')
}

/**
 * Convierte un texto en slug de URL. Debe dar EXACTAMENTE el mismo resultado
 * que `fn_slugify` en SQL: el formulario previsualiza la URL y la base la
 * genera, y si no coinciden el vendedor ve una dirección distinta a la real.
 */
export function slugify(texto: string): string {
  return (texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Slug válido para publicar: solo minúsculas, dígitos y guiones internos. */
export function slugValido(slug: string): boolean {
  if (!slug) return false
  if (slug.length < LIMITES_TIENDA.slugMin || slug.length > LIMITES_TIENDA.slugMax) return false
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

/**
 * Palabras que no pueden ser slug porque chocarían con rutas reales del sitio
 * o harían pasar a un vendedor por la propia plataforma.
 */
export const SLUGS_RESERVADOS = [
  'admin', 'api', 'tienda', 'tiendas', 'catalogo', 'buscar', 'publicar',
  'dashboard', 'login', 'registro', 'chat', 'creditos', 'contacto', 'blog',
  'producto', 'vendedor', 'perfil', 'camperocasion', 'soporte', 'ayuda',
  'faq', 'legal', 'privacidad', 'cookies', 'aviso-legal', 'null', 'undefined',
] as const

export function slugReservado(slug: string): boolean {
  return (SLUGS_RESERVADOS as readonly string[]).includes(slug)
}

export interface DatosTienda {
  nombre?: string | null
  descripcion?: string | null
  web?: string | null
  horario?: string | null
  direccion?: string | null
}

/**
 * Normaliza la web que escribe el vendedor. Acepta "furgocamper.es" y devuelve
 * una URL absoluta; rechaza `javascript:` y demás esquemas peligrosos, porque
 * este valor acaba en un `href` de una página pública.
 */
export function normalizarWeb(valor: string | null | undefined): string | null {
  const texto = (valor || '').trim()
  if (!texto) return null
  const conEsquema = /^https?:\/\//i.test(texto) ? texto : `https://${texto}`
  try {
    const url = new URL(conEsquema)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname.includes('.')) return null
    return url.toString()
  } catch {
    return null
  }
}

export interface ErroresTienda {
  [campo: string]: string
}

/**
 * Valida el formulario de la tienda. Devuelve un objeto vacío si todo está
 * bien. Se usa en el cliente (feedback inmediato) y en el servidor (que es
 * donde de verdad cuenta).
 */
export function validarTienda(datos: DatosTienda & { slug?: string | null }): ErroresTienda {
  const errores: ErroresTienda = {}

  const nombre = (datos.nombre || '').trim()
  if (nombre.length < 2) {
    errores.nombre = 'El nombre de la tienda es obligatorio.'
  }

  if ((datos.descripcion || '').length > LIMITES_TIENDA.descripcion) {
    errores.descripcion = `Máximo ${LIMITES_TIENDA.descripcion} caracteres.`
  }
  if ((datos.horario || '').length > LIMITES_TIENDA.horario) {
    errores.horario = `Máximo ${LIMITES_TIENDA.horario} caracteres.`
  }
  if ((datos.direccion || '').length > LIMITES_TIENDA.direccion) {
    errores.direccion = `Máximo ${LIMITES_TIENDA.direccion} caracteres.`
  }

  const web = (datos.web || '').trim()
  if (web && !normalizarWeb(web)) {
    errores.web = 'La dirección web no parece válida.'
  }

  if (datos.slug != null && datos.slug !== '') {
    const slug = slugify(datos.slug)
    if (!slugValido(slug)) {
      errores.slug = `La dirección debe tener entre ${LIMITES_TIENDA.slugMin} y ${LIMITES_TIENDA.slugMax} caracteres (letras, números y guiones).`
    } else if (slugReservado(slug)) {
      errores.slug = 'Esa dirección está reservada. Elige otra.'
    }
  }

  return errores
}

/** URL pública de la tienda (relativa, para usar con el enrutado por idioma). */
export function urlTienda(slug: string): string {
  return `/tienda/${slug}`
}
