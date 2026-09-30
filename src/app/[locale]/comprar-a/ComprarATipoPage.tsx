import { serializeJsonLd } from '@/lib/serialize-json-ld'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import LocalLink from '@/components/LocalLink'
import ProductCard from '@/components/ProductCard'
import { supabase } from '@/lib/supabase-server-client'
import {
  CATALOG_PRODUCT_COLUMNS,
  CATALOG_FILTRO_MODERACION,
  aplicarOrdenCatalogo,
  marcarDestacados,
  ordenarProductosCatalogo,
  type ProductoCatalogo,
} from '@/lib/catalog-consulta'
import { ChevronRight } from 'lucide-react'

// ── Landings SEO por tipo de vendedor (Fase 3) ────────────────────────────
// /comprar-a-particulares, /comprar-a-camperizadores, /comprar-a-profesionales
// Tres carpetas estáticas (una por slug) que comparten este componente:
// las rutas estáticas ganan la prioridad frente al catch-all /[ciudad] y el
// segmento no depende de la resolución de params dinámicos.

export type SlugTipo = 'particulares' | 'camperizadores' | 'profesionales'

export const SLUG_A_TIPO: Record<SlugTipo, 'particular' | 'camperizador' | 'profesional'> = {
  particulares: 'particular',
  camperizadores: 'camperizador',
  profesionales: 'profesional',
}

const TIPO_A_PLURAL_KEY: Record<SlugTipo, string> = {
  particulares: 'particulares',
  camperizadores: 'camperizadores',
  profesionales: 'profesionales',
}

const BASE_URL = 'https://camperocasion.online'
const LIMITE = 24

export async function metadataParaTipo(locale: string, slug: SlugTipo): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'vendedorLanding' })
  const tipoKey = SLUG_A_TIPO[slug]

  const canonical = `${BASE_URL}/comprar-a-${slug}`
  return {
    title: t(`${tipoKey}.metaTitle`),
    description: t(`${tipoKey}.metaDescription`),
    alternates: {
      // Solo la versión ES se indexa (la /en lleva X-Robots-Tag: noindex).
      canonical,
      languages: { 'es-ES': canonical, 'x-default': canonical },
    },
    openGraph: {
      title: t(`${tipoKey}.metaTitle`),
      description: t(`${tipoKey}.metaDescription`),
      locale: 'es_ES',
      url: canonical,
      type: 'website',
      siteName: 'CamperOcasión',
      images: [{ url: BASE_URL + '/api/og/catalog?categoria=camper', width: 1200, height: 630, alt: t(`${tipoKey}.metaTitle`) }],
    },
    twitter: {
      card: 'summary_large_image',
      title: t(`${tipoKey}.metaTitle`),
      description: t(`${tipoKey}.metaDescription`),
      images: [BASE_URL + '/api/og/catalog?categoria=camper'],
    },
  }
}

async function getProductosDeTipo(tipo: string) {
  if (!supabase) return [] as ProductoCatalogo[]
  try {
    const { data, error } = await aplicarOrdenCatalogo(
      supabase
        .from('productos')
        .select(CATALOG_PRODUCT_COLUMNS, { count: 'exact' })
        .eq('activo', true)
        .or(CATALOG_FILTRO_MODERACION)
        .eq('vendedor_tipo', tipo),
    ).limit(LIMITE)

    if (error || !data) return []
    // Mismo orden que el catálogo: boost > destacado vigente > fecha.
    return ordenarProductosCatalogo(marcarDestacados(data as unknown as ProductoCatalogo[]))
  } catch {
    return []
  }
}

/**
 * ISR de 5 minutos: estas landings también listan anuncios y se prerenderizan,
 * así que sin `revalidate` se quedaban con los anuncios del día del build.
 */
export const revalidate = 300

export default async function ComprarATipoPage({
  params,
  slug,
}: {
  params: Promise<{ locale: string }>
  slug: SlugTipo
}) {
  const { locale } = await params
  const tipoKey = SLUG_A_TIPO[slug]
  if (!tipoKey) notFound()

  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'vendedorLanding' })
  const tt = await getTranslations({ locale, namespace: 'tiposVendedor' })
  const tnav = await getTranslations({ locale, namespace: 'nav' })
  const productos = await getProductosDeTipo(tipoKey)

  const pageUrl = BASE_URL + '/comprar-a-' + slug
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: BASE_URL + '/' },
      { '@type': 'ListItem', position: 2, name: 'Catálogo', item: BASE_URL + '/catalogo' },
      { '@type': 'ListItem', position: 3, name: t(`${tipoKey}.title`), item: pageUrl },
    ],
  }
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': pageUrl + '#collection',
    name: t(`${tipoKey}.title`),
    description: t(`${tipoKey}.intro`),
    url: pageUrl,
    isPartOf: { '@id': BASE_URL + '/#website' },
    breadcrumb: { '@id': pageUrl + '#breadcrumb' },
    ...(productos.length > 0 ? { mainEntity: { '@id': pageUrl + '#itemlist' } } : {}),
  }
  const itemListJsonLd = productos.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': pageUrl + '#itemlist',
    name: t(`${tipoKey}.title`),
    numberOfItems: productos.length,
    itemListElement: productos.map((p: any, i: number) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: BASE_URL + '/producto/' + (p.slug || p.id),
      name: p.titulo,
      ...(p.imagen_url ? { image: p.imagen_url } : {}),
      offers: { '@type': 'Offer', price: p.precio_usd || 0, priceCurrency: 'EUR', availability: 'https://schema.org/InStock', url: BASE_URL + '/producto/' + (p.slug || p.id) },
    })),
  } : null
  const graphJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbJsonLd, collectionJsonLd, ...(itemListJsonLd ? [itemListJsonLd] : [])],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(graphJsonLd) }} />
      <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb ligero: contexto para el visitante y para el crawler. */}
      <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-sm text-gray-500 mb-6">
        <LocalLink href="/" className="hover:text-brand-primary">{tnav('home')}</LocalLink>
        <ChevronRight size={14} />
        <LocalLink href="/catalogo" className="hover:text-brand-primary">{tnav('catalog')}</LocalLink>
        <ChevronRight size={14} />
        <span className="text-gray-900 font-medium">{tt(TIPO_A_PLURAL_KEY[slug])}</span>
      </nav>

      <div className="max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
          {t(`${tipoKey}.title`)}
        </h1>
        <p className="text-gray-500 leading-relaxed mb-6">{t(`${tipoKey}.intro`)}</p>

        <div className="flex flex-wrap gap-3 mb-8">
          <LocalLink
            href={`/catalogo?vendedor=${tipoKey}`}
            className="inline-flex items-center gap-2 bg-brand-primary text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-dark transition"
          >
            {t('catalogCta')}
          </LocalLink>
          <LocalLink
            href="/publicar"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-gray-50 transition"
          >
            {t('publishCta')}
          </LocalLink>
        </div>
      </div>

      <h2 className="font-bold text-gray-900 text-xl mb-4">
        {t('gridTitle', { tipo: tt(TIPO_A_PLURAL_KEY[slug]) })}
      </h2>

      {productos.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {productos.map((p, i) => (
            <ProductCard
              key={p.id}
              p={{
                ...p,
                precio_usd: p.precio_usd ?? 0,
                estado: p.estado || '',
                boosteado_en: p.boosteado_en ?? null,
                destacado: !!p.destacado,
                destacado_hasta: p.destacado_hasta ?? null,
              }}
              // Flag pre-computado en el servidor (marcarDestacados) para
              // evitar mismatch de hidratación con la fecha de caducidad.
              isFeatured={!!p._isFeatured}
              priority={i < 4}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center">
          <p className="text-gray-500 text-sm">{t('empty')}</p>
          <LocalLink
            href="/publicar"
            className="mt-4 inline-flex items-center gap-2 bg-brand-accent text-white px-4 py-2.5 rounded-lg text-sm font-bold hover:bg-brand-dark transition"
          >
            {t('publishCta')}
          </LocalLink>
        </div>
      )}

      {/* Internal linking entre las tres landings de tipo de vendedor. */}
      <div className="mt-10 pt-6 border-t border-gray-100 flex flex-wrap gap-2">
        {(Object.keys(SLUG_A_TIPO) as SlugTipo[])
          .filter(s => s !== slug)
          .map(s => (
            <LocalLink
              key={s}
              href={`/comprar-a-${s}`}
              className="text-sm text-gray-500 hover:text-brand-primary border border-gray-200 rounded-full px-3 py-1.5 transition"
            >
              {t(`${SLUG_A_TIPO[s]}.title`)}
            </LocalLink>
          ))}
      </div>
    </div>
    </>
  )
}
