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
import { getSubcategoriaSEO, SUBCATEGORIAS_SEO } from './categorias-seo'
import { getPrecioEur } from './precio'

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
        .or(MODERACION)
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
      // Misma resolución de subcategoría que LandingCategoria: la URL usa
      // slugs, mientras productos.subcategoria guarda la etiqueta visible.
      const subcategoria = getSubcategoriaSEO(categoriaSlug)?.categoria
      if (!subcategoria) return false

      let q = supabase
        .from('productos')
        .select('id', { count: 'exact', head: true })
        .eq('activo', true)
        .or(MODERACION)
      q = municipio
        ? q.or(`ubicacion_ciudad.eq."${nombre}",ubicacion_ciudad.eq."${municipio}"`)
        : q.eq('ubicacion_ciudad', nombre)
      q = q.eq('subcategoria', subcategoria)

      const { count } = await q
      return (count || 0) > 0
    } catch {
      return true
    }
  },
)

// ── Estadísticas dinámicas para el contenido de las landings ─────────
//
// Las landings provinciales posicionan mejor (y evitan la penalización
// de contenido duplicado entre provincias) cuando el texto visible
// incluye datos reales de esta provincia: nº de anuncios, precio
// medio, rango de precios, subcategorías y marcas más frecuentes.
// Todo sale de la misma consulta paginada, sin inventar cifras.

export interface EstadisticasSubcategoria {
  slug: string
  nombre: string
  total: number
}

export interface EstadisticasCiudad {
  total: number
  /** Precio medio en € (null si no hay anuncios con precio). */
  precioMedio: number | null
  precioMin: number | null
  precioMax: number | null
  porSubcategoria: EstadisticasSubcategoria[]
  /** Marcas más frecuentes en la provincia (máx. 6). */
  porMarca: { marca: string; total: number }[]
}

const SUBCATEGORIA_POR_ETIQUETA = new Map(
  SUBCATEGORIAS_SEO.map((s) => [s.categoria, s]),
)

/**
 * Agregados de anuncios activos de una provincia (o provincia +
 * municipio). Fail-open: cualquier error devuelve ceros y la landing
 * simplemente omite las secciones dinámicas.
 */
export const estadisticasCiudad = cache(
  async (
    supabase: any,
    nombre: string,
    municipio?: string,
    /** Etiqueta visible de subcategoría (p. ej. "Gran Volumen").
     *  Si se pasa, los agregados se calculan solo para esa
     *  categoría en la provincia (landings /[ciudad]/[categoria]). */
    subcategoria?: string,
  ): Promise<EstadisticasCiudad> => {
    const vacio: EstadisticasCiudad = {
      total: 0,
      precioMedio: null,
      precioMin: null,
      precioMax: null,
      porSubcategoria: [],
      porMarca: [],
    }
    if (!supabase || !nombre) return vacio

    try {
      const baseQuery = (conDemo: boolean) => {
        let q = supabase
          .from('productos')
          .select('subcategoria, marca, precio_usd')
          .eq('activo', true)
          .or(MODERACION)
        // Excluir las muestras: sus precios no son reales y falsearían
        // el precio medio que mostramos al usuario (y a Google).
        if (conDemo) q = q.eq('es_demo', false)
        if (subcategoria) q = q.eq('subcategoria', subcategoria)
        q = municipio
          ? q.or(`ubicacion_ciudad.eq.\"${nombre}\",ubicacion_ciudad.eq.\"${municipio}\"`)
          : q.eq('ubicacion_ciudad', nombre)
        return q
      }

      // 2.000 filas bastan para agregados representativos de provincia
      // y evitan leer tablas gigantes en cada renderizado. Bases antiguas
      // sin la columna es_demo (migración 202609180003): reintentar
      // sin ese filtro antes de rendirnos.
      let response = await baseQuery(true).range(0, 1999)
      if (response.error && /es_demo/i.test(response.error.message || '')) {
        response = await baseQuery(false).range(0, 1999)
      }
      const { data, error } = response
      if (error || !data) return vacio

      const porSub = new Map<string, number>()
      const porMarca = new Map<string, number>()
      const precios: number[] = []

      for (const row of data) {
        const etiqueta = (row.subcategoria || '').trim()
        if (etiqueta) {
          porSub.set(etiqueta, (porSub.get(etiqueta) || 0) + 1)
        }
        const marca = (row.marca || '').trim()
        if (marca) {
          porMarca.set(marca, (porMarca.get(marca) || 0) + 1)
        }
        const precio = getPrecioEur(row)
        if (precio && precio > 0) precios.push(precio)
      }

      precios.sort((a, b) => a - b)
      const precioMedio =
        precios.length > 0
          ? Math.round(precios.reduce((s, p) => s + p, 0) / precios.length)
          : null

      return {
        total: data.length,
        precioMedio,
        precioMin: precios.length > 0 ? precios[0] : null,
        precioMax: precios.length > 0 ? precios[precios.length - 1] : null,
        porSubcategoria: [...porSub.entries()]
          .map(([etiqueta, total]) => {
            const seo = SUBCATEGORIA_POR_ETIQUETA.get(etiqueta)
            // Subcategorías sin landing SEO (si las hubiera) se omiten:
            // no tendrían URL a la que enlazar.
            return seo ? { slug: seo.slug, nombre: seo.nombre, total } : null
          })
          .filter((x): x is EstadisticasSubcategoria => Boolean(x))
          .sort((a, b) => b.total - a.total),
        porMarca: [...porMarca.entries()]
          .map(([marca, total]) => ({ marca, total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 6),
      }
    } catch {
      return vacio
    }
  },
)
