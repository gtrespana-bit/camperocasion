/**
 * GET /feed.xml — RSS 2.0 con los artículos del blog.
 *
 * Señal de frescura para rastreadores y puerta de entrada a Google
 * Discover. Los artículos salen del sistema de archivos (mismo origen
 * que el sitemap), sin tocar la base de datos.
 */
import fs from 'fs'
import path from 'path'

const BASE_URL = 'https://camperocasion.es'

export const revalidate = 3600
export const dynamic = 'force-static'

interface Post {
  slug: string
  title: string
  excerpt: string
  date: string
}

function getPosts(): Post[] {
  const dir = path.join(process.cwd(), 'src/content/blog')
  if (!fs.existsSync(dir)) return []

  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const slug = f.replace(/\.md$/, '')
      const raw = fs.readFileSync(path.join(dir, f), 'utf-8')
      const fm = (key: string) => {
        const m = raw.match(new RegExp(`^${key}:\\s*"?(.+?)"?\\s*$`, 'm'))
        return m ? m[1].trim() : ''
      }
      return {
        slug,
        title: fm('title') || slug,
        excerpt: fm('excerpt') || '',
        date: fm('date') || '2026-01-01',
      }
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 20)
}

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function GET() {
  const posts = getPosts()
  const items = posts
    .map(
      (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${BASE_URL}/blog/${p.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/blog/${p.slug}</guid>
      <description>${esc(p.excerpt)}</description>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
    </item>`,
    )
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blog de CamperOcasión — Compra y venta en España</title>
    <link>${BASE_URL}/blog</link>
    <description>Guías para vender más rápido, evitar estafas y conocer precios en España. Publica gratis en CamperOcasión.</description>
    <language>es-VE</language>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
