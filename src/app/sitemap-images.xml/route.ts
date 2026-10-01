/**
 * GET /sitemap-images.xml — sitemap de imágenes (productos).
 *
 * El sitemap normal (app/sitemap.ts) no soporta el namespace
 * <image:image> del estándar de Google, por eso va en un route handler.
 * Google Imágenes es una vía de entrada grande para clasificados: la
 * gente busca "iphone 13" en imágenes y aterriza en el anuncio.
 *
 * Hasta 3 fotos por producto (portada + 2 de la galería), máx. 2.000
 * productos por sitemap. Cacheado 6 h.
 */
import { getSupabaseServerClient } from '@/lib/supabase-server-client'

const BASE_URL = 'https://camperocasion.online'
const MAX_PRODUCTOS = 2000

export const revalidate = 21600
export const dynamic = 'force-static'

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function GET() {
  const entries: string[] = []

  try {
    const supabase = getSupabaseServerClient()
    if (supabase) {
      const productos: any[] = []
      for (let offset = 0; offset < MAX_PRODUCTOS; offset += 1000) {
        const pageSize = Math.min(1000, MAX_PRODUCTOS - offset)
        const { data, error } = await supabase
          .from('productos')
          .select('id, slug, titulo, imagen_url, imagenes, es_demo')
          .eq('activo', true)
          // Las muestras se conservan en el catálogo visual, pero las fichas llevan
          // noindex: no deben alimentar el índice de imágenes de Google.
          .eq('es_demo', false)
          .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado')
          .order('id', { ascending: true })
          .range(offset, offset + pageSize - 1)

        if (error) throw error
        productos.push(...(data || []))
        if (!data || data.length < pageSize) break
      }

      for (const p of productos) {
        // Portada + galería (sin duplicados), máx. 3
        const imgs: string[] = []
        if (typeof p.imagen_url === 'string' && p.imagen_url) imgs.push(p.imagen_url)
        if (Array.isArray(p.imagenes)) {
          for (const u of p.imagenes) {
            if (typeof u === 'string' && u && !imgs.includes(u) && imgs.length < 3) imgs.push(u)
          }
        }
        if (imgs.length === 0) continue

        const imageTitle =
          typeof p.titulo === 'string' && p.titulo
            ? `\n      <image:title>${esc(p.titulo)}</image:title>`
            : ''
        const imageTags = imgs
          .map(
            (u) =>
              `    <image:image>
      <image:loc>${esc(u)}</image:loc>${imageTitle}
    </image:image>`,
          )
          .join('\n')

        entries.push(`  <url>
    <loc>${BASE_URL}/producto/${esc(String(p.slug || p.id))}</loc>
${imageTags}
  </url>`)
      }
    }
  } catch (error) {
    // Mantener XML servible incluso si la inicialización o consulta de Supabase falla.
    console.error('[sitemap-images] No se pudo consultar productos:', error)
  }

  // Google exige al menos un <url> dentro de <urlset>. Sin anuncios con fotos,
  // usar la portada evita publicar un sitemap XML estructuralmente vacío.
  const urlEntries = entries.length > 0
    ? entries.join('\n')
    : `  <url>\n    <loc>${BASE_URL}/</loc>\n  </url>`

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urlEntries}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
    },
  })
}
