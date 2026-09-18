import type { Metadata } from 'next'
import LocalLink from '@/components/LocalLink'
import fs from 'fs'
import path from 'path'
import { Calendar, ArrowRight, Clock, TrendingUp } from 'lucide-react'
import { getTranslations, setRequestLocale } from 'next-intl/server'

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
      title: titleMatch?.[1] || slug,
      excerpt: excerptMatch?.[1] || '',
      date: dateMatch?.[1] || '',
      readTime: readTimeMatch?.[1] || '5 min',
      tags: tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : [],
      category: categoryMatch?.[1] || 'General',
      featured: featuredMatch?.[1] === 'true',
    }
  }).sort((a, b) => {
    if (a.featured && !b.featured) return -1
    if (!a.featured && b.featured) return 1
    return b.date.localeCompare(a.date)
  })
}

export const metadata: Metadata = {
  title: 'Blog de Compra y Venta en España',
  description: 'Guías, precios del mercado español y consejos para comprar y vender sin estafas. Todo sobre emprendimiento y comercio electrónico en España.',
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
    title: 'Blog de Compra y Venta en España',
    description: 'Guías del mercado español, consejos para emprendedores y mucho más.',
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

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-primary to-brand-dark py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4">
            {t('title')} <span className="text-brand-accent">CamperOcasión</span>
          </h1>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>
      </section>

      {/* Featured Posts */}
      {featured.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp size={20} className="text-brand-primary" />
            <h2 className="text-xl font-bold text-gray-800">{t('featured')}</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {featured.map(post => (
              <LocalLink key={post.slug} href={`/blog/${post.slug}`} className="group block bg-gradient-to-br from-brand-primary/5 to-brand-accent/5 rounded-2xl border-2 border-brand-accent/20 p-6 hover:border-brand-accent/40 transition shadow-sm hover:shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">{categoryIcons[post.category] || '📝'}</span>
                  <span className="text-xs font-semibold text-brand-primary bg-brand-accent/20 px-2 py-0.5 rounded-full">{post.category}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-800 group-hover:text-brand-primary transition mb-2">{post.title}</h3>
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
      <section className="max-w-7xl mx-auto px-4 py-8 pb-16">
        {featured.length > 0 && (
          <h2 className="text-xl font-bold text-gray-800 mb-6">{t('allArticles')}</h2>
        )}
        {regular.length === 0 && featured.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">{t('comingSoon')}</p>
          </div>
        )}
        <div className="grid md:grid-cols-3 gap-6">
          {regular.map(post => (
            <LocalLink key={post.slug} href={`/blog/${post.slug}`} className="group block bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition hover:border-brand-accent/30">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">{categoryIcons[post.category] || '📝'}</span>
                <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{post.category}</span>
              </div>
              <h3 className="text-lg font-bold text-gray-800 group-hover:text-brand-primary transition mb-2">{post.title}</h3>
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
      <section className="bg-brand-dark py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-black text-white mb-3">{t('ctaTitle')}</h2>
          <p className="text-gray-500 mb-6">{t('ctaDesc')}</p>
          <LocalLink href="/publicar" className="inline-flex items-center gap-2 bg-brand-accent text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-accent/90 transition shadow-lg">
            {t('ctaButton')} <ArrowRight size={20} />
          </LocalLink>
        </div>
      </section>
    </div>
  )
}
