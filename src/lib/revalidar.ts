import { revalidatePath } from 'next/cache'

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
 * Invalida las superficies públicas con listados de anuncios.
 *
 * Antes cada endpoint repetía su propia lista: `/api/publicar` invalidaba solo
 * la home y el catálogo en español (el listado inglés se quedaba con datos
 * viejos) y `/api/productos/editar` las cuatro. Centralizarlo evita que la
 * próxima ruta que toque anuncios se olvide de alguna.
 *
 * La home y el catálogo además declaran `revalidate = 600`, de modo que aunque
 * esta invalidación no llegara a ejecutarse (por ejemplo si el proceso muere
 * después de escribir en la base de datos) ninguna superficie queda congelada
 * más de 10 minutos.
 */
export function revalidarListadosPublicos(): void {
  for (const ruta of RUTAS_CATALOGO) {
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
