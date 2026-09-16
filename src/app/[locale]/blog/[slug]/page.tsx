import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import LocalLink from '@/components/LocalLink'
import fs from 'fs'
import path from 'path'
import { ArrowLeft, Calendar, Clock, Tag, ArrowRight, ChevronRight } from 'lucide-react'

interface Post {
  slug: string
  title: string
  excerpt: string
  date: string
  readTime: string
  tags: string[]
  category: string
  content: string
  ogImage?: string
}

function getPostBySlug(slug: string): Post | null {
  const filePath = path.join(process.cwd(), 'src/content/blog', `${slug}.md`)
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf-8')
  
  const parts = raw.split('---\n')
  const frontmatterRaw = parts[1]
  const contentRaw = parts.slice(2).join('---\n').trim()

  const lines = frontmatterRaw.split('\n').filter(l => !l.startsWith('#'))
  const frontmatter: Record<string, string> = {}
  lines.forEach(line => {
    const colonIndex = line.indexOf(':')
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim()
      const value = line.substring(colonIndex + 1).trim()
      frontmatter[key] = value
    }
  })

  return {
    slug,
    title: frontmatter.title || slug,
    excerpt: frontmatter.excerpt || '',
    date: frontmatter.date || '',
    readTime: frontmatter.readTime || '5 min',
    tags: frontmatter.tags ? frontmatter.tags.split(',').map(t => t.trim()) : [],
    category: frontmatter.category || 'General',
    content: contentRaw,
    ogImage: frontmatter.ogImage,
  }
}

function getAllSlugs(): string[] {
  const dir = path.join(process.cwd(), 'src/content/blog')
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''))
}

export function generateStaticParams(): { slug: string }[] {
  return getAllSlugs().map(slug => ({ slug }))
}

export async function generateMetadata(props: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params
  const post = getPostBySlug(slug)
  if (!post) return { title: 'Post no encontrado' }

  return {
    title: post.title,
    description: post.excerpt,
    alternates: {
      canonical: `https://camperocasion.es/blog/${post.slug}`,
      languages: {
        'es-VE': `https://camperocasion.es/blog/${post.slug}`,
        'x-default': `https://camperocasion.es/blog/${post.slug}`,
      },
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://camperocasion.es/blog/${post.slug}`,
      siteName: 'CamperOcasión',
      type: 'article',
      locale: 'es_ES',
    },
  }
}

function generateArticleSchema(post: Post) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.excerpt,
    "datePublished": post.date,
    "dateModified": post.date,
    "author": {
      "@type": "Organization",
      "name": "CamperOcasión.es",
      "url": "https://camperocasion.es"
    },
    "publisher": {
      "@type": "Organization",
      "name": "CamperOcasión.es",
      "url": "https://camperocasion.es",
      "logo": {
        "@type": "ImageObject",
        "url": "https://camperocasion.es/logo.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://camperocasion.es/blog/${post.slug}`
    },
    "articleSection": post.category,
    "keywords": post.tags.join(', '),
    "inLanguage": "es-VE"
  }
}

function inlineFormat(text: string): string {
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
  text = text.replace(/_(.+?)_/g, '<em>$1</em>')
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-brand-primary font-semibold hover:underline underline-offset-2">$1</a>')
  return text
}

function renderMarkdown(content: string): string {
  const blocks = content.split(/\n\n+/)
  const htmlParts: string[] = []

  for (const rawBlock of blocks) {
    const lines = rawBlock.trim().split('\n')

    // Table detection
    if (lines.length >= 2 && lines[0].startsWith('|') && lines[1].startsWith('|')) {
      const headerCells = lines[0].split('|').filter(c => c.trim() !== '')
      const dataLines = lines.slice(2).filter(l => l.trim().startsWith('|'))
      
      htmlParts.push('<div class="overflow-x-auto my-6 rounded-xl border border-gray-200 shadow-sm">')
      htmlParts.push('<table class="w-full text-sm">')
      // Header
      htmlParts.push('<thead class="bg-brand-primary text-white">')
      htmlParts.push('<tr>')
      for (const cell of headerCells) {
        htmlParts.push(`<th class="px-4 py-3 font-bold text-left whitespace-nowrap">${inlineFormat(cell.trim())}</th>`)
      }
      htmlParts.push('</tr></thead>')
      // Body
      htmlParts.push('<tbody class="divide-y divide-gray-100">')
      for (const dl of dataLines) {
        const cells = dl.split('|').filter(c => c.trim() !== '')
        htmlParts.push('<tr class="hover:bg-gray-50/50">')
        for (const cell of cells) {
          htmlParts.push(`<td class="px-4 py-3 text-gray-700 whitespace-nowrap">${inlineFormat(cell.trim())}</td>`)
        }
        htmlParts.push('</tr>')
      }
      htmlParts.push('</tbody></table></div>')
      continue
    }

    // Headers
    if (lines[0].startsWith('# ')) {
      htmlParts.push(`<h1 class="text-3xl font-black text-gray-900 mt-8 mb-6">${inlineFormat(lines[0].replace('# ', ''))}</h1>`)
      continue
    }
    if (lines[0].startsWith('## ')) {
      htmlParts.push(`<h2 class="text-2xl font-bold text-gray-800 mt-10 mb-4">${inlineFormat(lines[0].replace('## ', ''))}</h2>`)
      continue
    }
    if (lines[0].startsWith('### ')) {
      htmlParts.push(`<h3 class="text-xl font-bold text-gray-800 mt-8 mb-4">${inlineFormat(lines[0].replace('### ', ''))}</h3>`)
      continue
    }

    // Blockquote
    if (lines[0].startsWith('> ')) {
      const quoteText = lines.map(l => l.replace(/^> ?/, '')).join(' ')
      htmlParts.push(`<blockquote class="border-l-4 border-brand-accent bg-brand-accent/5 rounded-r-lg pl-5 py-4 my-6"><p class="text-gray-700 italic text-sm leading-relaxed">${inlineFormat(quoteText)}</p></blockquote>`)
      continue
    }

    // Numbered list
    if (lines.length > 0 && lines[0].match(/^\d+\. /)) {
      htmlParts.push('<ol class="space-y-3 my-4 list-none counter-reset: step">')
      let idx = 0
      for (const line of lines) {
        idx++
        const text = line.replace(/^\d+\. /, '')
        htmlParts.push(`<li class="flex items-start gap-3 text-gray-700"><span class="flex-shrink-0 w-7 h-7 rounded-full bg-brand-primary text-white text-sm font-bold flex items-center justify-center">${idx}</span><span class="leading-relaxed">${inlineFormat(text)}</span></li>`)
      }
      htmlParts.push('</ol>')
      continue
    }

    // Unordered list
    if (lines.length > 0 && lines[0].match(/^- /)) {
      htmlParts.push('<ul class="space-y-2 my-4">')
      for (const line of lines) {
        const text = line.replace(/^- /, '')
        htmlParts.push(`<li class="flex items-start gap-2 text-gray-700"><span class="text-brand-primary mt-1">•</span><span class="leading-relaxed">${inlineFormat(text)}</span></li>`)
      }
      htmlParts.push('</ul>')
      continue
    }

    // Horizontal rule
    if (lines[0].match(/^---$/)) {
      htmlParts.push('<hr class="my-8 border-gray-200" />')
      continue
    }

    // Regular paragraph
    const paraText = lines.join(' ')
    if (paraText.trim()) {
      htmlParts.push(`<p class="text-gray-700 leading-relaxed my-4">${inlineFormat(paraText)}</p>`)
    }
  }

  return htmlParts.join('\n')
}

// Static pages for SSR
export default async function BlogPost(props: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await props.params
  setRequestLocale(locale)
  const post = getPostBySlug(slug)
  const t = await getTranslations({ locale, namespace: 'blog' })

  if (!post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">{t('postNotFound')}</h1>
        <LocalLink href="/blog" className="text-brand-primary hover:underline">
          ← {t('backToBlog')}
        </LocalLink>
      </div>
    )
  }

  const categoryIcons: Record<string, string> = {
    'Precios': '💰',
    'Emprendimiento': '🚀',
    'Consejos': '💡',
    'Seguridad': '🛡️',
    'Tendencias': '📊',
  }

  const htmlContent = renderMarkdown(post.content)
  const articleSchema = generateArticleSchema(post)

  return (
    <article className="min-h-screen bg-white">
      {/* Article Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      
      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <LocalLink href="/" className="hover:text-brand-primary">{t('home')}</LocalLink>
            <ChevronRight size={14} />
            <LocalLink href="/blog" className="hover:text-brand-primary">Blog</LocalLink>
            <ChevronRight size={14} />
            <span className="text-gray-800 truncate">{post.title}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-primary to-brand-dark py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4">
          <LocalLink href="/blog" className="inline-flex items-center gap-2 text-blue-200 hover:text-white mb-6 transition">
            <ArrowLeft size={16} /> {t('backToBlog')}
          </LocalLink>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">{categoryIcons[post.category] || '📝'}</span>
            <span className="text-sm font-semibold text-brand-accent bg-brand-accent/20 px-3 py-1 rounded-full">{post.category}</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-black text-white mb-4 leading-tight">{post.title}</h1>
          <p className="text-lg text-blue-200 mb-6">{post.excerpt}</p>
          <div className="flex items-center gap-6 text-sm text-white/60">
            <span className="flex items-center gap-2"><Calendar size={14} /> {post.date}</span>
            <span className="flex items-center gap-2"><Clock size={14} /> {post.readTime}</span>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div 
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="mt-10 pt-6 border-t">
            <div className="flex items-center gap-2 flex-wrap">
              {post.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  <Tag size={12} /> {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <section className="bg-brand-dark py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-black text-white mb-3">{t('haveSomething')}</h2>
          <p className="text-gray-500 mb-6">{t('publishFreeDesc')}</p>
          <LocalLink href="/publicar" className="inline-flex items-center gap-2 bg-brand-accent text-white px-8 py-3 rounded-xl font-bold text-lg hover:bg-accent/90 transition shadow-lg">
            {t('publishFree')} <ArrowRight size={20} />
          </LocalLink>
        </div>
      </section>

      {/* More posts */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h3 className="text-xl font-bold text-gray-800 mb-6">{t('moreArticles')}</h3>
        <div className="grid md:grid-cols-2 gap-6">
          {getAllSlugs()
            .filter(s => s !== slug)
            .slice(0, 2)
            .map(s => {
              const other = getPostBySlug(s)
              if (!other) return null
              return (
                <LocalLink key={s} href={`/blog/${s}`} className="group block bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg transition">
                  <h4 className="font-bold text-gray-800 group-hover:text-brand-primary mb-2">{other.title}</h4>
                  <p className="text-sm text-gray-600 line-clamp-2">{other.excerpt}</p>
                </LocalLink>
              )
            })}
        </div>
      </section>

      {/* Enlaces internos al marketplace: la autoridad del blog debe terminar
          en categorías/búsquedas reales, no evaporarse al salir del artículo. */}
      <section className="max-w-4xl mx-auto px-4 pb-12">
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{t('exploreTitle')}</h3>
          <div className="flex flex-wrap gap-2">
            {(post.tags || [])
              .map((tag) => tag.toLowerCase())
              .map((tag) => {
                if (/iphone|celular|tel[eé]fono|laptop|tecnolog|electr[oó]|comput|samsung/.test(tag)) {
                  return { label: `💻 ${t('catTech')}`, href: '/categoria/tecnologia' }
                }
                if (/carro|veh[ií]cul|moto|auto/.test(tag)) return { label: `🚗 ${t('catVehicles')}`, href: '/categoria/vehiculos' }
                if (/ropa|moda|zapato|ropa usada|calzado|vestir/.test(tag)) return { label: `👗 ${t('catFashion')}`, href: '/categoria/moda' }
                if (/mueble|hogar|casa|sof|electro/.test(tag)) return { label: `🛋 ${t('catHome')}`, href: '/categoria/hogar' }
                if (/herramient|taladro|construcci|obra/.test(tag)) return { label: `🔧 ${t('catTools')}`, href: '/categoria/herramientas' }
                return null
              })
              .filter((v, i, a) => v && a.findIndex(x => x && x.href === v.href) === i)
              .slice(0, 3)
              .map((l: { label: string; href: string } | null) =>
                l ? (
                  <LocalLink
                    key={l.href}
                    href={l.href}
                    className="bg-white border border-gray-200 text-gray-800 text-sm font-semibold px-4 py-2 rounded-full hover:border-brand-accent hover:text-brand-primary transition"
                  >
                    {l.label}
                  </LocalLink>
                ) : null
              )}
            <LocalLink
              href="/catalogo"
              className="bg-brand-primary text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-brand-dark transition"
            >
              🔍 {t('catCatalog')}
            </LocalLink>
            <LocalLink
              href="/publicar"
              className="bg-brand-accent text-gray-900 text-sm font-bold px-4 py-2 rounded-full hover:brightness-95 transition"
            >
              📢 {t('catPublish')}
            </LocalLink>
          </div>
        </div>
      </section>
    </article>
  )
}
