import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LandingCiudad from './LandingCiudad'
import { getCiudadBySlug } from '@/lib/ubicaciones-seo'
import Breadcrumbs from '@/components/Breadcrumbs'
import { getTranslations } from 'next-intl/server'
import { getSupabaseServerClient } from '@/lib/supabase-server-client'
import { hayAnunciosEnCiudad } from '@/lib/seo-landings'

type Props = {
  params: Promise<{ ciudad: string; locale: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ciudad, locale } = await params
  const ciudadSEO = getCiudadBySlug(ciudad)

  if (!ciudadSEO) {
    const t = await getTranslations({ locale, namespace: 'notFound' })
    return {
      title: t('title'),
      description: t('description'),
    }
  }

  const title = ciudadSEO.titulo
  const description = ciudadSEO.descripcion
  const keywords = ciudadSEO.keywords.join(', ')

  return {
    title,
    description,
    keywords: ciudadSEO.keywords,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'es_ES',
    },
    alternates: {
      canonical: `https://camperocasion.es/${ciudad}`,
      languages: {
        'es-ES': `https://camperocasion.es/${ciudad}`,
        'x-default': `https://camperocasion.es/${ciudad}`,
      },
    },
    robots: {
      // Ciudad sin anuncios = página vacía: fuera del índice (pero se
      // rastrea) hasta que haya inventario. Fail-open si la DB falla.
      index: await hayAnunciosEnCiudad(getSupabaseServerClient(), ciudadSEO.nombre, ciudadSEO.municipio),
      follow: true,
    },
  }
}

// IMPORTANTE — Esta ruta es DINÁMICA a propósito:
// Antes tenía `generateStaticParams()` (SSG/ISR). En Next 16, renderizar
// on-demand una ruta SSG (o prerenderizarla con el layout raíz, que usa
// cookies()/headers()) lanza `DynamicServerError` (digest
// DYNAMIC_SERVER_USAGE) → 500 en TODAS las páginas de ciudad (/caracas, etc.).
// Además, generateStaticParams devolvía `{ city: slug }` en vez de
// `{ ciudad: slug }`, así que Next ignoraba todos los params y la ruta
// quedaba marcada SSG sin páginas prerenderizadas: cada visita intentaba una
// "static generation on demand" que fallaba. Sin generateStaticParams la ruta
// se sirve igual que la home (/catalogo, /buscar): SSR dinámico y sin 500.
export default async function CiudadPage({ params }: Props) {
  const { ciudad, locale } = await params
  const ciudadSEO = getCiudadBySlug(ciudad)
  
  if (!ciudadSEO) {
    // 404 real (antes: div con estado 200 = soft-404 que Google penaliza)
    notFound()
  }

  // Breadcrumb items
  const breadcrumbItems = [
    { label: ciudadSEO.nombre, href: undefined }
  ]

  // JSON-LD Provincial Area Schema
  const cityJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AdministrativeArea',
    name: ciudadSEO.nombre,
    containedInPlace: {
      '@type': 'State',
      name: ciudadSEO.estado,
      containedInPlace: {
        '@type': 'Country',
        name: 'España',
        addressCountry: 'ES'
      }
    },
    description: ciudadSEO.descripcion,
    sameAs: `https://camperocasion.es/${ciudad}`
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(cityJsonLd) }}
      />
      <Breadcrumbs items={breadcrumbItems} />
      <LandingCiudad 
        slug={ciudad} 
        nombre={ciudadSEO.nombre}
        municipio={ciudadSEO.municipio}
        estado={ciudadSEO.estado}
        descripcion={ciudadSEO.descripcion}
      />
    </>
  )
}
