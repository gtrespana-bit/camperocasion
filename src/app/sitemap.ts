import type { MetadataRoute } from 'next'
import { getSupabaseServerClient } from '@/lib/supabase-server-client'
import fs from 'fs'
import path from 'path'
import { CIUDADES_SEO, CATEGORIAS_POPULARES } from '@/lib/ubicaciones-seo'
import { CATEGORIAS_SEO_LIST } from '@/lib/categorias-seo'
import { TIPOS_ITP } from '@/lib/itp'

const BASE_URL = 'https://camperocasion.online'
const LAST_MODIFIED_DATE = new Date('2026-09-15')

// ÚNICO sitemap del sitio. No crear otro en [locale]/.
// El blog vive en src/content/blog/*.md (fs), NO en una tabla de Supabase:
// la versión anterior consultaba `blog_posts` en la DB y devolvía 0 URLs.

function getBlogSlugs(): { slug: string; lastModified: Date }[] {
  const dir = path.join(process.cwd(), 'src/content/blog')
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const slug = f.replace(/\.md$/, '')
      let lastModified = LAST_MODIFIED_DATE
      try {
        const raw = fs.readFileSync(path.join(dir, f), 'utf-8')
        const m = raw.match(/^date:\s*(.+)$/m)
        if (m) {
          const d = new Date(m[1].trim())
          if (!isNaN(d.getTime())) lastModified = d
        }
      } catch {
        // usar fecha de contingencia
      }
      return { slug, lastModified }
    })
}

// Productos activos. Intenta leer `slug` (migración de URLs semánticas);
// si la columna aún no existe, cae a id para no dejar el sitemap vacío.
async function getProductos(supabase: any) {
  const moderacion = 'estado_moderacion.is.null,estado_moderacion.eq.aprobado'
  // Los anuncios de demostración (`es_demo`) quedan FUERA del sitemap: no son
  // inventario real, no deben competir en Google ni llenar el índice de
  // páginas sin valor. Si la migración 202609180003 no está aplicada, la
  // consulta falla y se reintenta sin el filtro para no dejar el sitemap vacío.
  const withSlug = await supabase
    .from('productos')
    .select('id, slug, user_id, actualizado_en')
    .eq('activo', true)
    .eq('es_demo', false)
    .or(moderacion)
    .limit(4000) // Reducir ligeramente para evitar límites de tamaño de sitemap

  if (!withSlug.error) return withSlug.data || []

  // Sin `es_demo` (migración 202609180003 aún sin aplicar): se reintenta
  // manteniendo el slug para no perder las URLs semánticas.
  const sinDemo = await supabase
    .from('productos')
    .select('id, slug, user_id, actualizado_en')
    .eq('activo', true)
    .or(moderacion)
    .limit(4000)

  if (!sinDemo.error) return sinDemo.data || []

  // Último recurso (sin `slug`): sitemap por id, mejor que vacío.
  const fallback = await supabase
    .from('productos')
    .select('id, user_id, actualizado_en')
    .eq('activo', true)
    .or(moderacion)
    .limit(4000)

  return fallback.data || []
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = getSupabaseServerClient()

  // ── URLs estáticas (páginas indexables y públicas) ──────────────────
  const staticPaths: { path: string; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }[] = [
    { path: '', changeFrequency: 'daily', priority: 1 },
    { path: '/catalogo', changeFrequency: 'daily', priority: 0.9 },
    { path: '/blog', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/publicar', changeFrequency: 'weekly', priority: 0.8 },
    { path: '/creditos', changeFrequency: 'weekly', priority: 0.7 },
    { path: '/calcular-itp', changeFrequency: 'monthly', priority: 0.9 },
    { path: '/compra-segura-camper', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/contrato-compraventa', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/gestoria-cambio-nombre', changeFrequency: 'monthly', priority: 0.7 },
    { path: '/marcas', changeFrequency: 'weekly', priority: 0.8 },
    // Landings por tipo de vendedor (Fase 3): indexan "comprar camper a
    // particulares / camperizadores / profesionales".
    { path: '/comprar-a-particulares', changeFrequency: 'daily', priority: 0.8 },
    { path: '/comprar-a-camperizadores', changeFrequency: 'daily', priority: 0.8 },
    { path: '/comprar-a-profesionales', changeFrequency: 'daily', priority: 0.8 },
    { path: '/como-funciona', changeFrequency: 'monthly', priority: 0.6 },
    { path: '/como-instalar-app', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/contacto', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/faq', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/sobre-nosotros', changeFrequency: 'monthly', priority: 0.5 },
    { path: '/terminos-y-condiciones', changeFrequency: 'yearly', priority: 0.3 },
    { path: '/politica-de-privacidad', changeFrequency: 'yearly', priority: 0.3 },
  ]

  // Solo se publican URLs en español. La versión /en permanece disponible
  // para usuarios, pero está fuera del índice mediante X-Robots-Tag.
  const staticUrls: MetadataRoute.Sitemap = staticPaths.map((p) => ({
    url: `${BASE_URL}${p.path}`,
    lastModified: LAST_MODIFIED_DATE,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }))

  // ── Categorías principales con URL canónica propia ───────────────────
  const categoryUrls: MetadataRoute.Sitemap = CATEGORIAS_SEO_LIST.map((categoria) => ({
    url: `${BASE_URL}/categoria/${categoria.slug}`,
    lastModified: LAST_MODIFIED_DATE,
    changeFrequency: 'daily' as const,
    priority: 0.9,
  }))

  // ── Landing pages de ciudad (SEO local) ──────────────────────────────
  const cityUrls: MetadataRoute.Sitemap = []
  CIUDADES_SEO.forEach((ciudad) => {
    cityUrls.push({
      url: `${BASE_URL}/${ciudad.slug}`,
      lastModified: LAST_MODIFIED_DATE,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })
  })

  // ── Landing pages ciudad + categoría (SEO programático) ──────────────
  const cityCategoryUrls: MetadataRoute.Sitemap = []
  for (const ciudad of CIUDADES_SEO) {
    for (const categoria of CATEGORIAS_POPULARES) {
      cityCategoryUrls.push({
        url: `${BASE_URL}/${ciudad.slug}/${categoria}`,
        lastModified: LAST_MODIFIED_DATE,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })
    }
  }

  // ── Landings de ITP por comunidad autónoma (SEO long tail:
  //    "impuesto comprar camper segunda mano {comunidad}") ────────────────
  const itpUrls: MetadataRoute.Sitemap = TIPOS_ITP.map((comunidad) => ({
    url: `${BASE_URL}/calcular-itp/${comunidad.slug}`,
    lastModified: LAST_MODIFIED_DATE,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }))

  // ── Blog (desde src/content/blog) ────────────────────────────────────
  const blogUrls: MetadataRoute.Sitemap = []
  getBlogSlugs().forEach((post) => {
    blogUrls.push({
      url: `${BASE_URL}/blog/${post.slug}`,
      lastModified: post.lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })
  })

  // ── Productos y vendedores (dinámico) ────────────────────────────────
  let dynamicUrls: MetadataRoute.Sitemap = []
  try {
    const productos = await getProductos(supabase)

    const productUrls: MetadataRoute.Sitemap = []
    productos.forEach((p: any) => {
      const rawDate = p.actualizado_en ? new Date(p.actualizado_en) : LAST_MODIFIED_DATE
      const validDate = isNaN(rawDate.getTime()) ? LAST_MODIFIED_DATE : rawDate

      productUrls.push({
        url: `${BASE_URL}/producto/${p.slug || p.id}`,
        lastModified: validDate,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })
    })

    // Vendedores con al menos un producto activo (perfiles indexables)
    const vendorIds = [
      ...new Set((productos as any[]).map((p) => p.user_id).filter(Boolean)),
    ].slice(0, 1000)
    
    const vendorUrls: MetadataRoute.Sitemap = []
    vendorIds.forEach((id) => {
      vendorUrls.push({
        url: `${BASE_URL}/vendedor/${id}`,
        lastModified: LAST_MODIFIED_DATE,
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      })
    })

    dynamicUrls = [...productUrls, ...vendorUrls]
  } catch {
    // Si Supabase falla, servir al menos las URLs estáticas
  }

  return [
    ...staticUrls,
    ...categoryUrls,
    ...cityUrls,
    ...cityCategoryUrls,
    ...itpUrls,
    ...blogUrls,
    ...dynamicUrls,
  ]
}
