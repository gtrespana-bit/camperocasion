import { serializeJsonLd } from '@/lib/serialize-json-ld'
import type { Metadata } from 'next'
import LocalLink from '@/components/LocalLink'
import PublicHero from '@/components/editorial/PublicHero'
import fs from 'fs'
import path from 'path'
import { Calendar, ArrowRight, Clock, TrendingUp } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { limpiarComillas } from '@/lib/seo'

interface Post {
  slug: string
  title: string
  excerpt: string
  date: string
  readTime: string
  tags: string[]
  category: string
  featured?: boolean
}

function getPosts(): Post[] {
  const dir = path.join(process.cwd(), 'src/content/blog')
  if (!fs.existsSync(dir)) return []

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'))
  return files.map(file => {
    const content = fs.readFileSync(path.join(dir, file), 'utf-8')
    const slug = file.replace('.md', '')
    
    const titleMatch = content.match(/^title:\s*(.+)$/m)
    const excerptMatch = content.match(/^excerpt:\s*(.+)$/m)
    const dateMatch = content.match(/^date:\s*(.+)$/m)
    const readTimeMatch = content.match(/^readTime:\s*(.+)$/m)
    const tagsMatch = content.match(/^tags:\s*(.+)$/m)
    const categoryMatch = content.match(/^category:\s*(.+)$/m)
    const featuredMatch = content.match(/^featured:\s*(.+)$/m)

    return {
      slug,
      title: limpiarComillas(titleMatch?.[1]) || slug,
      excerpt: limpiarComillas(excerptMatch?.[1]),
      date: limpiarComillas(dateMatch?.[1]),
      readTime: limpiarComillas(readTimeMatch?.[1]) || '5 min',
      tags: tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : [],
      category: limpiarComillas(categoryMatch?.[1]) || 'General',
      featured: featuredMatch?.[1] === 'true',
    }
  }).sort((a, b) => {
    if (a.featured && !b.featured) return -1
    if (!a.featured && b.featured) return 1
    return b.date.localeCompare(a.date)
  })
}

export const metadata: Metadata = {
  title: 'Guías para comprar camper y autocaravana',
  description: 'Guías para comprar camper y autocaravana de ocasión: precios, camperización, homologación y consejos para elegir en España.',
  alternates: {
    canonical: 'https://camperocasion.online/blog',
    languages: {
      'es-ES': 'https://camperocasion.online/blog',
      'x-default': 'https://camperocasion.online/blog',
    },
    types: {
      'application/rss+xml': 'https://camperocasion.online/feed.xml',
    },
  },
  openGraph: {
    title: 'Guías para comprar camper y autocaravana',
    description: 'Guías de compra de campers y autocaravanas: precios, homologación y consejos para elegir.',
    url: 'https://camperocasion.online/blog',
    siteName: 'CamperOcasión',
    type: 'website',
    locale: 'es_ES',
  },
}

const categoryIcons: Record<string, string> = {
  'Precios': '💰',
  'Emprendimiento': '🚀',
  'Consejos': '💡',
  'Seguridad': '🛡️',
  'Tendencias': '📊',
}

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'blog' })
  const posts = getPosts()
  const featured = posts.filter(p => p.featured)
  const regular = posts.filter(p => !p.featured)

  const SITIO = 'https://camperocasion.online'
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITIO + '/' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: SITIO + '/blog' },
    ],
  }
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': SITIO + '/blog#collection',
    name: 'Blog de Compra y Venta en España',
    description: 'Guías, precios del mercado español y consejos para comprar y vender sin estafas.',
    url: SITIO + '/blog',
    isPartOf: { '@id': SITIO + '/#website' },
    breadcrumb: { '@id': SITIO + '/blog#breadcrumb' },
    mainEntity: posts.length > 0 ? { '@id': SITIO + '/blog#itemlist' } : undefined,
  }
  const itemListJsonLd = posts.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': SITIO + '/blog#itemlist',
    name: 'Artículos del blog',
    numberOfItems: posts.length,
    itemListElement: posts.map((post, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: SITIO + '/blog/' + post.slug,
      name: post.title,
    })),
  } : null
  const graphJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbJsonLd, collectionJsonLd, ...(itemListJsonLd ? [itemListJsonLd] : [])],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(graphJsonLd) }} />
      <div className="public-page min-h-screen">
        <PublicHero eyebrow="CamperOcasión" title={t('title')} description={t('subtitle')} />

      {/* Featured Posts */}
      {featured.length > 0 && (
        <section className="public-shell py-12 lg:py-20">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp size={20} className="text-brand-primary" />
            <h2 className="public-section-title text-night">{t('featured')}</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {featured.map(post => (
              <LocalLink key={post.slug} href={`/blog/${post.slug}`} className="group block public-card p-7 sm:p-8 transition duration-300 hover:-translate-y-1 hover:border-leaf hover:shadow-xl">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">{categoryIcons[post.category] || '📝'}</span>
                  <span className="text-xs font-semibold text-brand-primary bg-brand-accent/20 px-2 py-0.5 rounded-full">{post.category}</span>
                </div>
                <h3 className="public-card-title text-night group-hover:text-leaf-600 transition mb-3">{post.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{post.excerpt}</p>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Calendar size={12} /> {post.date}</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> {post.readTime}</span>
                </div>
              </LocalLink>
            ))}
          </div>
        </section>
      )}

      {/* All Posts */}
      <section className="public-shell py-12 lg:py-20 pb-16">
        {featured.length > 0 && (
          <h2 className="public-section-title text-night mb-8">{t('allArticles')}</h2>
        )}
        {regular.length === 0 && featured.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">{t('comingSoon')}</p>
          </div>
        )}
        <div className="grid md:grid-cols-3 gap-6">
          {regular.map(post => (
            <LocalLink key={post.slug} href={`/blog/${post.slug}`} className="group block public-card p-6 transition duration-300 hover:-translate-y-1 hover:border-leaf hover:shadow-xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">{categoryIcons[post.category] || '📝'}</span>
                <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{post.category}</span>
              </div>
              <h3 className="public-card-title text-night group-hover:text-leaf-600 transition mb-3">{post.title}</h3>
              <p className="text-sm text-gray-600 mb-4 line-clamp-3">{post.excerpt}</p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1"><Calendar size={12} /> {post.date}</span>
                <span className="flex items-center gap-1"><Clock size={12} /> {post.readTime}</span>
              </div>
              <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-brand-primary group-hover:translate-x-1 transition-transform">
                {t('readMore')} <ArrowRight size={14} />
              </div>
            </LocalLink>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-night py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="public-section-title text-white mb-4">{t('ctaTitle')}</h2>
          <p className="text-white/75 mb-8">{t('ctaDesc')}</p>
          <LocalLink href="/publicar" className="btn btn-green">
            {t('ctaButton')} <ArrowRight size={20} />
          </LocalLink>
        </div>
      </section>
    </div>
    </>
  )
}
