/**
 * Helpers de SEO para las landings programáticas (ciudad y ciudad/categoría).
 *
 * Deciden si una landing se indexa: una página de ciudad SIN anuncios es
 * contenido vacío que diluye la calidad del dominio a ojos de Google
 * (330 ciudades × 8 categorías = ~2.640 URLs potenciales). La regla:
 * con inventario → index; sin inventario → noindex,follow (se rastrea,
 * y se indexa sola cuando aparezca el primer anuncio).
 *
 * Fail-open: si Supabase falla o no está configurado, se indexa (mejor
 * una página vacía de más que desindexar el sitio entero por un timeout).
 */
import { cache } from 'react'

const MODERACION = 'estado_moderacion.is.null,estado_moderacion.eq.aprobado'

/** ¿Hay al menos un anuncio activo en esta ciudad (o su municipio)? */
export const hayAnunciosEnCiudad = cache(
  async (supabase: any, nombre: string, municipio?: string): Promise<boolean> => {
    if (!supabase || !nombre) return true
    try {
      // Mismo filtro efectivo que muestra LandingCiudad
      let q = supabase
        .from('productos')
        .select('id', { count: 'exact', head: true })
        .eq('activo', true)
      q = municipio
        ? q.or(`ubicacion_ciudad.eq."${nombre}",ubicacion_ciudad.eq."${municipio}"`)
        : q.eq('ubicacion_ciudad', nombre)

      const { count } = await q
      return (count || 0) > 0
    } catch {
      return true
    }
  },
)

/** ¿Hay anuncios de esta categoría (slug de categorias o subcategoría) en la ciudad? */
export const hayAnunciosEnCiudadCategoria = cache(
  async (
    supabase: any,
    nombre: string,
    municipio: string | undefined,
    categoriaSlug: string,
  ): Promise<boolean> => {
    if (!supabase || !nombre) return true
    try {
      // Misma resolución de categoría que LandingCategoria
      const { data: catRow } = await supabase
        .from('categorias')
        .select('id')
        .eq('nombre', categoriaSlug)
        .maybeSingle()

      let q = supabase
        .from('productos')
        .select('id', { count: 'exact', head: true })
        .eq('activo', true)
        .or(MODERACION)
      q = municipio
        ? q.or(`ubicacion_ciudad.eq."${nombre}",ubicacion_ciudad.eq."${municipio}"`)
        : q.eq('ubicacion_ciudad', nombre)
      q = catRow ? q.eq('categoria_id', catRow.id) : q.eq('subcategoria', categoriaSlug)

      const { count } = await q
      return (count || 0) > 0
    } catch {
      return true
    }
  },
)
