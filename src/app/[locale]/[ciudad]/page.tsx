import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LandingCiudad from './LandingCiudad'
import { getCiudadBySlug } from '@/lib/ubicaciones-seo'
import Breadcrumbs from '@/components/Breadcrumbs'
import { getTranslations } from 'next-intl/server'
import { getSupabaseServerClient } from '@/lib/supabase-server-client'
import { hayAnunciosEnCiudad } from '@/lib/seo-landings'
import { productAbsoluteUrl } from '@/lib/product-url'

type Props = {
  params: Promise<{ ciudad: string; locale: string }>
}

function slugToCategoriaParam(slug: string): string {
  const map: Record<string,string> = {
    'gran-volumen': 'Gran Volumen',
    'camper-mediana': 'Camper Mediana / Compacta',
    'minicamper': 'Minicamper',
    'perfilada': 'Autocaravana Perfilada',
    'capuchina': 'Autocaravana Capuchina',
    'integral': 'Autocaravana Integral',
    'overland': '4x4 Overland',
  }
  return map[slug] || 'camper'
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

  // OG dinámica por ciudad (usa endpoint existente con param categoria simulando ciudad)
  // Para provincia usamos el OG genérico pero con URL canónica correcta para CTR en WhatsApp
  const ogImage = `https://camperocasion.online/api/og/catalog?categoria=camper`

  return {
    title,
    description,
    keywords: ciudadSEO.keywords,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'es_ES',
      url: `https://camperocasion.online/${ciudad}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: `https://camperocasion.online/${ciudad}`,
      languages: {
        'es-ES': `https://camperocasion.online/${ciudad}`,
        'x-default': `https://camperocasion.online/${ciudad}`,
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

async function getProductosCiudad(ciudadNombre: string, municipio?: string) {
  const supabase = getSupabaseServerClient()
  if (!supabase) return []
  try {
    let q = supabase
      .from('productos')
      .select('id, slug, titulo, precio_usd, imagen_url, ubicacion_ciudad, subcategoria, estado, activo')
      .eq('activo', true)
      .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado')
      .order('boosteado_en', { ascending: false, nullsFirst: false })
      .order('destacado_hasta', { ascending: false, nullsFirst: false })
      .order('creado_en', { ascending: false })
      .limit(10)
    if (municipio && municipio !== ciudadNombre) {
      q = q.or(`ubicacion_ciudad.eq."${ciudadNombre}",ubicacion_ciudad.eq."${municipio}"`)
    } else {
      q = q.eq('ubicacion_ciudad', ciudadNombre)
    }
    const { data } = await q
    return data || []
  } catch { return [] }
}

// IMPORTANTE — Esta ruta es DINÁMICA a propósito:
// Antes tenía `generateStaticParams()` (SSG/ISR). En Next 16, renderizar
// on-demand una ruta SSG (o prerenderizarla con el layout raíz, que usa
// cookies()/headers()) lanza `DynamicServerError` (digest
// DYNAMIC_SERVER_USAGE) → 500 en TODAS las páginas de provincia (/madrid, etc.).
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

  const productos = await getProductosCiudad(ciudadSEO.nombre, ciudadSEO.municipio)

  // Breadcrumb items
  const breadcrumbItems = [
    { label: ciudadSEO.nombre, href: undefined }
  ]

  const SITIO = 'https://camperocasion.online'
  const cityUrl = SITIO + '/' + ciudad

  // JSON-LD: AdministrativeArea + BreadcrumbList + ItemList
  const cityJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AdministrativeArea',
    '@id': cityUrl + '#place',
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
    url: cityUrl,
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITIO + '/' },
      { '@type': 'ListItem', position: 2, name: ciudadSEO.nombre, item: cityUrl },
    ],
  }

  const collectionPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': cityUrl + '#collection',
    name: ciudadSEO.titulo,
    description: ciudadSEO.descripcion,
    url: cityUrl,
    isPartOf: { '@id': SITIO + '/#website' },
    breadcrumb: { '@id': cityUrl + '#breadcrumb' },
    mainEntity: productos.length > 0 ? { '@id': cityUrl + '#itemlist' } : undefined,
  }

  const itemListJsonLd = productos.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': cityUrl + '#itemlist',
    name: ciudadSEO.titulo,
    numberOfItems: productos.length,
    itemListElement: productos.map((p: any, i: number) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: productAbsoluteUrl(p, SITIO),
      name: p.titulo,
      ...(p.imagen_url ? { image: p.imagen_url } : {}),
      offers: {
        '@type': 'Offer',
        price: p.precio_usd || 0,
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        url: productAbsoluteUrl(p, SITIO),
      },
    })),
  } : null

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(cityJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageJsonLd) }}
      />
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />
      )}
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
