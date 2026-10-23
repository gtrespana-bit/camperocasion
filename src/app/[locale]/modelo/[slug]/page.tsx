import { serializeJsonLd } from '@/lib/serialize-json-ld'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { supabase } from '@/lib/supabase-server-client'
import { COLUMNAS_PRECIO, formatPrecio, getPrecioEur } from '@/lib/precio'
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
import LocalLink from '@/components/LocalLink'
import { ArrowRight } from 'lucide-react'
import { alternatesSeo, descripcionSeo, tituloSeo } from '@/lib/seo'

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

  const description = descripcionSeo(resumenMercado(nombre, est))
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
    title: tituloSeo(title),
    description,
    alternates: alternatesSeo(`/modelo/${slug}`),
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

  // FAQ dinámica: las dos primeras respuestas se construyen con las
  // estadísticas REALES del inventario (nunca se publica una cifra
  // sin muestra suficiente — ver la regla del comentario arriba).
  const nombre = modelo.valor
  const faqs: { pregunta: string; respuesta: string }[] = []
  if (est && est.muestra >= 3 && est.mediana) {
    faqs.push({
      pregunta: `¿Cuánto cuesta un ${nombre} camper de segunda mano?`,
      respuesta: `Según los ${est.muestra} anuncios activos de CamperOcasión, el precio de referencia de un ${nombre} camper es de ${formatPrecio(est.mediana)} de mediana, con la mitad de los anuncios entre ${formatPrecio(est.p25)} y ${formatPrecio(est.p75)}. El precio final depende del año, los kilómetros, el equipamiento de autonomía y de si la camperización está homologada como vehículo vivienda.`,
    })
  }
  faqs.push({
    pregunta: `¿Cuántos ${nombre} hay en venta ahora mismo?`,
    respuesta: anuncios.length > 0
      ? `Hay ${anuncios.length} anuncios activos de ${nombre} en CamperOcasión, de toda España. Puedes filtrarlos por precio, kilómetros, año y homologación verificada en el catálogo filtrado por ${nombre}.`
      : `Ahora mismo no hay anuncios activos de ${nombre}, pero puedes publicar el tuyo gratis o filtrar el catálogo por la marca ${modelo.fabricante} para ver modelos cercanos.`,
  })
  faqs.push({
    pregunta: `¿Qué debo revisar en un ${nombre} camper de segunda mano?`,
    respuesta: `Antes de pagar: la ficha técnica (homologación 2448/3148 si promete vida a bordo), la ITV al día, el estado del chasis y la corrosión, el motor y la caja de cambios, y el equipamiento de autonomía (batería auxiliar, placa solar, calefacción, agua y fugas). Tenemos el checklist completo en nuestra guía de compra segura de camper.`,
  })
  faqs.push({
    pregunta: `¿Se puede conducir un ${nombre} con el permiso B?`,
    respuesta: `Sí, mientras la MMA (peso máximo autorizado) no supere los 3.500 kg, lo habitual en un ${nombre}. Versiones muy cargadas o con célula pueden superar ese límite y exigir B+E o C1: comprueba siempre la MMA en la ficha técnica antes de comprar.`,
  })

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': pageUrl + '#faq',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.pregunta,
      acceptedAnswer: { '@type': 'Answer', text: f.respuesta },
    })),
  }

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
      faqJsonLd,
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

      {/* FAQ visible (Google la usa para "La gente también pregunta") */}
      <section className="max-w-7xl mx-auto px-4 py-10 border-t border-gray-100">
        <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-4">
          Preguntas frecuentes sobre el {nombre} camper
        </h2>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <details key={i} className="bg-white border border-gray-200 rounded-xl p-4 group">
              <summary className="font-bold text-gray-900 cursor-pointer list-none flex justify-between items-center gap-4">
                {f.pregunta}
                <ArrowRight size={16} className="text-brand-accent shrink-0 transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-sm text-gray-700 leading-relaxed">{f.respuesta}</p>
            </details>
          ))}
        </div>
        <p className="mt-6 text-sm text-gray-500">
          ¿Quieres vender el tuyo?{' '}
          <LocalLink href="/publicar" className="text-brand-primary font-semibold hover:underline">
            Publica gratis tu {nombre}
          </LocalLink>{' '}
          o consulta el{' '}
          <LocalLink href="/cuanto-vale-mi-camper" className="text-brand-primary font-semibold hover:underline">
            valorador de campers
          </LocalLink>{' '}
          para saber cuánto vale tu vehículo.
        </p>
      </section>
    </>
  )
}
