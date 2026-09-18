import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import { ArrowRight, Search, Star, FileCheck, ShieldCheck, MapPin, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase-server-client'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import { productUrl } from '@/lib/product-url'
import { formatPrecio } from '@/lib/precio'
import { categoriasData, FAMILIAS } from '@/lib/categorias'
import { resumenFabricantes } from '@/lib/marcas'
import { CIUDADES_SEO } from '@/lib/ubicaciones-seo'

// ── Metadata ──────────────────────────────────────────────────────────────

function generateItemListSchema(products: any[], baseUrl: string) {
  if (!products || products.length === 0) return null

  const itemListElements = products.map((product, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    url: `${baseUrl}/producto/${product.slug || product.id}`,
    name: product.titulo,
    description: product.descripcion || `Camper de ocasión en España`,
    image: product.imagen_url || `${baseUrl}/placeholder-product.webp`,
    offers: {
      '@type': 'Offer',
      price: product.precio_usd || 0,
      priceCurrency: 'EUR',
      availability: product.activo ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'CamperOcasión',
      },
    },
  }))

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: itemListElements,
    numberOfItems: products.length,
    description: 'Furgonetas camper y autocaravanas de ocasión en España — CamperOcasión',
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params

  return {
    title: 'Furgonetas camper y autocaravanas de ocasión en España',
    description:
      'El marketplace especializado en furgonetas camper y autocaravanas de ocasión en España. Gran volumen, camper medianas, minicamper, perfiladas, capuchinas, integrales y 4x4 overland de 20.000 € a 80.000 €. Publica gratis.',
    keywords: [
      'furgonetas camper segunda mano',
      'autocaravanas de ocasión',
      'camper gran volumen',
      'minicamper de ocasión',
      'autocaravana integral usada',
      'camper 4x4 overland',
      'furgoneta camperizada España',
      'vehículo vivienda ocasión',
    ],
    authors: [{ name: 'CamperOcasión' }],
    creator: 'CamperOcasión',
    publisher: 'CamperOcasión',
    alternates: {
      canonical: 'https://camperocasion.online/',
      languages: {
        'es-ES': 'https://camperocasion.online/',
        'x-default': 'https://camperocasion.online/',
      },
    },
    openGraph: {
      title: 'Furgonetas camper y autocaravanas de ocasión en España',
      description:
        'El marketplace especializado en furgonetas camper y autocaravanas de ocasión en España. Publica gratis y encuentra tu próxima furgoneta camper.',
      url: 'https://camperocasion.online/',
      siteName: 'CamperOcasión',
      images: [
        {
          url: 'https://camperocasion.online/og-image.webp',
          width: 1200,
          height: 630,
          alt: 'CamperOcasión - Furgonetas camper y autocaravanas de ocasión en España',
        },
      ],
      locale: locale === 'en' ? 'en_US' : 'es_ES',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Furgonetas camper y autocaravanas de ocasión en España',
      description:
        'El marketplace especializado en furgonetas camper y autocaravanas de ocasión en España. Publica gratis.',
      images: ['https://camperocasion.online/og-image.webp'],
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

// ── Datos ─────────────────────────────────────────────────────────────────

const MODERACION = 'estado_moderacion.is.null,estado_moderacion.eq.aprobado'
const PRODUCT_COLS = 'id, slug, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, subcategoria, creado_en, boosteado_en, destacado, destacado_hasta, vendedor_tipo'

async function getProductos(limit = 8, subcategorias?: string[]) {
  if (!supabase) return []
  try {
    let q = supabase
      .from('productos')
      .select(PRODUCT_COLS)
      .eq('activo', true)
      .or(MODERACION)
      .order('creado_en', { ascending: false })
      .limit(limit)
    if (subcategorias && subcategorias.length === 1) {
      q = q.eq('subcategoria', subcategorias[0])
    } else if (subcategorias && subcategorias.length > 1) {
      q = q.in('subcategoria', subcategorias)
    }
    const { data, error } = await q
    if (error) return []
    const now = new Date().toISOString()
    return (data || []).sort((a: any, b: any) => {
      const aBoost = a.boosteado_en || null
      const bBoost = b.boosteado_en || null
      if (aBoost && !bBoost) return -1
      if (!aBoost && bBoost) return 1
      if (aBoost && bBoost) return bBoost.localeCompare(aBoost)
      const aDest = a.destacado && a.destacado_hasta && a.destacado_hasta > now
      const bDest = b.destacado && b.destacado_hasta && b.destacado_hasta > now
      if (aDest && !bDest) return -1
      if (!aDest && bDest) return 1
      if (aDest && bDest) return b.destacado_hasta.localeCompare(a.destacado_hasta)
      return (b.creado_en || '').localeCompare(a.creado_en || '')
    })
  } catch {
    return []
  }
}

/** Provincias más visitadas para el módulo de enlaces locales. */
function getProvinciasPopulares() {
  const slugs = ['madrid', 'barcelona', 'valencia', 'sevilla', 'malaga', 'alicante', 'murcia', 'asturias', 'baleares', 'las-palmas', 'santa-cruz-de-tenerife', 'zaragoza']
  return slugs
    .map(slug => CIUDADES_SEO.find(c => c.slug === slug))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
}

function relativeTime(iso?: string | null, t?: any): string | null {
  if (!iso || !t) return null
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return t('home.timeAgo.now')
  if (mins < 60) return t('home.timeAgo.minutes', { count: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('home.timeAgo.hours', { count: hours })
  const days = Math.floor(hours / 24)
  if (days < 7) return t('home.timeAgo.days', { count: days })
  return null
}

// ── Componentes ───────────────────────────────────────────────────────────

function ProductCard({ p, highlighted = false, priority = false, t }: { p: any; highlighted?: boolean; priority?: boolean; t: any }) {
  const imgUrl = p.imagen_url || '/placeholder-product.webp'
  const meta = [p.estado, p.ubicacion_ciudad || '', relativeTime(p.creado_en, t)].filter(Boolean).join(' · ')

  return (
    <LocalLink
      href={productUrl(p)}
      className={`bg-white rounded-xl overflow-hidden transition-all duration-200 group block border ${
        highlighted
          ? 'border-2 border-brand-accent shadow-lg hover:shadow-xl hover:-translate-y-1'
          : 'shadow-sm border-gray-100 hover:shadow-lg hover:-translate-y-1 hover:border-gray-200'
      }`}
    >
      <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
        {highlighted && (
          <div className="absolute top-2 left-2 z-10 bg-brand-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
            <Star size={10} /> {t('home.productCard.featured')}
          </div>
        )}
        <Image
          src={imgUrl}
          alt={p.titulo}
          fill
          sizes="(max-width: 480px) 45vw, (max-width: 768px) 45vw, (max-width: 1024px) 23vw, 320px"
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          priority={priority}
          fetchPriority={priority ? 'high' : 'auto'}
          quality={75}
        />
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate group-hover:text-brand-primary transition-colors">
          {p.titulo}
        </h3>
        <p className="text-xl font-black text-brand-primary mt-1">{formatPrecio(p.precio_usd)}</p>
        <p className="text-xs text-gray-500 mt-1 truncate">{meta}</p>
      </div>
    </LocalLink>
  )
}

function SectionHeader({ title, subtitle, href, viewAll, icon }: { title: string; subtitle?: string; href: string; viewAll: string; icon?: string }) {
  return (
    <div className="flex items-end justify-between mb-5 gap-3">
      <div>
        <h2 className="text-2xl md:text-3xl font-black text-gray-900">{icon ? `${icon} ` : ''}{title}</h2>
        {subtitle && <p className="text-gray-500 mt-1 text-sm md:text-base">{subtitle}</p>}
      </div>
      <LocalLink href={href} className="hidden sm:inline-flex items-center gap-1 text-sm font-bold text-brand-accent hover:text-brand-dark transition flex-shrink-0">
        {viewAll} <ArrowRight size={16} />
      </LocalLink>
    </div>
  )
}

function SectionGrid({ items, t }: { items: any[]; t: any }) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center text-gray-500">
        {t('home.sectionEmpty')}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((p, i) => (
        <ProductCard key={p.id} p={p} t={t} priority={i < 4} />
      ))}
    </div>
  )
}

// ── Página ────────────────────────────────────────────────────────────────

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  const [recientes, granVolumen, medianas, autocaravanas] = await Promise.all([
    getProductos(8),
    getProductos(8, ['Gran Volumen']),
    getProductos(8, ['Camper Mediana / Compacta']),
    getProductos(8, ['Autocaravana Perfilada', 'Autocaravana Capuchina', 'Autocaravana Integral']),
  ])

  const provincias = getProvinciasPopulares()
  const subs = categoriasData.camper.subs
  const jsonLd = generateItemListSchema(recientes, 'https://camperocasion.online')

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative bg-brand-primary text-white overflow-hidden">
        {/* Fotografía lifestyle de fondo + doble velo para legibilidad */}
        <Image
          src="/hero-camper.jpg"
          alt={t('home.hero.heroImageAlt')}
          fill
          priority
          quality={80}
          fetchPriority="high"
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-dark/95 via-brand-primary/85 to-brand-dark/30" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/70 via-transparent to-brand-dark/40" aria-hidden="true" />
        <div className="relative max-w-7xl mx-auto px-4 py-14 md:py-20">
          <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1 text-xs font-semibold mb-5">
            {t('home.hero.chip')}
          </span>
          <h1 className="text-4xl md:text-6xl font-black leading-tight max-w-3xl drop-shadow-sm">
            {t('home.hero.title1')} <span className="text-brand-accent-light">{t('home.hero.title2')}</span>
          </h1>
          <p className="mt-4 text-lg text-gray-100 max-w-2xl">{t('home.hero.subtitle')}</p>

          {/* Públicos: nadie debe dudar de que este mercado también es suyo */}
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              t('home.hero.audiencePrivate'),
              t('home.hero.audienceCamperizers'),
              t('home.hero.audiencePro'),
              t('home.hero.audienceBuyers'),
            ].map(a => (
              <span
                key={a}
                className="text-xs font-semibold bg-brand-dark/40 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1.5"
              >
                {a}
              </span>
            ))}
          </div>

          {/* CTAs duales: comprar / vender desde el primer segundo */}
          <div className="mt-6 flex flex-wrap gap-3">
            <LocalLink
              href="/catalogo"
              className="bg-brand-accent hover:bg-brand-accent-dark text-white font-bold px-6 py-3 rounded-xl transition shadow-lg"
            >
              🔍 {t('home.hero.findCamper')}
            </LocalLink>
            <LocalLink
              href="/publicar"
              className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/25 text-white font-bold px-6 py-3 rounded-xl transition"
            >
              📢 {t('home.hero.sellFree')}
            </LocalLink>
          </div>

          {/* Buscador: tipo + provincia + precio → /catalogo */}
          <form action="/catalogo" method="GET" className="mt-8 bg-white rounded-2xl p-3 shadow-2xl flex flex-col lg:flex-row gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 border-b lg:border-b-0 lg:border-r border-gray-200">
              <Search size={18} className="text-gray-400 shrink-0" />
              <input
                type="text"
                name="q"
                placeholder={t('home.hero.searchPlaceholder')}
                className="w-full py-3 text-sm text-gray-800 focus:outline-none"
                aria-label={t('home.hero.searchPlaceholder')}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <select name="subcategoria" className="px-3 py-2.5 text-sm text-gray-700 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-accent" aria-label={t('home.hero.filterType')}>
                <option value="">{t('home.hero.allTypes')}</option>
                {FAMILIAS.map(f => (
                  <optgroup key={f.key} label={`${f.icon} ${t(`familias.${f.key}.label`)}`}>
                    {f.subs.map(slug => {
                      const s = subs.find(x => x.slug === slug)
                      if (!s) return null
                      return <option key={s.slug} value={s.label}>{s.icon} {s.label}</option>
                    })}
                  </optgroup>
                ))}
              </select>
              <select name="ciudad" className="px-3 py-2.5 text-sm text-gray-700 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-accent" aria-label={t('home.hero.filterProvince')}>
                <option value="">{t('home.hero.allProvinces')}</option>
                {provincias.map(p => (
                  <option key={p.slug} value={p.nombre}>{p.nombre}</option>
                ))}
              </select>
            </div>
            <div className="flex sm:flex-col lg:flex-row gap-2">
              <input type="number" name="precioMin" min="0" placeholder={t('home.hero.priceMin')} className="w-full px-3 py-2.5 text-sm text-gray-700 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-accent" aria-label={t('home.hero.priceMin')} />
              <input type="number" name="precioMax" min="0" placeholder={t('home.hero.priceMax')} className="w-full px-3 py-2.5 text-sm text-gray-700 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-accent" aria-label={t('home.hero.priceMax')} />
            </div>
            <button type="submit" className="bg-brand-accent hover:bg-brand-accent-dark text-white font-bold px-8 py-3 rounded-xl transition flex items-center justify-center gap-2">
              <Search size={18} /> {t('home.hero.searchButton')}
            </button>
          </form>

          {/* Chips rápidos por tipo de vehículo */}
          <div className="mt-5 flex flex-wrap gap-2">
            {subs.map(s => (
              <LocalLink
                key={s.slug}
                href={`/catalogo?subcategoria=${encodeURIComponent(s.label)}`}
                className="text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/15 rounded-full px-3 py-1.5 transition"
              >
                {s.icon} {s.label}
              </LocalLink>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ CONFIANZA / STATS ═══════════ */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="flex items-center justify-center gap-3">
            <ShieldCheck size={28} className="text-brand-accent shrink-0" />
            <div className="text-left">
              <p className="font-black text-gray-900 text-sm">{t('home.stats.verified')}</p>
              <p className="text-xs text-gray-500">{t('home.stats.verifiedDesc')}</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <MapPin size={28} className="text-brand-accent shrink-0" />
            <div className="text-left">
              <p className="font-black text-gray-900 text-sm">{t('home.stats.allSpain')}</p>
              <p className="text-xs text-gray-500">{t('home.stats.allSpainDesc')}</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <FileCheck size={28} className="text-brand-accent shrink-0" />
            <div className="text-left">
              <p className="font-black text-gray-900 text-sm">{t('home.stats.homologation')}</p>
              <p className="text-xs text-gray-500">{t('home.stats.homologationDesc')}</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Star size={28} className="text-brand-orange shrink-0" />
            <div className="text-left">
              <p className="font-black text-gray-900 text-sm">{t('home.stats.free')}</p>
              <p className="text-xs text-gray-500">{t('home.stats.freeDesc')}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4">
        {/* ═══════════ FAMILIAS ═══════════ */}
        <section className="py-10">
          <SectionHeader title={t('home.categories.title')} subtitle={t('home.categories.subtitle')} href="/marcas" viewAll={t('home.categories.viewAll')} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {FAMILIAS.map(f => (
              <div
                key={f.key}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition p-6 flex flex-col"
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{f.icon}</span>
                  <h3 className="text-lg font-black text-gray-900 group-hover:text-brand-accent transition">
                    {t(`familias.${f.key}.label`)}
                  </h3>
                </div>
                <p className="text-sm text-gray-500 mt-2 mb-4 leading-relaxed">
                  {t(`familias.${f.key}.desc`)}
                </p>
                <div className="flex flex-wrap gap-2 mt-auto">
                  {f.subs.map(slug => {
                    const s = subs.find(x => x.slug === slug)
                    if (!s) return null
                    return (
                      <LocalLink
                        key={s.slug}
                        href={`/catalogo?subcategoria=${encodeURIComponent(s.label)}`}
                        title={resumenFabricantes(s.marcas, 4)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gray-50 hover:bg-green-50 hover:text-brand-primary border border-gray-200 hover:border-brand-accent rounded-full px-3 py-1.5 transition"
                      >
                        {s.icon} {s.label}
                      </LocalLink>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ ¿QUIÉN VENDE AQUÍ? ═══════════ */}
        <section className="pb-10">
          <SectionHeader
            title={t('home.audiences.title')}
            subtitle={t('home.audiences.subtitle')}
            href="/publicar"
            viewAll={t('home.audiences.viewAll')}
            icon="🤝"
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: '👤', key: 'private', vendedor: 'particular', plural: 'particulares' },
              { icon: '🔧', key: 'camperizer', vendedor: 'camperizador', plural: 'camperizadores' },
              { icon: '🏢', key: 'pro', vendedor: 'profesional', plural: 'profesionales' },
            ].map(a => (
              <div
                key={a.key}
                className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition p-6 flex flex-col"
              >
                <span className="w-12 h-12 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center text-2xl mb-4" aria-hidden="true">
                  {a.icon}
                </span>
                <h3 className="font-black text-gray-900 text-lg">{t(`home.audiences.${a.key}.title`)}</h3>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed flex-1">
                  {t(`home.audiences.${a.key}.desc`)}
                </p>
                <div className="mt-4 flex flex-col gap-1.5">
                  <LocalLink
                    href="/publicar"
                    className="inline-flex items-center gap-1 text-sm font-bold text-brand-accent hover:text-brand-dark transition"
                  >
                    {t('home.audiences.cta')} <ArrowRight size={14} />
                  </LocalLink>
                  {/* Enlace profundo al catálogo filtrado por tipo de vendedor
                      (Fase 3): también hay camino para el comprador. */}
                  <LocalLink
                    href={`/catalogo?vendedor=${a.vendedor}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-brand-primary transition"
                  >
                    {t('home.audiences.buyCta', { tipo: t(`tiposVendedor.${a.plural}`) })}
                  </LocalLink>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════ RECIENTES ═══════════ */}
        <section className="pb-10">
          <SectionHeader title={t('home.recent.title')} subtitle={t('home.recent.subtitle')} href="/catalogo" viewAll={t('home.recent.viewAll')} icon="🆕" />
          <SectionGrid items={recientes} t={t} />
        </section>

        {/* ═══════════ GRAN VOLUMEN ═══════════ */}
        <section className="pb-10">
          <SectionHeader title={t('home.granVolumen.title')} subtitle={t('home.granVolumen.subtitle')} href="/catalogo?subcategoria=Gran%20Volumen" viewAll={t('home.viewAll')} icon="🚐" />
          <SectionGrid items={granVolumen} t={t} />
        </section>

        {/* ═══════════ CAMPERS MEDIANAS ═══════════ */}
        <section className="pb-10">
          <SectionHeader title={t('home.medianas.title')} subtitle={t('home.medianas.subtitle')} href="/catalogo?subcategoria=Camper%20Mediana%20%2F%20Compacta" viewAll={t('home.viewAll')} icon="🏕️" />
          <SectionGrid items={medianas} t={t} />
        </section>

        {/* ═══════════ AUTOCARAVANAS ═══════════ */}
        <section className="pb-10">
          <SectionHeader title={t('home.autocaravanas.title')} subtitle={t('home.autocaravanas.subtitle')} href="/catalogo?subcategoria=Autocaravana%20Integral" viewAll={t('home.viewAll')} icon="🏭" />
          <SectionGrid items={autocaravanas} t={t} />
        </section>

        {/* ═══════════ PROVINCIAS POPULARES ═══════════ */}
        <section className="pb-12">
          <SectionHeader title={t('home.provinces.title')} subtitle={t('home.provinces.subtitle')} href="/catalogo" viewAll={t('home.viewAll')} icon="📍" />
          <div className="flex flex-wrap gap-2">
            {provincias.map(p => (
              <LocalLink
                key={p.slug}
                href={`/${p.slug}`}
                className="group flex items-center gap-1.5 bg-white border border-gray-200 hover:border-brand-accent hover:bg-green-50 rounded-full px-4 py-2 text-sm font-semibold text-gray-700 transition"
              >
                <MapPin size={14} className="text-brand-accent" />
                {t('home.provinces.link', { province: p.nombre })}
                <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition" />
              </LocalLink>
            ))}
          </div>
        </section>

        {/* ═══════════ CTA PUBLICAR ═══════════ */}
        <section className="pb-14">
          <div className="bg-gradient-to-r from-brand-primary to-brand-dark rounded-3xl p-8 md:p-12 text-white relative overflow-hidden">
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-brand-accent/20 rounded-full blur-3xl" aria-hidden="true" />
            <div className="absolute -left-10 -bottom-20 w-56 h-56 bg-brand-orange/20 rounded-full blur-3xl" aria-hidden="true" />
            <div className="relative max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-black">{t('home.cta.title')}</h2>
              <p className="mt-3 text-gray-200">{t('home.cta.subtitle')}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <LocalLink href="/publicar" className="bg-brand-accent hover:bg-brand-accent-dark text-white font-bold px-8 py-3.5 rounded-xl transition">
                  {t('home.cta.publishNow')}
                </LocalLink>
                <LocalLink href="/catalogo" className="border border-white/30 hover:bg-white/10 font-bold px-8 py-3.5 rounded-xl transition">
                  {t('home.cta.explore')}
                </LocalLink>
              </div>
              <p className="mt-4 text-xs text-gray-300">{t('home.cta.note')}</p>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
