import type { MetadataRoute } from 'next'
import { hayDatosTitular } from '@/lib/datos-legales'
import { MARCAS_MODELOS, slugModelo } from '@/lib/marcas'
import { getSupabaseServerClient } from '@/lib/supabase-server-client'
import fs from 'fs'
import path from 'path'
import { CIUDADES_SEO, CATEGORIAS_POPULARES } from '@/lib/ubicaciones-seo'
import { CATEGORIAS_SEO_LIST, SUBCATEGORIAS_SEO } from '@/lib/categorias-seo'
import { TIPOS_ITP } from '@/lib/itp'

const BASE_URL = 'https://camperocasion.online'
const PAGE_SIZE = 1000

// El sitemap se regenera periódicamente para descubrir anuncios nuevos sin
// necesitar un despliegue. El de imágenes conserva su caché independiente.
export const revalidate = 21600

// El blog vive en src/content/blog/*.md, no en una tabla de Supabase.
function getBlogSlugs(): { slug: string; lastModified?: Date }[] {
  const dir = path.join(process.cwd(), 'src/content/blog')
  if (!fs.existsSync(dir)) return []

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const slug = file.replace(/\.md$/, '')
      try {
        const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
        const match = raw.match(/^date:\s*(.+)$/m)
        if (match) {
          const date = new Date(match[1].trim())
          if (!Number.isNaN(date.getTime())) return { slug, lastModified: date }
        }
      } catch {
        // Sin fecha válida, la URL se incluye sin inventar lastmod.
      }
      return { slug }
    })
}

/** Productos activos y aprobados, excluyendo muestras que tienen noindex. */
async function getProductos(supabase: any) {
  if (!supabase) return []

  const moderacion = 'estado_moderacion.is.null,estado_moderacion.eq.aprobado'
  const products: any[] = []
  let legacySchema = false

  // Supabase puede limitar una respuesta a 1.000 filas aunque el límite pedido
  // sea mayor; paginar evita dejar fuera anuncios del sitemap.
  for (let offset = 0; offset < 4000; offset += PAGE_SIZE) {
    let response = await supabase
      .from('productos')
      .select(legacySchema ? 'id, user_id, actualizado_en' : 'id, slug, user_id, actualizado_en')
      .eq('activo', true)
      .eq('es_demo', false)
      .or(moderacion)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    // Compatibilidad con instalaciones antiguas sin columna slug. Nunca se
    // reintenta sin es_demo: esos productos declaran noindex.
    if (response.error && !legacySchema && /slug/i.test(response.error.message || '')) {
      legacySchema = true
      response = await supabase
        .from('productos')
        .select('id, user_id, actualizado_en')
        .eq('activo', true)
        .eq('es_demo', false)
        .or(moderacion)
        .order('id', { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)
    }

    if (response.error) return []
    const page = response.data || []
    products.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return products
}

function normalize(value: string | null | undefined) {
  return (value || '')
    .trim()
    .toLocaleLowerCase('es-ES')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

type IndexableLandings = {
  cities: Set<string>
  cityCategories: Set<string>
}

function emptyLandings(): IndexableLandings {
  return { cities: new Set(), cityCategories: new Set() }
}

/**
 * Solo incluye landings locales que tienen al menos un anuncio visible. Se
 * consulta paginando para no depender del límite máximo de filas de Supabase.
 * Si la base de datos no está disponible, no se envían URLs locales vacías al
 * sitemap. Los anuncios de muestra siguen contando para la experiencia visual,
 * pero sus fichas se excluyen porque llevan noindex.
 */
async function getIndexableLandings(supabase: any): Promise<IndexableLandings> {
  if (!supabase) return emptyLandings()

  const cityByName = new Map<string, string>()
  for (const city of CIUDADES_SEO) {
    cityByName.set(normalize(city.nombre), city.slug)
    if (city.municipio) cityByName.set(normalize(city.municipio), city.slug)
  }

  const categoryByName = new Map(
    SUBCATEGORIAS_SEO.map((category) => [normalize(category.categoria), category.slug]),
  )
  const cities = new Set<string>()
  const cityCategories = new Set<string>()
  const moderation = 'estado_moderacion.is.null,estado_moderacion.eq.aprobado'

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('productos')
      .select('id, ubicacion_ciudad, subcategoria')
      .eq('activo', true)
      .or(moderation)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) return emptyLandings()

    for (const product of data || []) {
      const citySlug = cityByName.get(normalize(product.ubicacion_ciudad))
      if (!citySlug) continue
      cities.add(citySlug)

      const categorySlug = categoryByName.get(normalize(product.subcategoria))
      if (categorySlug && CATEGORIAS_POPULARES.includes(categorySlug)) {
        cityCategories.add(`${citySlug}/${categorySlug}`)
      }
    }

    if (!data || data.length < PAGE_SIZE) break
  }

  return { cities, cityCategories }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = getSupabaseServerClient()

  const staticPaths: {
    path: string
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
    priority: number
  }[] = [
    { path: '', changeFrequency: 'daily', priority: 1 },
    { path: '/catalogo', changeFrequency: 'daily', priority: 0.9 },
    { path: '/blog', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/publicar', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/creditos', changeFrequency: 'weekly', priority: 0.7 },
    { path: '/calcular-itp', changeFrequency: 'monthly', priority: 0.9 },
    { path: '/compra-segura-camper', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/contrato-compraventa', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/politica-de-privacidad', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/politica-de-cookies', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/terminos-y-condiciones', changeFrequency: 'yearly', priority: 0.3 },
    ...(hayDatosTitular()
      ? [{ path: '/aviso-legal', changeFrequency: 'yearly' as const, priority: 0.3 }]
      : []),
    { path: '/gestoria-cambio-nombre', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/marcas', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/tiendas', changeFrequency: 'daily', priority: 0.8 },
    { path: '/cuanto-vale-mi-camper', changeFrequency: 'monthly', priority: 0.9 },
    { path: '/comprar-a-particulares', changeFrequency: 'daily', priority: 0.8 },
    { path: '/comprar-a-camperizadores', changeFrequency: 'daily', priority: 0.8 },
    { path: '/comprar-a-profesionales', changeFrequency: 'daily', priority: 0.8 },
    { path: '/como-funciona', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/para-profesionales', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/como-instalar-app', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/contacto', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/faq', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/sobre-nosotros', changeFrequency: 'monthly', priority: 0.5 },
  ]

  // No se inventa una fecha común de última modificación para páginas que no
  // han cambiado. La portada canonical es / con barra final.
  const staticUrls: MetadataRoute.Sitemap = staticPaths.map((page) => ({
    url: page.path ? `${BASE_URL}${page.path}` : `${BASE_URL}/`,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }))

  const categoryUrls: MetadataRoute.Sitemap = CATEGORIAS_SEO_LIST.map((category) => ({
    url: `${BASE_URL}/categoria/${category.slug}`,
    changeFrequency: 'daily',
    priority: 0.9,
  }))

  const indexableLandings = await getIndexableLandings(supabase)
  const cityUrls: MetadataRoute.Sitemap = CIUDADES_SEO
    .filter((city) => indexableLandings.cities.has(city.slug))
    .map((city) => ({
      url: `${BASE_URL}/${city.slug}`,
      changeFrequency: 'weekly',
      priority: 0.7,
    }))

  const cityCategoryUrls: MetadataRoute.Sitemap = []
  for (const city of CIUDADES_SEO) {
    for (const category of CATEGORIAS_POPULARES) {
      if (!indexableLandings.cityCategories.has(`${city.slug}/${category}`)) continue
      cityCategoryUrls.push({
        url: `${BASE_URL}/${city.slug}/${category}`,
        changeFrequency: 'weekly',
        priority: 0.6,
      })
    }
  }

  const itpUrls: MetadataRoute.Sitemap = TIPOS_ITP.map((community) => ({
    url: `${BASE_URL}/calcular-itp/${community.slug}`,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  const blogUrls: MetadataRoute.Sitemap = getBlogSlugs().map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    ...(post.lastModified ? { lastModified: post.lastModified } : {}),
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  let dynamicUrls: MetadataRoute.Sitemap = []
  if (supabase) {
    try {
      const productos = await getProductos(supabase)
      const productUrls: MetadataRoute.Sitemap = productos.map((product: any) => {
        const lastModified = product.actualizado_en
          ? new Date(product.actualizado_en)
          : undefined
        const validLastModified = lastModified && !Number.isNaN(lastModified.getTime())
          ? lastModified
          : undefined

        return {
          url: `${BASE_URL}/producto/${product.slug || product.id}`,
          ...(validLastModified ? { lastModified: validLastModified } : {}),
          changeFrequency: 'weekly',
          priority: 0.8,
        }
      })

      const vendorIds = [
        ...new Set((productos as any[]).map((product) => product.user_id).filter(Boolean)),
      ].slice(0, 1000)
      const vendorUrls: MetadataRoute.Sitemap = vendorIds.map((id) => ({
        url: `${BASE_URL}/vendedor/${id}`,
        changeFrequency: 'weekly',
        priority: 0.5,
      }))

      const tiendaUrls: MetadataRoute.Sitemap = []
      const sellerIds = [...new Set((productos as any[]).map((product) => product.user_id).filter(Boolean))]
      if (sellerIds.length > 0) {
        const { data: tiendas, error: tiendasError } = await supabase
          .from('perfiles')
          .select('id, slug')
          .eq('tienda_activa', true)
          .not('slug', 'is', null)
          .in('id', sellerIds.slice(0, 1000))
          .limit(1000)

        if (!tiendasError) {
          for (const tienda of tiendas || []) {
            if (!tienda.slug) continue
            tiendaUrls.push({
              url: `${BASE_URL}/tienda/${tienda.slug}`,
              changeFrequency: 'daily',
              priority: 0.7,
            })
          }
        }
      }

      dynamicUrls = [...productUrls, ...vendorUrls, ...tiendaUrls]
    } catch {
      // Si Supabase falla, se mantienen las URLs estáticas y editoriales.
    }
  }

  const modeloUrls: MetadataRoute.Sitemap = MARCAS_MODELOS.map((model) => ({
    url: `${BASE_URL}/modelo/${slugModelo(model)}`,
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  return [
    ...staticUrls,
    ...modeloUrls,
    ...categoryUrls,
    ...cityUrls,
    ...cityCategoryUrls,
    ...itpUrls,
    ...blogUrls,
    ...dynamicUrls,
  ]
}
