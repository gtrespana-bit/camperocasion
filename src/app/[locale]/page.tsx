import { serializeJsonLd } from '@/lib/serialize-json-ld'
import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import { ArrowRight, ArrowUpRight, BadgeCheck, Check, ClipboardCheck, FileText, ShieldCheck } from 'lucide-react'
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
import ListingRail, { type RailItem, type RailTab } from '@/components/home/ListingRail'
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

function Eyebrow({ children, tone = 'dark' }: { children: React.ReactNode; tone?: 'dark' | 'light' }) {
  return (
    <p className={`flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.18em] ${tone === 'light' ? 'text-white/60' : 'text-ink/55'}`}>
      <span className={`h-px w-8 ${tone === 'light' ? 'bg-ember-300' : 'bg-ember'}`} aria-hidden="true" />
      {children}
    </p>
  )
}

/** Titular editorial: serif grande con una palabra clave en cursiva. */
function Title({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`font-display text-[clamp(2.6rem,5.6vw,5.5rem)] leading-[0.98] text-balance ${className}`}>
      {children}
    </h2>
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

const FAMILIA_FOTO: Record<string, { src: string; alt: string }> = {
  campers: { src: '/home/campers.webp', alt: 'Furgoneta camper en un camino de pinos al atardecer' },
  autocaravanas: { src: '/home/autocaravanas.webp', alt: 'Autocaravana blanca junto al Mediterráneo al anochecer' },
  overland: { src: '/home/overland.webp', alt: 'Vehículo overland 4x4 en el desierto de Almería al amanecer' },
}

const PASOS_CONFIANZA = [
  { key: 's1', href: '/catalogo' },
  { key: 's2', href: '/compra-segura-camper' },
  { key: 's3', href: '/calcular-itp' },
  { key: 's4', href: '/contrato-compraventa' },
] as const

/** Contornos topográficos: textura sutil para las secciones oscuras. */
function Contours({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 800 800" fill="none" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <ellipse
          key={i}
          cx={400 + Math.sin(i * 0.7) * 18}
          cy={400 + Math.cos(i * 0.5) * 14}
          rx={60 + i * 24}
          ry={40 + i * 19}
          transform={`rotate(${-18 + i * 1.6} 400 400)`}
          stroke="currentColor"
          strokeWidth="1"
        />
      ))}
    </svg>
  )
}

/** Sello circular con texto en órbita (homologación verificada). */
function Sello({ text }: { text: string }) {
  const ring = `${text.toUpperCase()} · ${text.toUpperCase()} · `
  return (
    <div className="relative h-[132px] w-[132px]" aria-hidden="true">
      <svg viewBox="0 0 132 132" className="spin-slow absolute inset-0 h-full w-full">
        <defs>
          <path id="sello-circulo" d="M66,66 m-52,0 a52,52 0 1,1 104,0 a52,52 0 1,1 -104,0" />
        </defs>
        <text fontSize="9.2" letterSpacing="2.6" fill="currentColor" fontWeight="600">
          <textPath href="#sello-circulo">{ring}</textPath>
        </text>
      </svg>
      <div className="absolute inset-[30px] flex items-center justify-center rounded-full bg-forest text-sand-50">
        <ShieldCheck size={30} strokeWidth={1.6} />
      </div>
    </div>
  )
}

function Expediente({ t }: { t: any }) {
  const rows = [
    { icon: FileText, label: t('landing.trust.dossier.sheet'), state: t('landing.trust.dossier.sheetState') },
    { icon: ClipboardCheck, label: t('landing.trust.dossier.itv'), state: t('landing.trust.dossier.itvState') },
    { icon: BadgeCheck, label: t('landing.trust.dossier.homologation'), state: t('landing.trust.dossier.homologationState') },
  ]
  return (
    <figure className="relative mt-12 max-w-[460px] rounded-[22px] bg-sand-50 p-6 text-ink shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] sm:p-7">
      <figcaption className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/50">
        <span>{t('landing.trust.dossier.label')}</span>
        <span className="rounded-full border border-ink/15 px-2.5 py-1 normal-case tracking-normal">{t('landing.trust.dossier.example')}</span>
      </figcaption>
      <ul className="mt-5 divide-y divide-ink/10">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-4 py-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
              <r.icon size={17} strokeWidth={1.8} />
            </span>
            <span className="flex-1 text-[15px] font-medium">{r.label}</span>
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-forest-500">
              <Check size={14} strokeWidth={2.4} /> {r.state}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-center gap-5 rounded-2xl bg-forest p-4 pr-5 text-sand-50">
        <div className="text-sand-50/80 [&_div>div]:bg-sand-50 [&_div>div]:text-forest">
          <Sello text={t('landing.trust.dossier.seal')} />
        </div>
        <div>
          <p className="font-display text-[26px] leading-[1.05]">{t('landing.trust.dossier.seal')}</p>
          <p className="mt-1.5 text-[13px] leading-snug text-sand-50/65">{t('landing.trust.dossier.sealDesc')}</p>
        </div>
      </div>
    </figure>
  )
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
    totalActivos > 0 ? { value: totalActivos, label: t('landing.stats.listings'), suffix: '' } : null,
    { value: 52, label: t('landing.stats.territories'), suffix: '' },
    { value: 0, label: t('landing.stats.commission'), suffix: ' %' },
    { value: FILTROS_TECNICOS.length, label: t('landing.stats.filters'), suffix: '' },
  ].filter((x): x is { value: number; label: string; suffix: string } => x !== null)

  const audiencias = [
    { key: 'private', vendedor: 'particular', plural: 'particulares' },
    { key: 'camperizer', vendedor: 'camperizador', plural: 'camperizadores' },
    { key: 'pro', vendedor: 'profesional', plural: 'profesionales' },
  ]

  return (
    <div className="bg-sand-50 text-ink">
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      )}

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative isolate bg-ink text-white">
        <div className="absolute inset-0 overflow-hidden">
          <div className="hero-parallax absolute inset-0">
            <div className="hero-photo grain absolute inset-0">
              <Image
                src="/home/hero.webp"
                alt={t('home.hero.heroImageAlt')}
                fill
                priority
                quality={90}
                fetchPriority="high"
                sizes="100vw"
                className="object-cover object-[87%_50%] lg:object-[100%_50%]"
              />
            </div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-ink/50 via-ink/20 to-transparent lg:from-ink/80 lg:via-ink/20" aria-hidden="true" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-ink/60" aria-hidden="true" />
        </div>

        <div className={`${CONTAINER} relative flex min-h-[90svh] flex-col justify-between pb-0 pt-28 lg:justify-end lg:pt-36 lg:min-h-[calc(100svh-48px)]`}>
          <div className="hero-fade max-w-[1100px] lg:pb-36">
            <p className="fade-up flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.2em] text-white/75" style={{ '--d': '0.15s' } as React.CSSProperties}>
              <span className="h-px w-8 bg-ember-300" aria-hidden="true" />
              {t('landing.hero.eyebrow')}
            </p>
            <h1 className="font-display mt-6 text-[clamp(3.2rem,9.4vw,9rem)] leading-[0.92] tracking-[-0.02em]">
              <span className="mask-line"><span style={{ '--d': '0.25s' } as React.CSSProperties}>{t('landing.hero.line1')}</span></span>
              <span className="mask-line"><span className="italic text-[#FFD2B0]" style={{ '--d': '0.4s' } as React.CSSProperties}>{t('landing.hero.line2')}</span></span>
            </h1>
            <p className="fade-up mt-7 max-w-[560px] text-[17px] leading-relaxed text-white/80 sm:text-[19px]" style={{ '--d': '0.7s' } as React.CSSProperties}>
              {t('landing.hero.sub')}
            </p>
            <div className="fade-up mt-9 flex flex-wrap items-center gap-x-8 gap-y-4" style={{ '--d': '0.85s' } as React.CSSProperties}>
              <LocalLink
                href="/catalogo"
                className="group inline-flex items-center gap-3 rounded-full bg-ember py-4 pl-8 pr-5 text-[15px] font-semibold text-white transition-colors duration-500 hover:bg-white hover:text-ink"
              >
                {t('landing.hero.ctaBuy')}
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-all duration-500 group-hover:bg-ink group-hover:text-white">
                  <ArrowUpRight size={16} className="transition-transform duration-500 group-hover:rotate-45" />
                </span>
              </LocalLink>
              <LocalLink href="/publicar" className="inline-flex items-center gap-2 text-[15px] font-semibold text-white">
                <span className="link-draw pb-1">{t('landing.hero.ctaSell')}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </LocalLink>
            </div>
          </div>

          {/* Buscador: cabalga entre el hero y la siguiente sección */}
          <div className="fade-up relative z-20 mt-24 translate-y-[80%] lg:mt-0 lg:translate-y-1/2" style={{ '--d': '1s' } as React.CSSProperties}>
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
      </section>

      {/* ═══════════ CIFRAS ═══════════ */}
      <section className={`${CONTAINER} pb-16 pt-[315px] sm:pt-[315px] lg:pb-24 lg:pt-36`}>
        <dl className={`grid grid-cols-2 gap-y-10 ${stats.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08} className={`flex flex-col ${i > 0 ? 'lg:border-l lg:border-ink/12 lg:pl-8' : ''} ${i % 2 === 1 ? 'pl-5 border-l border-ink/12 lg:pl-8' : ''}`}>
              <dt className="order-2 mt-3 max-w-[220px] text-[14px] leading-snug text-ink/60">{s.label}</dt>
              <dd className="order-1 font-display text-[clamp(3.2rem,6vw,5.6rem)] leading-none text-ink">
                <CountUp value={s.value} suffix={s.suffix} />
              </dd>
            </Reveal>
          ))}
        </dl>
      </section>

      {/* ═══════════ MARQUEE DE FABRICANTES ═══════════ */}
      <section aria-label={t('landing.marquee.label')} className="overflow-hidden border-y border-ink/12 py-7 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <div className="marquee">
          {[0, 1].map((dup) => (
            <ul key={dup} className="flex shrink-0 items-center" aria-hidden={dup === 1}>
              {fabricantes.map((f) => (
                <li key={f} className="flex items-center">
                  <LocalLink href="/marcas" tabIndex={dup === 1 ? -1 : undefined} className="font-display whitespace-nowrap px-8 text-[clamp(2rem,3.4vw,3.2rem)] leading-none text-ink/80 transition-colors duration-300 hover:text-ember">
                    {f}
                  </LocalLink>
                  <span className="h-1.5 w-1.5 rounded-full bg-ember/70" aria-hidden="true" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </section>

      {/* ═══════════ FAMILIAS ═══════════ */}
      <section className={`${CONTAINER} py-24 lg:py-36`}>
        <Reveal className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <Eyebrow>{t('landing.families.eyebrow')}</Eyebrow>
            <Title className="mt-6">
              {t('landing.families.title1')} <em className="italic text-forest-500">{t('landing.families.title2')}</em>
            </Title>
          </div>
          <div className="lg:col-span-4">
            <p className="text-[17px] leading-relaxed text-ink/65">{t('landing.families.intro')}</p>
            <LocalLink href="/catalogo" className="mt-5 inline-flex items-center gap-2 text-[15px] font-semibold">
              <span className="link-draw pb-1">{t('landing.families.all')}</span> <ArrowRight size={16} aria-hidden="true" />
            </LocalLink>
          </div>
        </Reveal>

        <div className="mt-16 grid gap-x-6 gap-y-14 md:grid-cols-3">
          {FAMILIAS.map((f, i) => {
            const tipos = f.subs
              .map((slug) => subs.find((x) => x.slug === slug))
              .filter((s): s is NonNullable<typeof s> => Boolean(s))
            const foto = FAMILIA_FOTO[f.key]
            const primero = tipos[0]
            return (
              <Reveal key={f.key} delay={i * 0.12} className={['', 'md:mt-12', 'md:mt-24'][i]}>
                <article className="group">
                  <LocalLink
                    href={`/catalogo?subcategoria=${encodeURIComponent(primero.label)}`}
                    aria-label={`${t('landing.families.explore')} ${t(`familias.${f.key}.label`)}`}
                    className="relative block aspect-[4/5] overflow-hidden rounded-[24px] bg-ink"
                  >
                    {foto && (
                      <Image
                        src={foto.src}
                        alt={foto.alt}
                        fill
                        sizes="(max-width: 768px) 92vw, 33vw"
                        className="object-cover transition-transform duration-[1400ms] ease-out group-hover:scale-[1.07]"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/5 to-ink/25" aria-hidden="true" />
                    <span className="absolute left-6 top-6 font-display text-[22px] italic text-white/90">0{i + 1}</span>
                    <span className="absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-full bg-sand-50/95 text-ink transition-all duration-500 ease-out group-hover:rotate-45 group-hover:bg-ember group-hover:text-white" aria-hidden="true">
                      <ArrowUpRight size={20} />
                    </span>
                    <h3 className="font-display absolute inset-x-6 bottom-6 text-[clamp(2.2rem,3.2vw,3rem)] leading-[1] text-white">
                      {t(`familias.${f.key}.label`)}
                    </h3>
                  </LocalLink>
                  <p className="mt-5 text-[15px] leading-relaxed text-ink/65">{t(`familias.${f.key}.desc`)}</p>
                  <ul className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
                    {tipos.map((s) => (
                      <li key={s.slug}>
                        <LocalLink
                          href={`/catalogo?subcategoria=${encodeURIComponent(s.label)}`}
                          title={resumenFabricantes(s.marcas, 4)}
                          className="group/row flex items-center justify-between py-3 text-[15px] font-medium transition-all duration-300 hover:pl-2 hover:text-ember"
                        >
                          {s.label}
                          <ArrowRight size={15} className="-translate-x-2 opacity-0 transition-all duration-300 group-hover/row:translate-x-0 group-hover/row:opacity-100" aria-hidden="true" />
                        </LocalLink>
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            )
          })}
        </div>
      </section>

      {/* ═══════════ EN EL MERCADO AHORA ═══════════ */}
      <section className="bg-white py-24 lg:py-32">
        <div className={CONTAINER}>
          <Reveal className="mb-12 max-w-3xl">
            <Eyebrow>{t('landing.listings.eyebrow')}</Eyebrow>
            <Title className="mt-6">
              {t('landing.listings.title1')} <em className="italic text-forest-500">{t('landing.listings.title2')}</em>
            </Title>
          </Reveal>
          <Reveal delay={0.1}>
            <ListingRail
              tabs={tabs}
              labels={{
                viewAll: t('landing.listings.viewAll'),
                empty: t('landing.listings.empty'),
                emptyCta: t('landing.listings.emptyCta'),
                prev: t('landing.listings.prev'),
                next: t('landing.listings.next'),
                featured: t('landing.listings.featured'),
                isNew: t('landing.listings.isNew'),
              }}
            />
          </Reveal>
        </div>
      </section>

      {/* ═══════════ COMPRA CON GARANTÍAS ═══════════ */}
      <section className="relative isolate overflow-hidden bg-ink py-24 text-sand-50 lg:py-36">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_85%_10%,rgba(47,107,82,0.55),transparent_70%),radial-gradient(50%_40%_at_0%_100%,rgba(232,89,12,0.12),transparent_70%)]" aria-hidden="true" />
        <Contours className="absolute -right-40 -top-40 -z-10 h-[900px] w-[900px] text-white/[0.06]" />
        <div className={`${CONTAINER} grid gap-16 lg:grid-cols-12 lg:gap-12`}>
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-28">
              <Reveal>
                <Eyebrow tone="light">{t('landing.trust.eyebrow')}</Eyebrow>
                <Title className="mt-6">
                  {t('landing.trust.title1')} <em className="italic text-[#FFD2B0]">{t('landing.trust.title2')}</em>
                </Title>
                <p className="mt-6 max-w-md text-[17px] leading-relaxed text-sand-50/65">{t('landing.trust.text')}</p>
              </Reveal>
              <Reveal delay={0.15}>
                <Expediente t={t} />
              </Reveal>
            </div>
          </div>

          <ol className="lg:col-span-7 lg:pt-4">
            {PASOS_CONFIANZA.map((p, i) => (
              <Reveal as="li" key={p.key} delay={i * 0.08} className="border-t border-white/15 last:border-b">
                <LocalLink href={p.href} className="group grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 py-9 sm:grid-cols-[88px_1fr_auto] sm:items-start sm:gap-x-8">
                  <span className="font-display text-[44px] italic leading-none text-ember-300 transition-transform duration-500 group-hover:translate-x-1 sm:text-[56px]">0{i + 1}</span>
                  <div>
                    <h3 className="font-display text-[clamp(1.9rem,2.8vw,2.6rem)] leading-[1.05]">{t(`landing.trust.steps.${p.key}.title`)}</h3>
                    <p className="mt-3 max-w-lg text-[15.5px] leading-relaxed text-sand-50/60">{t(`landing.trust.steps.${p.key}.desc`)}</p>
                    <span className="mt-4 inline-flex items-center gap-2 text-[14px] font-semibold text-sand-50">
                      <span className="link-draw pb-0.5">{t(`landing.trust.steps.${p.key}.cta`)}</span>
                    </span>
                  </div>
                  <span className="hidden h-12 w-12 items-center justify-center rounded-full border border-white/25 transition-all duration-500 ease-out group-hover:rotate-45 group-hover:border-ember group-hover:bg-ember sm:col-start-3 sm:flex" aria-hidden="true">
                    <ArrowUpRight size={19} />
                  </span>
                </LocalLink>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══════════ VENDE ═══════════ */}
      <section className="bg-sand-100 py-24 lg:py-36">
        <div className={`${CONTAINER} grid gap-16 lg:grid-cols-12 lg:gap-14`}>
          <Reveal className="lg:col-span-5">
            <Eyebrow>{t('landing.sell.eyebrow')}</Eyebrow>
            <Title className="mt-6">
              {t('landing.sell.title1')} <em className="italic text-ember">{t('landing.sell.title2')}</em>{t('landing.sell.title3')}
            </Title>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed text-ink/65">{t('landing.sell.text')}</p>
            <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-4">
              <LocalLink href="/publicar" className="group inline-flex items-center gap-3 rounded-full bg-ink py-4 pl-8 pr-5 text-[15px] font-semibold text-white transition-colors duration-500 hover:bg-ember">
                {t('landing.sell.ctaPublish')}
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15"><ArrowUpRight size={16} className="transition-transform duration-500 group-hover:rotate-45" /></span>
              </LocalLink>
              <LocalLink href="/cuanto-vale-mi-camper" className="inline-flex items-center gap-2 text-[15px] font-semibold">
                <span className="link-draw pb-1">{t('landing.sell.ctaValue')}</span> <ArrowRight size={16} aria-hidden="true" />
              </LocalLink>
            </div>

            <ol className="mt-14 space-y-6 border-t border-ink/12 pt-8">
              {[1, 2, 3].map((n) => (
                <li key={n} className="flex gap-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/25 font-display text-[19px] italic">{n}</span>
                  <div>
                    <p className="text-[16px] font-semibold">{t(`home.how.step${n}Title`)}</p>
                    <p className="mt-1 text-[14.5px] leading-relaxed text-ink/60">{t(`home.how.step${n}Desc`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>

          <div className="lg:col-span-7">
            <Reveal>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink/50">{t('landing.sell.audiencesTitle')}</p>
            </Reveal>
            <div className="mt-6">
              {audiencias.map((a, i) => (
                <Reveal key={a.key} delay={i * 0.08} className="border-t border-ink/15 last:border-b">
                  <div className="group grid gap-6 py-9 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div>
                      <h3 className="font-display text-[clamp(2rem,3.4vw,3.2rem)] leading-[1.02] transition-transform duration-500 group-hover:translate-x-2">{t(`home.audiences.${a.key}.title`)}</h3>
                      <p className="mt-3 max-w-xl text-[15.5px] leading-relaxed text-ink/62">{t(`home.audiences.${a.key}.desc`)}</p>
                    </div>
                    <div className="flex flex-col gap-2 text-[14px] font-semibold sm:items-end">
                      <LocalLink href="/publicar" className="inline-flex items-center gap-1.5 text-ember-600 hover:text-ink">
                        {t('home.audiences.cta')} <ArrowRight size={14} aria-hidden="true" />
                      </LocalLink>
                      <LocalLink href={`/catalogo?vendedor=${a.vendedor}`} className="text-ink/60 hover:text-ink">
                        {t('home.audiences.buyCta', { tipo: t(`tiposVendedor.${a.plural}`) })}
                      </LocalLink>
                      {a.key !== 'private' && (
                        <LocalLink href="/para-profesionales" className="text-ink/60 hover:text-ink">
                          {t('home.audiences.plansCta')}
                        </LocalLink>
                      )}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ GUÍAS ═══════════ */}
      {guias.length > 0 && (
        <section className="bg-white py-24 lg:py-32">
          <div className={`${CONTAINER} grid gap-12 lg:grid-cols-12 lg:gap-14`}>
            <Reveal className="lg:col-span-4">
              <Eyebrow>{t('landing.guides.eyebrow')}</Eyebrow>
              <Title className="mt-6">
                {t('landing.guides.title1')} <em className="italic text-forest-500">{t('landing.guides.title2')}</em>
              </Title>
              <p className="mt-6 max-w-sm text-[16px] leading-relaxed text-ink/60">{t('home.guides.subtitle')}</p>
              <LocalLink href="/blog" className="mt-6 inline-flex items-center gap-2 text-[15px] font-semibold">
                <span className="link-draw pb-1">{t('home.guides.viewAll')}</span> <ArrowRight size={16} aria-hidden="true" />
              </LocalLink>
            </Reveal>
            <div className="lg:col-span-8">
              {guias.map((g, i) => (
                <Reveal key={g.slug} delay={i * 0.08} className="border-t border-ink/12 last:border-b">
                  <LocalLink href={`/blog/${g.slug}`} className="group grid gap-3 py-8 sm:grid-cols-[110px_1fr_auto] sm:items-start sm:gap-8">
                    <span className="pt-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink/45">{g.readTime}</span>
                    <div>
                      <h3 className="font-display text-[clamp(1.7rem,2.6vw,2.4rem)] leading-[1.1] transition-colors duration-300 group-hover:text-forest-500">{g.title}</h3>
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
      <section className={`${CONTAINER} py-24 lg:py-32`}>
        <Reveal className="max-w-3xl">
          <Eyebrow>{t('landing.provinces.eyebrow')}</Eyebrow>
          <Title className="mt-6">
            {t('landing.provinces.title1')} <em className="italic text-forest-500">{t('landing.provinces.title2')}</em>
          </Title>
        </Reveal>
        <Reveal delay={0.1} className="mt-14 overflow-hidden rounded-[22px] border border-ink/12">
          <ul className="grid grid-cols-2 gap-px bg-ink/12 md:grid-cols-3 lg:grid-cols-4">
            {provincias.map((p) => (
              <li key={p.slug} className="bg-sand-50">
                <LocalLink href={`/${p.slug}`} className="group relative flex h-[132px] flex-col justify-between p-5 transition-colors duration-500 hover:bg-ink hover:text-white sm:h-[150px] sm:p-6">
                  <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink/45 transition-colors group-hover:text-white/55">{t('landing.provinces.label')}</span>
                  <span className="font-display text-[clamp(1.7rem,2.4vw,2.3rem)] leading-none">{p.nombre}</span>
                  <ArrowUpRight size={20} className="absolute right-5 top-5 -translate-x-1 translate-y-1 opacity-0 transition-all duration-500 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100 sm:right-6 sm:top-6" aria-hidden="true" />
                </LocalLink>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* ═══════════ CTA FINAL ═══════════ */}
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <Image src="/home/cta.webp" alt="" fill sizes="100vw" className="-z-10 object-cover" quality={80} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ink/85 via-ink/30 to-ink/15" aria-hidden="true" />
        <div className="absolute inset-0 -z-10 grain" aria-hidden="true" />
        <div className={`${CONTAINER} flex min-h-[78vh] flex-col items-start justify-end py-20 lg:py-28`}>
          <Reveal>
            <h2 className="font-display max-w-4xl text-[clamp(2.8rem,7vw,7rem)] leading-[0.96] text-balance">
              {t('landing.cta.title1')} <em className="italic text-[#FFD2B0]">{t('landing.cta.title2')}</em>
            </h2>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/75">{t('landing.cta.sub')}</p>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
              <LocalLink href="/publicar" className="group inline-flex items-center gap-3 rounded-full bg-ember py-4 pl-8 pr-5 text-[15px] font-semibold text-white transition-colors duration-500 hover:bg-white hover:text-ink">
                {t('landing.cta.publish')}
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 transition-all duration-500 group-hover:bg-ink group-hover:text-white"><ArrowUpRight size={16} className="transition-transform duration-500 group-hover:rotate-45" /></span>
              </LocalLink>
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
