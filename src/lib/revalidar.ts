import { revalidatePath } from 'next/cache'
import { getCiudadByMunicipioYEstado } from './ubicaciones-seo'
import { SUBCATEGORIAS_SEO } from './categorias-seo'

/**
 * Rutas públicas que muestran anuncios y que hay que invalidar cuando un
 * anuncio se publica, se edita, se reactiva, se marca como vendido o cambia de
 * posición en el catálogo.
 *
 * Detalle del enrutado (importante para no invalidar de más ni de menos):
 * `next-intl` está configurado con `localePrefix: 'as-needed'`, así que el
 * español vive SIN prefijo (`/catalogo`) y el inglés CON prefijo
 * (`/en/catalogo`). No existe `/es/catalogo` (hace 307 → `/catalogo`), por eso
 * no se invalida.
 */
const RUTAS_CATALOGO = ['/', '/en', '/catalogo', '/en/catalogo'] as const

/**
 * Landings ISR afectadas por un anuncio: su provincia (`/{ciudad}`) y,
 * si aplica, la combinación provincia + subcategoría (`/{ciudad}/{cat}`).
 * Devuelve vacío si la ciudad no tiene landing SEO o la categoría no
 * es una de las 7 con landing (fail-safe: no invalidamos nada).
 */
function rutasLanding(
  ubicacionCiudad?: string | null,
  ubicacionEstado?: string | null,
  subcategoria?: string | null,
): string[] {
  if (!ubicacionCiudad) return []
  const ciudadSEO = getCiudadByMunicipioYEstado(ubicacionCiudad, ubicacionEstado || '')
  if (!ciudadSEO) return []
  const rutas = [`/${ciudadSEO.slug}`, `/en/${ciudadSEO.slug}`]
  if (subcategoria) {
    const sub = SUBCATEGORIAS_SEO.find(s => s.categoria === subcategoria)
    if (sub) {
      rutas.push(
        `/${ciudadSEO.slug}/${sub.slug}`,
        `/en/${ciudadSEO.slug}/${sub.slug}`,
      )
    }
  }
  return rutas
}

/**
 * Invalida las superficies públicas con listados de anuncios.
 *
 * Antes cada endpoint repetía su propia lista: `/api/publicar` invalidaba solo
 * la home y el catálogo en español (el listado inglés se quedaba con datos
 * viejos) y `/api/productos/editar` las cuatro. Centralizarlo evita que la
 * próxima ruta que toque anuncios se olvide de alguna.
 *
 * Con `ops` (ciudad/estado/subcategoría del anuncio) se invalidan también las
 * landings `/[ciudad]` e `/[ciudad]/[categoria]`, que desde la tanda de SEO
 * cachean su render 10 min (ISR on-demand): sin esto, un anuncio nuevo tardaría
 * hasta 10 min en aparecer en su landing provincial.
 *
 * La home y el catálogo además declaran `revalidate = 600`, de modo que aunque
 * esta invalidación no llegara a ejecutarse (por ejemplo si el proceso muere
 * después de escribir en la base de datos) ninguna superficie queda congelada
 * más de 10 minutos.
 */
export function revalidarListadosPublicos(ops?: {
  ubicacionCiudad?: string | null
  ubicacionEstado?: string | null
  subcategoria?: string | null
}): void {
  const rutas = [
    ...RUTAS_CATALOGO,
    ...rutasLanding(ops?.ubicacionCiudad, ops?.ubicacionEstado, ops?.subcategoria),
  ]
  for (const ruta of rutas) {
    try {
      revalidatePath(ruta)
    } catch {
      // Fuera de una petición (scripts, tests) no hay caché que invalidar.
    }
  }
}

/** Invalida la ficha de un anuncio concreto en los dos idiomas. */
export function revalidarFichaProducto(slug?: string | null): void {
  if (!slug) return
  for (const ruta of [`/producto/${slug}`, `/en/producto/${slug}`]) {
    try {
      revalidatePath(ruta)
    } catch {
      // idem
    }
  }
}
