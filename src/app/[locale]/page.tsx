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
import HeroSearch from '@/components/home/HeroSearch'
import SmoothScroll from '@/components/home/SmoothScroll'
import Cursor from '@/components/home/Cursor'
import Preloader from '@/components/home/Preloader'
import HeroGL from '@/components/home/HeroGL'
import KineticTitle from '@/components/home/KineticTitle'
import TextReveal from '@/components/home/TextReveal'
import Magnetic from '@/components/home/Magnetic'
import Odometer from '@/components/home/Odometer'
import RoutePanels, { type RoutePanel } from '@/components/home/RoutePanels'
import Gallery, { type GalleryItem } from '@/components/home/Gallery'
import RoadJourney, { type RoadStep } from '@/components/home/RoadJourney'
import BigMarquee from '@/components/home/BigMarquee'
import ProvinceList, { type Province } from '@/components/home/ProvinceList'
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

/** Etiqueta de sección: filete + texto en versalitas. */
function Eyebrow({ children, tone = 'light', n, nClass }: { children: React.ReactNode; tone?: 'light' | 'dark'; n?: string; nClass?: string }) {
  return (
    <p className={`micro flex items-center gap-4 ${tone === 'light' ? 'text-white/65' : 'text-night/70'}`}>
      {n && <span className={`t-num text-[13px] tracking-normal ${nClass || (tone === 'light' ? 'text-leaf-300' : 'text-leaf-600')}`}>{n}</span>}
      <span className={`h-px w-10 ${tone === 'light' ? 'bg-white/40' : 'bg-night/40'}`} aria-hidden="true" />
      {children}
    </p>
  )
}

function Arrow() {
  return <ArrowUpRight size={18} className="btn-ico" aria-hidden="true" />
}

function toGalleryItem(p: any, t: any): GalleryItem {
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

const COORDS: Record<string, string> = {
  madrid: '40.42° N · 3.70° W',
  barcelona: '41.39° N · 2.17° E',
  valencia: '39.47° N · 0.38° W',
  sevilla: '37.39° N · 5.98° W',
  malaga: '36.72° N · 4.42° W',
  alicante: '38.35° N · 0.48° W',
  murcia: '37.98° N · 1.13° W',
  asturias: '43.36° N · 5.85° W',
  baleares: '39.57° N · 2.65° E',
  'las-palmas': '28.12° N · 15.44° W',
  'santa-cruz-de-tenerife': '28.47° N · 16.25° W',
  zaragoza: '41.65° N · 0.89° W',
}
const PROVINCE_IMAGES = ['/home/campers.webp', '/home/autocaravanas.webp', '/home/overland.webp', '/home/j3.webp', '/home/j4.webp', '/home/j1.webp']

// ── Página ────────────────────────────────────────────────────────────────

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  const [recientes, totalActivos] = await Promise.all([getProductos(10), getTotalActivos()])

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
  ].slice(0, 24)
  const jsonLd = generateItemListSchema(recientes, 'https://camperocasion.online')

  const grupos = FAMILIAS.map((f) => ({
    label: t(`familias.${f.key}.label`),
    options: f.subs
      .map((slug) => subs.find((x) => x.slug === slug))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => ({ value: s.label, label: s.label })),
  }))

  const stats = [
    totalActivos > 0 ? { value: totalActivos, label: t('landing.statement.listings'), suffix: '' } : null,
    { value: 52, label: t('landing.statement.territories'), suffix: '' },
    { value: 0, label: t('landing.statement.commission'), suffix: ' %' },
    { value: FILTROS_TECNICOS.length, label: t('landing.statement.filters'), suffix: '' },
  ].filter((x): x is { value: number; label: string; suffix: string } => x !== null)

  const rutas: RoutePanel[] = FAMILIAS.map((f) => {
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
      tipos: tipos.map((s) => ({ label: s.label, href: `/catalogo?subcategoria=${encodeURIComponent(s.label)}` })),
    }
  })

  const pasos: RoadStep[] = [
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
    sheet: i === 1
      ? {
          title: t('landing.journey.sheet.title'),
          example: t('landing.journey.sheet.example'),
          rows: [
            { label: t('landing.journey.sheet.sheet'), state: t('landing.journey.sheet.ok') },
            { label: t('landing.journey.sheet.itv'), state: t('landing.journey.sheet.ok') },
            { label: t('landing.journey.sheet.homologation'), state: t('landing.journey.sheet.ok') },
          ],
        }
      : undefined,
  }))

  const audiencias = [
    { key: 'private', vendedor: 'particular', plural: 'particulares' },
    { key: 'camperizer', vendedor: 'camperizador', plural: 'camperizadores' },
    { key: 'pro', vendedor: 'profesional', plural: 'profesionales' },
  ]

  const listaProvincias: Province[] = provincias.map((p, i) => ({
    slug: p.slug,
    name: p.nombre,
    coord: COORDS[p.slug] || '',
    image: PROVINCE_IMAGES[i % PROVINCE_IMAGES.length],
  }))

  const searchEl = (
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
  )

  return (
    <div className="bg-night text-white">
      <Preloader label={t('landing.pre.label')} />
      <SmoothScroll />
      <Cursor />
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }} />
      )}

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative isolate flex h-[100svh] min-h-[700px] flex-col overflow-hidden bg-night">
        <Image
          src="/home/hero.webp"
          alt={t('home.hero.heroImageAlt')}
          fill
          priority
          quality={90}
          fetchPriority="high"
          sizes="100vw"
          className="-z-20 object-cover object-[82%_50%]"
        />
        <div className="absolute inset-0 -z-10">
          <HeroGL src="/home/hero.webp" focus={[0.82, 0.5]} />
        </div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-night via-night/15 to-night/45" aria-hidden="true" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-night/65 via-night/10 to-transparent" aria-hidden="true" />
        <div className="grain absolute inset-0 -z-10" aria-hidden="true" />

        <div className={`${CONTAINER} relative flex h-full flex-col justify-between pb-24 pt-28 lg:pb-8`}>
          <div className="fade-up flex items-center justify-between" style={{ '--d': '0.1s' } as React.CSSProperties}>
            <p className="micro flex items-center gap-3 text-white/80">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inset-0 animate-ping rounded-full bg-leaf-300/70" />
                <span className="relative h-2 w-2 rounded-full bg-leaf-300" />
              </span>
              {totalActivos > 0 ? t('landing.hero.live', { count: totalActivos }) : t('landing.hero.eyebrow')}
            </p>
            <p className="micro hidden text-white/55 md:block">{t('landing.hero.eyebrow')}</p>
          </div>

          <div className="mt-5 flex flex-1 flex-col justify-between gap-8 lg:mt-8">
            <KineticTitle
              lines={[t('landing.hero.line1'), t('landing.hero.line2')]}
              className="t-mega text-[clamp(2.4rem,min(15.2vw,25svh),16rem)]"
            />
            <div>
              <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
                <div className="lg:col-span-6">
                  <p className="fade-up hidden max-w-[430px] text-[16px] leading-relaxed text-white/85 sm:block" style={{ '--d': '0.8s' } as React.CSSProperties}>
                    {t('landing.hero.sub')}
                  </p>
                  <div className="fade-up mt-6 flex flex-wrap items-center gap-3" style={{ '--d': '0.95s' } as React.CSSProperties}>
                    <Magnetic>
                      <LocalLink href="/catalogo" data-cursor={t('landing.hero.ctaBuy').split(' ')[0]} className="btn btn-green">
                        {t('landing.hero.ctaBuy')} <Arrow />
                      </LocalLink>
                    </Magnetic>
                    <LocalLink href="/publicar" className="btn btn-ghost">
                      {t('landing.hero.ctaSell')} <Arrow />
                    </LocalLink>
                  </div>
                </div>
              </div>
              <div className="fade-up mt-6 hidden lg:block" style={{ '--d': '1.1s' } as React.CSSProperties}>
                {searchEl}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="bg-night px-5 pb-8 pt-5 sm:px-8 lg:hidden">{searchEl}</div>

      {/* ═══════════ FABRICANTES ═══════════ */}
      <section aria-label={t('landing.marquee.label')} className="overflow-hidden border-b border-white/10 py-5 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]">
        <div className="marquee">
          {[0, 1].map((dup) => (
            <ul key={dup} className="flex shrink-0 items-center" aria-hidden={dup === 1}>
              {fabricantes.map((f) => (
                <li key={f} className="flex items-center">
                  <LocalLink href="/marcas" tabIndex={dup === 1 ? -1 : undefined} className="t-wide whitespace-nowrap px-7 text-[15px] tracking-[0.04em] text-white/45 transition-colors duration-300 hover:text-white">
                    {f}
                  </LocalLink>
                  <span className="h-1.5 w-1.5 rotate-45 bg-leaf-300" aria-hidden="true" />
                </li>
              ))}
            </ul>
          ))}
        </div>
      </section>

      {/* ═══════════ MANIFIESTO ═══════════ */}
      <section
        className="aura topo relative overflow-hidden bg-night-800 py-24 lg:py-36"
        style={{ '--ax': '100%', '--ay': '0%', '--bx': '0%', '--by': '100%' } as React.CSSProperties}
      >
        <div className={CONTAINER}>
          <div className="grid gap-14 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-8">
              <Eyebrow n="01">{t('landing.statement.eyebrow')}</Eyebrow>
              <TextReveal
                className="t-mega mt-10 text-[clamp(2.6rem,5.5vw,6.2rem)]"
                lines={[{ t: t('landing.statement.l1') }, { t: t('landing.statement.l2') }, { t: t('landing.statement.l3'), outline: true }]}
              />
              <Reveal>
                <p className="mt-10 max-w-xl text-[18px] leading-relaxed text-white/70">{t('landing.statement.text')}</p>
              </Reveal>
            </div>
            <Reveal className="lg:col-span-4" delay={0.1}>
              <figure className="ticks relative mx-auto max-w-[420px] lg:ml-auto">
                <i /><i /><i /><i />
                <div className="relative aspect-[4/5] overflow-hidden bg-night-700">
                  <Image src="/home/campers.webp" alt={FAMILIA_FOTO.campers.alt} fill sizes="(max-width: 1024px) 80vw, 420px" quality={80} className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-night/60 via-transparent to-night/10" aria-hidden="true" />
                  <span className="micro absolute left-4 top-4 bg-night/70 px-2.5 py-1.5 text-white backdrop-blur">{t('landing.statement.fig')}</span>
                </div>
              </figure>
            </Reveal>
          </div>

          <dl className="mt-20 grid grid-cols-2 border-y border-white/12 lg:mt-28 lg:grid-cols-4">
            {stats.map((s, i) => (
              <div key={s.label} className={`relative flex flex-col px-5 py-9 lg:px-8 lg:py-12 ${i > 0 ? 'lg:border-l lg:border-white/12' : ''} ${i % 2 === 1 ? 'border-l border-white/12 lg:border-l' : ''} ${i > 1 ? 'border-t border-white/12 lg:border-t-0' : ''}`}>
                <span className="absolute left-0 top-0 h-[3px] w-10 bg-leaf lg:left-8" aria-hidden="true" />
                <dd className="t-num order-1 text-[clamp(3.4rem,6vw,6.2rem)] leading-none">
                  <Odometer value={s.value} suffix={s.suffix} />
                </dd>
                <dt className="micro order-2 mt-4 max-w-[190px] !text-[10.5px] !leading-[1.5] text-white/55">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ═══════════ RUTAS (familias) ═══════════ */}
      <RoutePanels panels={rutas} explore={t('landing.families.explore')} kicker={t('landing.families.kicker')} />

      {/* ═══════════ EN EL MERCADO AHORA ═══════════ */}
      <div className="relative z-10">
        <Gallery
          items={recientes.map((p: any) => toGalleryItem(p, t))}
          labels={{
            featured: t('landing.listings.featured'),
            isNew: t('landing.listings.isNew'),
            see: t('landing.listings.see'),
            empty: t('landing.listings.empty'),
            emptyCta: t('landing.listings.emptyCta'),
            progress: t('landing.listings.progress'),
          }}
          header={
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <Eyebrow tone="dark" n="03">{t('landing.listings.eyebrow')}</Eyebrow>
                <TextReveal
                  inline
                  className="t-mega mt-6 block text-[clamp(3.6rem,8.4vw,8.6rem)]"
                  lines={[{ t: t('landing.listings.l1') }, { t: t('landing.listings.l2'), outline: true }]}
                />
              </div>
              <Magnetic>
                <LocalLink href="/catalogo" className="btn btn-ink">
                  {t('landing.listings.all')} <Arrow />
                </LocalLink>
              </Magnetic>
            </div>
          }
        />
      </div>

      {/* ═══════════ RECORRIDO DE COMPRA ═══════════ */}
      <section className="aura topo relative overflow-hidden bg-night py-24 lg:py-36" style={{ '--ax': '0%', '--ay': '40%', '--bx': '100%', '--by': '80%' } as React.CSSProperties}>
        <div className={CONTAINER}>
          <Eyebrow n="04">{t('landing.journey.eyebrow')}</Eyebrow>
          <TextReveal
            className="t-mega mt-8 text-[clamp(3.6rem,11vw,11.5rem)]"
            lines={[{ t: t('landing.journey.l1') }, { t: t('landing.journey.l2'), outline: true }]}
          />
        </div>
        <div className="mt-14 lg:mt-16">
          <RoadJourney steps={pasos} />
        </div>
      </section>

      {/* ═══════════ VENDE ═══════════ */}
      <section className="relative overflow-hidden bg-flare py-20 text-night [--stroke:#0B1120] lg:py-32">
        <BigMarquee words={[t('landing.sell.m1'), t('landing.sell.m2'), t('landing.sell.m3'), t('landing.sell.m4')]} />
        <div className={`${CONTAINER} mt-20 lg:mt-32`}>
          <div className="grid gap-12 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <Eyebrow tone="dark" n="05" nClass="text-night">{t('landing.sell.eyebrow')}</Eyebrow>
              <TextReveal
                className="t-wide mt-8 text-[clamp(2.6rem,5.6vw,5.8rem)] leading-[0.92]"
                lines={[{ t: t('landing.sell.title') }]}
              />
            </div>
            <Reveal className="lg:col-span-4 lg:col-start-9 lg:pt-14">
              <p className="max-w-md text-[17px] leading-relaxed text-night/85">{t('landing.sell.text')}</p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Magnetic>
                  <LocalLink href="/publicar" className="btn btn-ink">{t('landing.sell.ctaPublish')} <Arrow /></LocalLink>
                </Magnetic>
                <LocalLink href="/cuanto-vale-mi-camper" className="inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.1em]">
                  <span className="link-draw pb-1">{t('landing.sell.ctaValue')}</span>
                </LocalLink>
              </div>
            </Reveal>
          </div>

          <div className="mt-20 grid border-t border-night/30 lg:mt-28 lg:grid-cols-3">
            {audiencias.map((a, i) => (
              <Reveal key={a.key} delay={i * 0.08} className={`py-9 ${i > 0 ? 'border-t border-night/30 lg:border-l lg:border-t-0 lg:pl-9' : ''} ${i < 2 ? 'lg:pr-9' : ''}`}>
                <p className="t-num text-[13px] text-night/75">0{i + 1}</p>
                <h3 className="t-wide mt-4 text-[clamp(1.5rem,2.3vw,2.1rem)] leading-[0.98]">{t(`home.audiences.${a.key}.title`)}</h3>
                <p className="mt-3 max-w-sm text-[15.5px] leading-relaxed text-night/85">{t(`home.audiences.${a.key}.desc`)}</p>
                <div className="mt-6 flex flex-col items-start gap-2.5 text-[13px] font-semibold uppercase tracking-[0.08em]">
                  <LocalLink href="/publicar" className="inline-flex items-center gap-1.5"><span className="link-draw pb-0.5">{t('home.audiences.cta')}</span> <ArrowRight size={14} aria-hidden="true" /></LocalLink>
                  <LocalLink href={`/catalogo?vendedor=${a.vendedor}`} className="text-night/75 transition-colors hover:text-night">
                    {t('home.audiences.buyCta', { tipo: t(`tiposVendedor.${a.plural}`) })}
                  </LocalLink>
                  {a.key !== 'private' && (
                    <LocalLink href="/para-profesionales" className="text-night/75 transition-colors hover:text-night">{t('home.audiences.plansCta')}</LocalLink>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ GUÍAS ═══════════ */}
      {guias.length > 0 && (
        <section className="aura topo relative overflow-hidden bg-night-800" style={{ '--ax': '100%', '--ay': '0%', '--bx': '0%', '--by': '100%' } as React.CSSProperties}>
          <div className={`${CONTAINER} grid gap-14 py-24 lg:grid-cols-12 lg:py-36`}>
            <div className="lg:col-span-5">
              <Eyebrow n="06">{t('landing.guides.eyebrow')}</Eyebrow>
              <TextReveal
                className="t-mega mt-8 text-[clamp(3.2rem,7vw,7.4rem)]"
                lines={[{ t: t('landing.guides.l1') }, { t: t('landing.guides.l2'), outline: true }]}
              />
              <Magnetic className="mt-10">
                <LocalLink href="/blog" className="btn btn-ghost">{t('home.guides.viewAll')} <Arrow /></LocalLink>
              </Magnetic>
            </div>
            <div className="lg:col-span-7">
              {guias.map((g, i) => (
                <Reveal key={g.slug} delay={i * 0.08} className="border-t border-white/15 last:border-b">
                  <LocalLink href={`/blog/${g.slug}`} data-cursor={t('landing.listings.see')} className="group grid gap-3 py-8 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-8">
                    <div>
                      <p className="t-num text-[13px] text-white/45">{String(i + 1).padStart(2, '0')} · {g.readTime}</p>
                      <h3 className="t-wide mt-3 text-[clamp(1.5rem,2.5vw,2.4rem)] leading-[0.98] transition-transform duration-500 group-hover:translate-x-3">{g.title}</h3>
                      <p className="mt-3 line-clamp-2 max-w-2xl text-[15px] leading-relaxed text-white/55">{g.excerpt}</p>
                    </div>
                    <ArrowUpRight size={30} className="hidden shrink-0 text-white/40 transition-all duration-500 group-hover:rotate-45 group-hover:text-leaf-300 sm:block" aria-hidden="true" />
                  </LocalLink>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ PROVINCIAS ═══════════ */}
      <section className="relative overflow-hidden bg-night"><div className={`${CONTAINER} pb-24 pt-24 lg:pb-40 lg:pt-36`}>
        <Eyebrow n="07">{t('landing.provinces.eyebrow')}</Eyebrow>
        <TextReveal
          className="t-mega mt-8 text-[clamp(3.2rem,8vw,8.4rem)]"
          lines={[{ t: t('landing.provinces.l1') }, { t: t('landing.provinces.l2'), outline: true }]}
        />
        <div className="mt-16 lg:mt-24">
          <ProvinceList items={listaProvincias} label={t('landing.provinces.label')} />
        </div>
      </div></section>

      {/* ═══════════ CTA FINAL ═══════════ */}
      <section className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-night">
        <Image src="/home/cta.webp" alt="" fill sizes="100vw" className="-z-10 object-cover" quality={80} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-night/90 via-night/30 to-night/40" aria-hidden="true" />
        <div className="grain absolute inset-0 -z-10" aria-hidden="true" />
        <div className={`${CONTAINER} pb-14 pt-32 lg:pb-20`}>
          <TextReveal
            className="t-mega text-[clamp(3.6rem,13.5vw,15rem)]"
            lines={[{ t: t('landing.cta.l1') }, { t: t('landing.cta.l2'), cls: 'text-leaf-300' }]}
          />
          <div className="mt-10 grid gap-8 lg:grid-cols-12 lg:items-end">
            <p className="max-w-xl text-[17px] leading-relaxed text-white/75 lg:col-span-6">{t('landing.cta.sub')}</p>
            <div className="flex flex-wrap items-center gap-3 lg:col-span-6 lg:justify-end">
              <Magnetic>
                <LocalLink href="/publicar" className="btn btn-green">{t('landing.cta.publish')} <Arrow /></LocalLink>
              </Magnetic>
              <LocalLink href="/cuanto-vale-mi-camper" className="btn btn-ghost">{t('landing.cta.value')} <Arrow /></LocalLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
