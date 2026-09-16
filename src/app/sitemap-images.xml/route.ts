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

const BASE_URL = 'https://camperocasion.es'
const MAX_PRODUCTOS = 2000

export const revalidate = 21600
export const dynamic = 'force-static'

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function GET() {
  const supabase = getSupabaseServerClient()

  let entries: string[] = []
  try {
    const { data: productos } = await supabase!
      .from('productos')
      .select('id, slug, titulo, imagen_url, imagenes')
      .eq('activo', true)
      .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado')
      .limit(MAX_PRODUCTOS)

    for (const p of productos || []) {
      // Portada + galería (sin duplicados), máx. 3
      const imgs: string[] = []
      if (p.imagen_url) imgs.push(p.imagen_url)
      if (Array.isArray(p.imagenes)) {
        for (const u of p.imagenes) {
          if (typeof u === 'string' && u && !imgs.includes(u) && imgs.length < 3) imgs.push(u)
        }
      }
      if (imgs.length === 0) continue

      const imageTags = imgs
        .map(
          (u) =>
            `    <image:image>
      <image:loc>${esc(u)}</image:loc>
      <image:title>${esc(p.titulo)}</image:title>
    </image:image>`,
        )
        .join('\n')

      entries.push(`  <url>
    <loc>${BASE_URL}/producto/${esc(p.slug || p.id)}</loc>
${imageTags}
  </url>`)
    }
  } catch {
    // DB caída → sitemap vacío válido (mejor que un 500 que desautoriza el archivo)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
    },
  })
}
