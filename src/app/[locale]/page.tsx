import { serializeJsonLd } from '@/lib/serialize-json-ld'
import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { supabase } from '@/lib/supabase-server-client'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import { productUrl } from '@/lib/product-url'
import { formatPrecio } from '@/lib/precio'
import { alternatesSeo } from '@/lib/seo'
import { categoriasData, FAMILIAS } from '@/lib/categorias'
import { resumenFabricantes, agruparPorFabricante, MARCAS_MODELOS } from '@/lib/marcas'
import { FILTROS_TECNICOS } from '@/lib/filtros-tecnicos'
import { CIUDADES_SEO } from '@/lib/ubicaciones-seo'
import { aplicarOrdenCatalogo, ordenarProductosCatalogo } from '@/lib/catalog-consulta'
import Reveal from '@/components/home/Reveal'
import CountUp from '@/components/home/CountUp'
import HeroSearch from '@/components/home/HeroSearch'
import SmoothScroll from '@/components/home/SmoothScroll'
import HeroFx from '@/components/home/HeroFx'
import ScrollWords, { type Word } from '@/components/home/ScrollWords'
import FamilyPanels, { type FamilyPanel } from '@/components/home/FamilyPanels'
import Showroom, { type RailItem, type RailTab } from '@/components/home/Showroom'
import Journey, { type JourneyStep } from '@/components/home/Journey'
import fs from 'fs'
import path from 'path'

// ── Metadata ──────────────────────────────────────────────────────────────

function generateItemListSchema(products: any[], baseUrl: string) {
  // Los anuncios sembrados por la plataforma siguen visibles en las tarjetas
  // (sin ninguna etiqueta que los distinga), pero sus fichas llevan noindex y
  // no deben declararse como ofertas reales en datos estructurados: describir
  // un vehículo que no está en venta como una oferta en Stock en el JSON-LD sí
  // sería un problema.
  const indexableProducts = (products || []).filter((product) => product.es_demo !== true)
  if (indexableProducts.length === 0) return null

  const itemListElements = indexableProducts.map((product, index) => ({
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
    numberOfItems: indexableProducts.length,
    description: 'Furgonetas camper y autocaravanas de ocasión en España — CamperOcasión',
  }
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params

  return {
    title: 'Furgonetas camper y autocaravanas de ocasión',
    description:
      'Marketplace especializado en furgonetas camper y autocaravanas de ocasión en España. Gran volumen, medianas, minicamper, perfiladas y 4x4. Publica gratis.',
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
    alternates: alternatesSeo('/'),
    openGraph: {
      title: 'Furgonetas camper y autocaravanas de ocasión',
      description:
        'Marketplace especializado en furgonetas camper y autocaravanas de ocasión en España. Publica gratis y encuentra tu próxima camper.',
      url: 'https://camperocasion.online',
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
      title: 'Furgonetas camper y autocaravanas de ocasión',
      description:
        'Marketplace especializado en furgonetas camper y autocaravanas de ocasión en España. Publica gratis.',
      images: ['https://camperocasion.online/og-image.webp'],
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

// La home lista anuncios recién publicados: sin `revalidate` se prerenderizaba
// una sola vez y el CDN la servía con `s-maxage=31536000`, así que un anuncio
// nuevo no aparecía hasta el siguiente despliegue. Con 10 minutos (el mismo
// margen que /catalogo) la portada se refresca sola y, además, cada publicación
// la invalida al instante con `revalidarListadosPublicos()`.
export const revalidate = 600

// ── Datos ─────────────────────────────────────────────────────────────────

const MODERACION = 'estado_moderacion.is.null,estado_moderacion.eq.aprobado'
const PRODUCT_COLS = 'id, slug, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, subcategoria, creado_en, boosteado_en, destacado, destacado_hasta, vendedor_tipo, es_demo'

async function getProductos(limit = 8, subcategorias?: string[]) {
  if (!supabase) return []
  try {
    let q = supabase
      .from('productos')
      .select(PRODUCT_COLS)
      .eq('activo', true)
      .or(MODERACION)
    if (subcategorias && subcategorias.length === 1) {
      q = q.eq('subcategoria', subcategorias[0])
    } else if (subcategorias && subcategorias.length > 1) {
      q = q.in('subcategoria', subcategorias)
    }
    // El ORDER BY va en SQL (no solo en memoria): si solo ordenáramos los N
    // más recientes, un boost sobre un anuncio antiguo no llegaría a portada.
    const { data, error } = await aplicarOrdenCatalogo(q).limit(limit)
    if (error) return []
    return ordenarProductosCatalogo((data || []) as any)
  } catch {
    return []
  }
}

/** Anuncios activos y visibles (cifra real para la banda de datos). */
async function getTotalActivos(): Promise<number> {
  if (!supabase) return 0
  try {
    const { count, error } = await supabase
      .from('productos')
      .select('id', { count: 'exact', head: true })
      .eq('activo', true)
      .or(MODERACION)
    return error ? 0 : count || 0
  } catch {
    return 0
  }
}

/** Provincias más visitadas para el módulo de enlaces locales. */
function getProvinciasPopulares() {
  const slugs = ['madrid', 'barcelona', 'valencia', 'sevilla', 'malaga', 'alicante', 'murcia', 'asturias', 'baleares', 'las-palmas', 'santa-cruz-de-tenerife', 'zaragoza']
  return slugs
    .map(slug => CIUDADES_SEO.find(c => c.slug === slug))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
}

/** Últimas guías del blog para la sección de contenido de la home. */
function getUltimasGuias(limit = 3) {
  const dir = path.join(process.cwd(), 'src/content/blog')
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
      const get = (key: string) => raw.match(new RegExp(`^${key}:\\s*"?(.*?)"?$`, 'm'))?.[1]?.replace(/^"|"$/g, '') || ''
      return {
        slug: file.replace(/\.md$/, ''),
        title: get('title'),
        excerpt: get('excerpt'),
        date: get('date'),
        readTime: get('readTime'),
      }
    })
    .filter(g => g.title)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
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

// ── Piezas de la portada ──────────────────────────────────────────────────

const CONTAINER = 'mx-auto w-full max-w-[1360px] px-5 sm:px-8'

/** Etiqueta de sección tipo ficha técnica: «02 / Familias». */
function Eyebrow({ n, children, tone = 'dark' }: { n: string; children: React.ReactNode; tone?: 'dark' | 'light' }) {
  return (
    <p className={`font-mono text-[11.5px] uppercase tracking-[0.16em] ${tone === 'light' ? 'text-white/60' : 'text-ink/55'}`}>
      <span className={tone === 'light' ? 'text-ember-300' : 'text-ember'}>{n}</span>
      <span className="mx-2 opacity-40">/</span>
      {children}
    </p>
  )
}

/** Titular editorial. Las partes en cursiva comparten color con el resto. */
function Title({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`font-display text-[clamp(2.8rem,6.4vw,6.4rem)] leading-[0.95] tracking-[-0.015em] text-balance ${className}`}>
      {children}
    </h2>
  )
}

function CtaPill({ href, children, tone }: { href: string; children: React.ReactNode; tone: 'white' | 'ink' }) {
  const cls = tone === 'white'
    ? 'bg-white text-ink hover:bg-ember hover:text-white'
    : 'bg-ink text-white hover:bg-ember'
  const dot = tone === 'white' ? 'bg-ink text-white' : 'bg-white/15'
  return (
    <LocalLink href={href} className={`group inline-flex items-center gap-4 rounded-full py-2.5 pl-7 pr-2.5 text-[15px] font-semibold transition-colors duration-500 ${cls}`}>
      {children}
      <span className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-500 ${dot} group-hover:bg-white/20`}>
        <ArrowUpRight size={17} className="transition-transform duration-500 group-hover:rotate-45" />
      </span>
    </LocalLink>
  )
}

function toRailItem(p: any, t: any): RailItem {
  const days = p.creado_en ? (Date.now() - new Date(p.creado_en).getTime()) / 86400000 : 99
  const featured = p.destacado === true && (!p.destacado_hasta || new Date(p.destacado_hasta).getTime() > Date.now())
  return {
    id: p.id,
    href: productUrl(p),
    title: p.titulo,
    image: p.imagen_url || '/placeholder-product.webp',
    price: formatPrecio(p.precio_usd),
    place: p.ubicacion_ciudad || '',
    condition: p.estado || '',
    ago: relativeTime(p.creado_en, t),
    badge: featured ? 'featured' : days < 7 ? 'new' : null,
  }
}

/** «Una *camper* no es…» → palabras, con las marcadas en cursiva. */
function parseWords(text: string): Word[] {
  return text.split(/\s+/).filter(Boolean).map((tok) => {
    const em = /\*[^*]+\*/.test(tok)
    return { t: tok.replace(/\*/g, ''), em }
  })
}

const FAMILIA_FOTO: Record<string, { src: string; alt: string }> = {
  campers: { src: '/home/campers.webp', alt: 'Furgoneta camper en un camino de pinos al atardecer' },
  autocaravanas: { src: '/home/autocaravanas.webp', alt: 'Autocaravana blanca junto al Mediterráneo al anochecer' },
  overland: { src: '/home/overland.webp', alt: 'Vehículo overland 4x4 en el desierto de Almería al amanecer' },
}

// ── Página ────────────────────────────────────────────────────────────────

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  const [recientes, granVolumen, medianas, autocaravanas, totalActivos] = await Promise.all([
    getProductos(10),
    getProductos(10, ['Gran Volumen']),
    getProductos(10, ['Camper Mediana / Compacta']),
    getProductos(10, ['Autocaravana Perfilada', 'Autocaravana Capuchina', 'Autocaravana Integral']),
    getTotalActivos(),
  ])

  const provincias = getProvinciasPopulares()
  const todasProvincias = [...CIUDADES_SEO].map((c) => c.nombre).sort((a, b) => a.localeCompare(b, 'es'))
  const guias = getUltimasGuias(3)
  const subs = categoriasData.camper.subs
  // Fabricantes más reconocibles primero; el resto, por orden alfabético.
  const PRIORIDAD = ['Fiat', 'Volkswagen', 'Mercedes-Benz', 'Hymer', 'Ford', 'Renault', 'Knaus', 'Adria', 'Peugeot', 'Citroën', 'Dethleffs', 'Bürstner', 'Benimar', 'Weinsberg', 'Carthago', 'Pössl', 'Westfalia', 'Chausson', 'Laika', 'Toyota']
  const todosFabricantes = agruparPorFabricante(MARCAS_MODELOS).map((g) => g.fabricante)
  const fabricantes = [
    ...PRIORIDAD.filter((f) => todosFabricantes.includes(f)),
    ...todosFabricantes.filter((f) => !PRIORIDAD.includes(f)),
  ].slice(0, 28)
  const jsonLd = generateItemListSchema(recientes, 'https://camperocasion.online')

  const grupos = FAMILIAS.map((f) => ({
    label: t(`familias.${f.key}.label`),
    options: f.subs
      .map((slug) => subs.find((x) => x.slug === slug))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => ({ value: s.label, label: s.label })),
  }))

  const tabs: RailTab[] = [
    { key: 'todas', label: t('landing.listings.all'), href: '/catalogo', items: recientes.map((p: any) => toRailItem(p, t)) },
    { key: 'gran', label: t('landing.listings.granVolumen'), href: '/catalogo?subcategoria=Gran%20Volumen', items: granVolumen.map((p: any) => toRailItem(p, t)) },
    { key: 'media', label: t('landing.listings.medianas'), href: '/catalogo?subcategoria=Camper%20Mediana%20%2F%20Compacta', items: medianas.map((p: any) => toRailItem(p, t)) },
    { key: 'auto', label: t('landing.listings.autocaravanas'), href: '/catalogo?subcategoria=Autocaravana%20Integral', items: autocaravanas.map((p: any) => toRailItem(p, t)) },
  ]

  const stats = [
    totalActivos > 0 ? { value: totalActivos, label: t('landing.statement.listings'), suffix: '' } : null,
    { value: 52, label: t('landing.statement.territories'), suffix: '' },
    { value: 0, label: t('landing.statement.commission'), suffix: ' %' },
    { value: FILTROS_TECNICOS.length, label: t('landing.statement.filters'), suffix: '' },
  ].filter((x): x is { value: number; label: string; suffix: string } => x !== null)

  const familias: FamilyPanel[] = FAMILIAS.map((f) => {
    const tipos = f.subs
      .map((slug) => subs.find((x) => x.slug === slug))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
    const foto = FAMILIA_FOTO[f.key]
    return {
      key: f.key,
      label: t(`familias.${f.key}.label`),
      desc: t(`familias.${f.key}.desc`),
      image: foto.src,
      alt: foto.alt,
      href: `/catalogo?subcategoria=${encodeURIComponent(tipos[0].label)}`,
      tipos: tipos.map((s) => ({
        label: s.label,
        href: `/catalogo?subcategoria=${encodeURIComponent(s.label)}`,
        hint: resumenFabricantes(s.marcas, 4),
      })),
    }
  })

  const pasos: JourneyStep[] = [
    { key: 's1', image: '/home/j1.webp', links: [{ label: t('landing.journey.s1.l1'), href: '/catalogo' }] },
    { key: 's2', image: '/home/j2.webp', links: [{ label: t('landing.journey.s2.l1'), href: '/compra-segura-camper' }] },
    { key: 's3', image: '/home/j3.webp', links: [
      { label: t('landing.journey.s3.l1'), href: '/calcular-itp' },
      { label: t('landing.journey.s3.l2'), href: '/contrato-compraventa' },
      { label: t('landing.journey.s3.l3'), href: '/gestoria-cambio-nombre' },
    ] },
    { key: 's4', image: '/home/j4.webp', links: [{ label: t('landing.journey.s4.l1'), href: '/catalogo' }] },
  ].map((s, i) => ({
    key: s.key,
    title: t(`landing.journey.${s.key}.title`),
    desc: t(`landing.journey.${s.key}.desc`),
    image: s.image,
    alt: t(`landing.journey.alt${i + 1}`),
    links: s.links,
  }))

  const audiencias = [
    { key: 'private', vendedor: 'particular', plural: 'particulares' },
    { key: 'camperizer', vendedor: 'camperizador', plural: 'camperizadores' },
    { key: 'pro', vendedor: 'profesional', plural: 'profesionales' },
  ]

  return (
    <div className="bg-sand-50 text-ink">
      <SmoothScroll />
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      )}

      {/* ═══════════ HERO ═══════════ */}
      <HeroFx className="relative isolate bg-sand-50 text-white">
        <div className="hero-frame absolute inset-0 -z-10 overflow-hidden bg-ink">
          <div className="hero-media absolute inset-0">
            <div className="hero-photo grain absolute inset-0">
              <Image
                src="/home/hero.webp"
                alt={t('home.hero.heroImageAlt')}
                fill
                priority
                quality={90}
                fetchPriority="high"
                sizes="100vw"
                className="object-cover object-[94%_50%] lg:object-[100%_50%]"
              />
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-ink/55 via-ink/15 to-transparent lg:from-ink/80 lg:via-ink/20" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-ink/60" aria-hidden="true" />
        </div>

        <div className={`${CONTAINER} relative flex min-h-[100svh] flex-col justify-between pt-28 lg:min-h-[calc(100svh-96px)] lg:justify-end lg:pt-32`}>
          <div className="hero-copy max-w-[1100px] lg:pb-24">
            <p className="fade-up flex items-center gap-3 font-mono text-[11.5px] uppercase tracking-[0.18em] text-white/75" style={{ '--d': '0.15s' } as React.CSSProperties}>
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inset-0 animate-ping rounded-full bg-ember-300/70" />
                <span className="relative h-2 w-2 rounded-full bg-ember-300" />
              </span>
              {totalActivos > 0 ? t('landing.hero.live', { count: totalActivos }) : t('landing.hero.eyebrow')}
            </p>
            <h1 className="font-display mt-6 text-[clamp(3.2rem,9.6vw,9.4rem)] leading-[0.9] tracking-[-0.025em]">
              <span className="mask-line"><span style={{ '--d': '0.25s' } as React.CSSProperties}>{t('landing.hero.line1')}</span></span>
              <span className="mask-line"><span className="italic" style={{ '--d': '0.4s' } as React.CSSProperties}>{t('landing.hero.line2')}</span></span>
            </h1>
            <p className="fade-up mt-7 max-w-[520px] text-[16.5px] leading-relaxed text-white/80 sm:text-[18px]" style={{ '--d': '0.7s' } as React.CSSProperties}>
              {t('landing.hero.sub')}
            </p>
            <div className="fade-up mt-9 flex flex-wrap items-center gap-x-8 gap-y-4" style={{ '--d': '0.85s' } as React.CSSProperties}>
              <CtaPill href="/catalogo" tone="white">{t('landing.hero.ctaBuy')}</CtaPill>
              <LocalLink href="/publicar" className="inline-flex items-center gap-2 text-[15px] font-semibold text-white">
                <span className="link-draw pb-1">{t('landing.hero.ctaSell')}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </LocalLink>
            </div>
          </div>

          {/* Buscador: cabalga entre el hero y la siguiente sección */}
          <div className="relative z-20 mt-10 translate-y-full lg:mt-0 lg:translate-y-1/2">
          <div className="hero-bar fade-up" style={{ '--d': '1s' } as React.CSSProperties}>
            <HeroSearch
              groups={grupos}
              provinces={todasProvincias}
              labels={{
                query: t('landing.hero.search.query'),
                queryPlaceholder: t('landing.hero.search.queryPlaceholder'),
                type: t('landing.hero.search.type'),
                allTypes: t('landing.hero.search.allTypes'),
                province: t('landing.hero.search.province'),
                allProvinces: t('landing.hero.search.allProvinces'),
                budget: t('landing.hero.search.budget'),
                anyBudget: t('landing.hero.search.anyBudget'),
                upTo: t('landing.hero.search.upTo'),
                submit: t('landing.hero.search.submit'),
              }}
            />
          </div>
          </div>
        </div>
      </HeroFx>

      {/* ═══════════ MARQUEE DE FABRICANTES ═══════════ */}
      <section aria-label={t('landing.marquee.label')} className="mt-[470px] overflow-hidden py-6 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)] lg:mt-28">
        <div className="marquee">
          {[0, 1].map((dup) => (
            <ul key={dup} className="flex shrink-0 items-center" aria-hidden={dup === 1}>
              {fabricantes.map((f) => (
                <li key={f} className="flex items-center">
                  <LocalLink href="/marcas" tabIndex={dup === 1 ? -1 : undefined} className="font-display whitespace-nowrap px-8 text-[clamp(1.8rem,3vw,2.8rem)] leading-none text-ink/35 transition-colors duration-300 hover:text-ink">
                    {f}
                  </LocalLink>
                  <span className="h-1 w-1 rounded-full bg-ink/25" aria-hidden="true" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </section>

      {/* ═══════════ MANIFIESTO + CIFRAS ═══════════ */}
      <section className={`${CONTAINER} pb-24 pt-24 lg:pb-36 lg:pt-36`}>
        <Eyebrow n="01">{t('landing.statement.eyebrow')}</Eyebrow>
        <ScrollWords
          words={parseWords(t('landing.statement.text'))}
          className="font-display mt-10 max-w-[1180px] text-[clamp(2.1rem,5.2vw,5.4rem)] leading-[1.04] tracking-[-0.015em]"
        />
        <dl className={`mt-20 grid grid-cols-2 gap-y-12 border-t border-ink/15 pt-10 lg:mt-28 ${stats.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {stats.map((s, i) => (
            <div key={s.label} className={`flex flex-col ${i % 2 === 1 ? 'border-l border-ink/12 pl-6 lg:pl-8' : ''} ${i > 0 ? 'lg:border-l lg:border-ink/12 lg:pl-8' : ''}`}>
              <dd className="font-display order-1 text-[clamp(3.4rem,6.4vw,6rem)] leading-none">
                <CountUp value={s.value} suffix={s.suffix} />
              </dd>
              <dt className="order-2 mt-4 max-w-[210px] font-mono text-[11px] uppercase leading-snug tracking-[0.1em] text-ink/55">{s.label}</dt>
            </div>
          ))}
        </dl>
      </section>

      {/* ═══════════ FAMILIAS ═══════════ */}
      <section className={`${CONTAINER} pb-24 lg:pb-40`}>
        <Reveal className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Eyebrow n="02">{t('landing.families.eyebrow')}</Eyebrow>
            <Title className="mt-6">
              {t('landing.families.title1')} <em className="italic">{t('landing.families.title2')}</em>
            </Title>
          </div>
          <LocalLink href="/catalogo" className="inline-flex items-center gap-2 text-[15px] font-semibold">
            <span className="link-draw pb-1">{t('landing.families.all')}</span> <ArrowRight size={16} aria-hidden="true" />
          </LocalLink>
        </Reveal>
        <div className="mt-14 lg:mt-20">
          <FamilyPanels families={familias} explore={t('landing.families.explore')} />
        </div>
      </section>

      {/* ═══════════ EN EL MERCADO AHORA ═══════════ */}
      <section className="bg-white py-24 lg:py-36">
        <div className={CONTAINER}>
          <Reveal className="mb-14 flex flex-col gap-6">
            <Eyebrow n="03">{t('landing.listings.eyebrow')}</Eyebrow>
            <Title>
              {t('landing.listings.title1')} <em className="italic">{t('landing.listings.title2')}</em>
            </Title>
          </Reveal>
          <Showroom
            tabs={tabs}
            labels={{
              viewAll: t('landing.listings.viewAll'),
              empty: t('landing.listings.empty'),
              emptyCta: t('landing.listings.emptyCta'),
              featured: t('landing.listings.featured'),
              isNew: t('landing.listings.isNew'),
              open: t('landing.listings.open'),
            }}
          />
        </div>
      </section>

      {/* ═══════════ RECORRIDO DE COMPRA (fijado al scroll) ═══════════ */}
      <Journey steps={pasos} index="04" eyebrow={t('landing.journey.eyebrow')} title={t('landing.journey.title')} />

      {/* ═══════════ VENDE ═══════════ */}
      <section className="relative overflow-hidden bg-ink py-24 text-sand-50 lg:py-40">
        <div className={CONTAINER}>
          <Eyebrow n="05" tone="light">{t('landing.sell.eyebrow')}</Eyebrow>
          <div className="mt-10 grid items-end gap-10 lg:grid-cols-12 lg:gap-8">
            <p
              role="img"
              aria-label="0 %"
              className="font-display select-none bg-[url('/home/j4.webp')] bg-cover bg-[position:50%_30%] bg-clip-text text-[clamp(13rem,42vw,40rem)] leading-[0.8] tracking-[-0.04em] text-transparent lg:col-span-7"
            >
              0<span className="text-[0.5em] tracking-normal"> %</span>
            </p>
            <Reveal className="pb-3 lg:col-span-5">
              <h2 className="font-display text-[clamp(2rem,3.6vw,3.5rem)] leading-[1.02]">
                {t('landing.sell.zero')} <em className="italic">{t('landing.sell.title')}</em>
              </h2>
              <p className="mt-5 max-w-md text-[16.5px] leading-relaxed text-sand-50/65">{t('landing.sell.text')}</p>
              <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
                <CtaPill href="/publicar" tone="white">{t('landing.sell.ctaPublish')}</CtaPill>
                <LocalLink href="/cuanto-vale-mi-camper" className="inline-flex items-center gap-2 text-[15px] font-semibold">
                  <span className="link-draw pb-1">{t('landing.sell.ctaValue')}</span> <ArrowRight size={16} aria-hidden="true" />
                </LocalLink>
              </div>
            </Reveal>
          </div>

          <div className="mt-24 grid border-t border-white/15 lg:mt-32 lg:grid-cols-3">
            {audiencias.map((a, i) => (
              <Reveal key={a.key} delay={i * 0.08} className={`group py-9 lg:py-10 ${i > 0 ? 'border-t border-white/15 lg:border-l lg:border-t-0 lg:pl-9' : ''} ${i < 2 ? 'lg:pr-9' : ''}`}>
                <p className="font-mono text-[11px] tracking-[0.14em] text-white/45">0{i + 1}</p>
                <h3 className="font-display mt-4 text-[clamp(1.9rem,2.6vw,2.5rem)] leading-[1.02]">{t(`home.audiences.${a.key}.title`)}</h3>
                <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-sand-50/60">{t(`home.audiences.${a.key}.desc`)}</p>
                <div className="mt-6 flex flex-col items-start gap-2 text-[14px] font-medium">
                  <LocalLink href="/publicar" className="inline-flex items-center gap-1.5 text-white">
                    <span className="link-draw pb-0.5">{t('home.audiences.cta')}</span> <ArrowRight size={14} aria-hidden="true" />
                  </LocalLink>
                  <LocalLink href={`/catalogo?vendedor=${a.vendedor}`} className="text-white/55 transition-colors hover:text-white">
                    {t('home.audiences.buyCta', { tipo: t(`tiposVendedor.${a.plural}`) })}
                  </LocalLink>
                  {a.key !== 'private' && (
                    <LocalLink href="/para-profesionales" className="text-white/55 transition-colors hover:text-white">
                      {t('home.audiences.plansCta')}
                    </LocalLink>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ GUÍAS ═══════════ */}
      {guias.length > 0 && (
        <section className={`${CONTAINER} py-24 lg:py-40`}>
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
            <Reveal className="lg:col-span-5">
              <Eyebrow n="06">{t('landing.guides.eyebrow')}</Eyebrow>
              <Title className="mt-6">
                {t('landing.guides.title1')} <em className="italic">{t('landing.guides.title2')}</em>
              </Title>
              <LocalLink href="/blog" className="mt-8 inline-flex items-center gap-2 text-[15px] font-semibold">
                <span className="link-draw pb-1">{t('home.guides.viewAll')}</span> <ArrowRight size={16} aria-hidden="true" />
              </LocalLink>
            </Reveal>
            <div className="lg:col-span-7">
              {guias.map((g, i) => (
                <Reveal key={g.slug} delay={i * 0.08} className="border-t border-ink/15 last:border-b">
                  <LocalLink href={`/blog/${g.slug}`} className="group grid gap-3 py-8 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-8">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/45">{String(i + 1).padStart(2, '0')} · {g.readTime}</p>
                      <h3 className="font-display mt-3 text-[clamp(1.8rem,2.7vw,2.5rem)] leading-[1.06] transition-transform duration-500 group-hover:translate-x-2">{g.title}</h3>
                      <p className="mt-3 line-clamp-2 max-w-2xl text-[15px] leading-relaxed text-ink/60">{g.excerpt}</p>
                    </div>
                    <span className="hidden h-12 w-12 items-center justify-center rounded-full border border-ink/20 transition-all duration-500 group-hover:rotate-45 group-hover:border-ink group-hover:bg-ink group-hover:text-white sm:flex" aria-hidden="true">
                      <ArrowUpRight size={19} />
                    </span>
                  </LocalLink>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ PROVINCIAS ═══════════ */}
      <section className={`${CONTAINER} pb-24 lg:pb-40 ${guias.length === 0 ? 'pt-24 lg:pt-40' : ''}`}>
        <Reveal className="max-w-4xl">
          <Eyebrow n="07">{t('landing.provinces.eyebrow')}</Eyebrow>
          <Title className="mt-6">
            {t('landing.provinces.title1')} <em className="italic">{t('landing.provinces.title2')}</em>
          </Title>
        </Reveal>
        <ul className="group/list mt-14 grid gap-x-10 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3">
          {provincias.map((p, i) => (
            <li key={p.slug} className="border-t border-ink/15">
              <LocalLink
                href={`/${p.slug}`}
                aria-label={`${t('landing.provinces.label')} ${p.nombre}`}
                className="group flex items-baseline justify-between gap-4 py-5 transition-opacity duration-500 group-hover/list:opacity-30 hover:!opacity-100 focus-visible:!opacity-100 lg:py-6"
              >
                <span className="flex items-baseline gap-4">
                  <span className="font-mono text-[11px] tracking-[0.1em] text-ink/40">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-display text-[clamp(2rem,3vw,3rem)] leading-none transition-transform duration-500 group-hover:translate-x-2">{p.nombre}</span>
                </span>
                <ArrowUpRight size={20} className="shrink-0 -translate-x-2 translate-y-1 opacity-0 transition-all duration-500 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" aria-hidden="true" />
              </LocalLink>
            </li>
          ))}
        </ul>
      </section>

      {/* ═══════════ CTA FINAL ═══════════ */}
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <Image src="/home/cta.webp" alt="" fill sizes="100vw" className="-z-10 object-cover" quality={80} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/85 via-ink/30 to-ink/15" aria-hidden="true" />
        <div className="absolute inset-0 -z-10 grain" aria-hidden="true" />
        <div className={`${CONTAINER} flex min-h-[86vh] flex-col items-start justify-end py-20 lg:py-28`}>
          <Reveal>
            <h2 className="font-display max-w-5xl text-[clamp(3rem,8vw,8rem)] leading-[0.92] tracking-[-0.02em] text-balance">
              {t('landing.cta.title1')} <em className="italic">{t('landing.cta.title2')}</em>
            </h2>
            <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-white/75">{t('landing.cta.sub')}</p>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
              <CtaPill href="/publicar" tone="white">{t('landing.cta.publish')}</CtaPill>
              <LocalLink href="/cuanto-vale-mi-camper" className="inline-flex items-center gap-2 text-[15px] font-semibold">
                <span className="link-draw pb-1">{t('landing.cta.value')}</span> <ArrowRight size={16} aria-hidden="true" />
              </LocalLink>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
