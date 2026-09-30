import { serializeJsonLd } from '@/lib/serialize-json-ld'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { supabase } from '@/lib/supabase-server-client'
import { COLUMNAS_PRECIO, getPrecioEur } from '@/lib/precio'
import {
  MARCAS_MODELOS,
  etiquetaModelo,
  modeloPorSlug,
  slugModelo,
} from '@/lib/marcas'
import {
  calcularEstadisticas,
  estadisticasPorTramo,
  resumenMercado,
} from '@/lib/precios-mercado'
import ModeloClient from './ModeloClient'
import { productAbsoluteUrl } from '@/lib/product-url'

/**
 * Página de modelo: «Fiat Ducato camper de ocasión: precios reales».
 *
 * El contenido único no es la lista de anuncios (eso lo tiene cualquiera), son
 * **las estadísticas de precio calculadas con nuestro propio inventario**.
 * Nadie más en España publica la mediana y el rango P25-P75 de una Ducato
 * camper por tramo de antigüedad. Eso es lo que Google premia y lo que hace
 * que alguien enlace la página.
 *
 * Regla que no se negocia: si no hay muestra suficiente, **no se publica
 * ningún número**. Una cifra inventada en una página que la gente cita como
 * referencia destruye justo el activo que estamos construyendo.
 */

export const revalidate = 3600

type Props = { params: Promise<{ locale: string; slug: string }> }

const SITIO = 'https://camperocasion.online'

/**
 * Prerenderizamos las páginas de modelo en build: son 95 URLs estáticas con
 * ISR de una hora, que es justo el caso para el que sirve `generateStaticParams`.
 */
export function generateStaticParams() {
  return MARCAS_MODELOS.map(m => ({ slug: slugModelo(m) }))
}

async function getDatosModelo(slug: string) {
  const modelo = modeloPorSlug(slug)
  if (!modelo) return null
  if (!supabase) return { modelo, anuncios: [], est: null, tramos: [] }

  const { data } = await supabase
    .from('productos')
    .select(
      `id, slug, titulo, ${COLUMNAS_PRECIO}, imagen_url, subcategoria, ` +
        'ubicacion_ciudad, ubicacion_estado, estado, boosteado_en, destacado, destacado_hasta, ' +
        'vendedor_verificado, vendedor_tipo, verificacion_homologacion, reservado, es_demo, ' +
        'espec_km, espec_anio'
    )
    .eq('marca', modelo.valor)
    .eq('activo', true)
    .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado,estado_moderacion.eq.pendiente')
    .order('creado_en', { ascending: false })
    .limit(200)

  const anuncios = data || []

  const paraEstadistica = anuncios.map(a => ({
    precio: getPrecioEur(a),
    anio: a.espec_anio != null ? Number(a.espec_anio) : null,
    km: a.espec_km != null ? Number(a.espec_km) : null,
    es_demo: a.es_demo,
  }))

  return {
    modelo,
    anuncios,
    est: calcularEstadisticas(paraEstadistica),
    tramos: estadisticasPorTramo(paraEstadistica),
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const datos = await getDatosModelo(slug)

  if (!datos) {
    return { title: 'Modelo no encontrado', robots: { index: false, follow: false } }
  }

  const { modelo, est } = datos
  const nombre = modelo.valor
  const anio = new Date().getFullYear()

  const title = est
    ? `${nombre} de ocasión: precios reales ${anio} (${est.muestra} anuncios)`
    : `${nombre} de ocasión en España`

  const description = resumenMercado(nombre, est)
  const url = `${SITIO}/modelo/${slug}`

  // OG con categoria según el modelo (usa endpoint existente)
  const subCat = (modelo as any).aptoPara?.[0] || 'camper'
  const ogParamMap: Record<string,string> = {
    'gran-volumen': 'gran-volumen',
    'camper-mediana': 'camper-mediana',
    'minicamper': 'minicamper',
    'perfilada': 'perfilada',
    'capuchina': 'capuchina',
    'integral': 'integral',
    'overland': 'overland',
  }
  const ogParam = ogParamMap[subCat] || 'camper'

  return {
    title,
    description,
    alternates: { canonical: url, languages: { 'es-ES': url, 'x-default': url } },
    openGraph: { title, description, url, siteName: 'CamperOcasión', locale: 'es_ES', images: [{ url: `https://camperocasion.online/api/og/catalog?categoria=${ogParam}`, width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: [`https://camperocasion.online/api/og/catalog?categoria=${ogParam}`] },
  }
}

export default async function ModeloPage({ params }: Props) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const datos = await getDatosModelo(slug)
  if (!datos) notFound()

  const { modelo, anuncios, est, tramos } = datos

  // Modelos hermanos del mismo fabricante, para enlazado interno: es lo que
  // reparte autoridad entre las 95 páginas en vez de dejarlas aisladas.
  const hermanos = MARCAS_MODELOS.filter(
    m => m.fabricante === modelo.fabricante && m.valor !== modelo.valor
  ).slice(0, 8)

  const pageUrl = SITIO + '/modelo/' + slug

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITIO + '/' },
      { '@type': 'ListItem', position: 2, name: 'Marcas', item: SITIO + '/marcas' },
      { '@type': 'ListItem', position: 3, name: modelo.fabricante, item: SITIO + '/catalogo?marca=' + encodeURIComponent(modelo.fabricante) },
      { '@type': 'ListItem', position: 4, name: etiquetaModelo(modelo), item: pageUrl },
    ],
  }

  // Schema principal: ProductModel + AggregateOffer mejorado
  // ProductModel es más preciso que Product para una página de modelo con estadísticas
  const productModelJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    name: modelo.valor + ' camper de ocasión',
    model: modelo.valor,
    brand: { '@type': 'Brand', name: modelo.fabricante },
    ...(modelo.nota ? { description: modelo.nota } : {}),
    url: pageUrl,
    // Oferta agregada con datos de mercado reales
    ...(est
      ? {
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'EUR',
            lowPrice: est.p25,
            highPrice: est.p75,
            offerCount: est.muestra,
            availability: 'https://schema.org/InStock',
            // Mediana como high/low auxiliar para rich results
            ...(est.mediana ? { median: est.mediana } : {}),
          },
          // Estadística adicional como QuantitativeValue para P25-P75
          aggregateRating: undefined,
        }
      : {}),
  }

  // Si hay anuncios, añadir ItemList
  const itemListJsonLd = anuncios.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': pageUrl + '#itemlist',
    name: 'Anuncios de ' + modelo.valor + ' de ocasión',
    numberOfItems: Math.min(anuncios.length, 20),
    itemListElement: anuncios.slice(0, 20).map((p: any, i: number) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: productAbsoluteUrl(p, SITIO),
      name: p.titulo,
      ...(p.imagen_url ? { image: p.imagen_url } : {}),
      offers: {
        '@type': 'Offer',
        price: getPrecioEur(p) || 0,
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        url: productAbsoluteUrl(p, SITIO),
      },
    })),
  } : null

  // Fallback Product para compatibilidad (Google entiende Vehicle pero Product es más broadly supported)
  // Mantenemos Product + AggregateOffer como segunda entidad en @graph
  const graphJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbJsonLd,
      productModelJsonLd,
      ...(itemListJsonLd ? [itemListJsonLd] : []),
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(graphJsonLd) }}
      />
      <ModeloClient
        modelo={modelo}
        etiqueta={etiquetaModelo(modelo)}
        anuncios={anuncios}
        est={est}
        tramos={tramos}
        hermanos={hermanos.map(h => ({
          valor: h.valor,
          etiqueta: etiquetaModelo(h),
          slug: slugModelo(h),
        }))}
      />
    </>
  )
}
