import { serializeJsonLd } from '@/lib/serialize-json-ld'
import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { MARCAS_MODELOS, agruparPorFabricante, etiquetaModelo } from '@/lib/marcas'
import ValorarClient from './ValorarClient'

/**
 * «¿Cuánto vale mi camper?» — el lead-magnet del vendedor.
 *
 * Capta al propietario ANTES de que vaya a publicar a otro sitio: le damos una
 * cifra útil y, con ella en la mano, el paso natural es publicar aquí.
 */

export const revalidate = 86400

const SITIO = 'https://camperocasion.online'

export async function generateMetadata(): Promise<Metadata> {
  const title = '¿Cuánto vale mi camper? Tasación gratis online'
  const description =
    'Calcula gratis el precio de tu furgoneta camper o autocaravana con los precios reales de los anuncios publicados en España. Sin registro y en menos de un minuto.'
  const url = `${SITIO}/cuanto-vale-mi-camper`

  return {
    title,
    description,
    alternates: { canonical: url, languages: { 'es-ES': url, 'x-default': url } },
    openGraph: { title, description, url, siteName: 'CamperOcasión', locale: 'es_ES', type: 'website', images: [{ url: SITIO + '/api/og/catalog?categoria=camper', width: 1200, height: 630, alt: title }] },
    twitter: { card: 'summary_large_image', title, description, images: [SITIO + '/api/og/catalog?categoria=camper'] },
  }
}

export default async function ValorarPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  // El selector se construye en servidor desde el catálogo maestro: así el
  // valor enviado es siempre el canónico que está guardado en `productos.marca`.
  const grupos = agruparPorFabricante(MARCAS_MODELOS).map(g => ({
    fabricante: g.fabricante,
    modelos: g.modelos.map(m => ({ valor: m.valor, etiqueta: etiquetaModelo(m) })),
  }))

  const faq = [
    {
      q: '¿Cómo se calcula el valor de mi camper?',
      a: 'Partimos de la mediana de precio de los anuncios reales de ese mismo modelo publicados en CamperOcasión y la ajustamos por antigüedad, kilometraje y estado. Si todavía no hay anuncios suficientes de tu modelo, usamos la tabla oficial de depreciación de Hacienda sobre el precio que costó nuevo.',
    },
    {
      q: '¿Es una tasación oficial?',
      a: 'No. Es una estimación orientativa de mercado basada en lo que se está pidiendo hoy por vehículos parecidos. Para una tasación oficial (seguros, herencias, litigios) necesitas un perito.',
    },
    {
      q: '¿Tengo que registrarme?',
      a: 'No. La estimación es gratuita y no pedimos ningún dato personal para dártela.',
    },
    {
      q: '¿Por qué a veces no me da un precio?',
      a: 'Porque preferimos no darte una cifra antes que darte una que no se sostenga. Si no hay anuncios suficientes de tu modelo y no sabemos lo que costó nuevo, no hay base real para estimar.',
    },
  ]

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITIO + '/' },
      { '@type': 'ListItem', position: 2, name: '¿Cuánto vale mi camper?', item: SITIO + '/cuanto-vale-mi-camper' },
    ],
  }
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': SITIO + '/cuanto-vale-mi-camper#faq',
    mainEntity: faq.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [breadcrumbJsonLd, faqJsonLd],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <ValorarClient grupos={grupos} faq={faq} />
    </>
  )
}
