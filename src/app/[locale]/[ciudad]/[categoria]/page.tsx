import { Metadata } from 'next'
import LandingCategoria from './LandingCategoria'
import { getCiudadBySlug, NOMBRES_CATEGORIA_POPULAR, CATEGORIAS_POPULARES } from '@/lib/ubicaciones-seo'
import { getSubcategoriaSEO } from '@/lib/categorias-seo'
import Breadcrumbs from '@/components/Breadcrumbs'
import { getTranslations } from 'next-intl/server'
import { getSupabaseServerClient } from '@/lib/supabase-server-client'
import { hayAnunciosEnCiudadCategoria } from '@/lib/seo-landings'
import { notFound } from 'next/navigation'
import { productAbsoluteUrl } from '@/lib/product-url'
import { SUBCATEGORIAS_SEO } from '@/lib/categorias-seo'

const CATEGORIAS_SEO: Record<string, { nombre: string; descripcion: string }> = Object.fromEntries(
  CATEGORIAS_POPULARES.map((slug) => {
    const seo = getSubcategoriaSEO(slug)
    return [
      slug,
      {
        nombre: seo?.nombre || NOMBRES_CATEGORIA_POPULAR[slug] || slug,
        descripcion: seo?.descripcion || '',
      },
    ]
  })
)


type Props = {
  params: Promise<{ ciudad: string; categoria: string; locale: string }>
}

function ogCategoriaParam(slug: string): string {
  const map: Record<string,string> = {
    'gran-volumen': 'gran-volumen',
    'camper-mediana': 'camper-mediana',
    'minicamper': 'minicamper',
    'perfilada': 'perfilada',
    'capuchina': 'capuchina',
    'integral': 'integral',
    'overland': 'overland',
  }
  return map[slug] || 'camper'
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ciudad, categoria, locale } = await params
  const ciudadSEO = getCiudadBySlug(ciudad)
  const cat = CATEGORIAS_SEO[categoria] || { nombre: categoria, descripcion: categoria }
  
  if (!ciudadSEO) {
    const t = await getTranslations({ locale, namespace: 'notFound' })
    return {
      title: t('title'),
      description: t('description'),
    }
  }

  const cityName = ciudadSEO.nombre
  const stateName = ciudadSEO.estado
  
  const title = `${cat.nombre} de ocasión en ${cityName}, ${stateName}`
  const description = `${cat.descripcion} Publica gratis tu camper en CamperOcasín.`
  
  const keywords = [
    `${cat.nombre.toLowerCase()} ${cityName.toLowerCase()}`,
    `furgonetas camper segunda mano ${cityName.toLowerCase()}`,
    `autocaravanas ocasion ${stateName.toLowerCase()}`,
    `${cat.nombre.toLowerCase()} usado ${cityName.toLowerCase()}`,
    `${cityName} ${stateName}`
  ]

  const ogParam = ogCategoriaParam(categoria)

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'es_ES',
      url: `https://camperocasion.online/${ciudad}/${categoria}`,
      images: [{ url: `https://camperocasion.online/api/og/catalog?categoria=${ogParam}`, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`https://camperocasion.online/api/og/catalog?categoria=${ogParam}`],
    },
    alternates: {
      canonical: `https://camperocasion.online/${ciudad}/${categoria}`,
      languages: {
        'es-ES': `https://camperocasion.online/${ciudad}/${categoria}`,
        'x-default': `https://camperocasion.online/${ciudad}/${categoria}`,
      },
    },
    robots: {
      // Combinación sin anuncios = página vacía: noindex hasta que haya
      // inventario (fail-open si la DB falla).
      index: await hayAnunciosEnCiudadCategoria(
        getSupabaseServerClient(),
        ciudadSEO.nombre,
        ciudadSEO.municipio,
        categoria,
      ),
      follow: true,
    },
  }
}

async function getProductosCategoria(ciudadNombre: string, municipio: string | undefined, categoriaSlug: string) {
  const supabase = getSupabaseServerClient()
  if (!supabase) return []
  const map: Record<string,string> = Object.fromEntries(SUBCATEGORIAS_SEO.map(s => [s.slug, s.categoria]))
  const subLabel = map[categoriaSlug]
  try {
    let q = supabase
      .from('productos')
      .select('id, slug, titulo, precio_usd, imagen_url, ubicacion_ciudad, subcategoria, estado')
      .eq('activo', true)
      .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado')
      .order('boosteado_en', { ascending: false, nullsFirst: false })
      .order('destacado_hasta', { ascending: false, nullsFirst: false })
      .order('creado_en', { ascending: false })
      .limit(10)
    if (subLabel) q = q.eq('subcategoria', subLabel)
    if (municipio && municipio !== ciudadNombre) {
      q = q.or(`ubicacion_ciudad.eq."${ciudadNombre}",ubicacion_ciudad.eq."${municipio}"`)
    } else {
      q = q.eq('ubicacion_ciudad', ciudadNombre)
    }
    const { data } = await q
    return data || []
  } catch { return [] }
}

// IMPORTANTE — Ruta DINÁMICA a propósito: ver el comentario en
// src/app/[locale]/[ciudad]/page.tsx. generateStaticParams aquí hacía que
// Next 16 intentara "static generation on demand" al recibir cualquier
// request de /ciudad/categoria, lanzando DYNAMIC_SERVER_USAGE → 500.

export default async function CategoriaPage({ params }: Props) {
  const { ciudad, categoria, locale } = await params
  const ciudadSEO = getCiudadBySlug(ciudad)
  const cat = CATEGORIAS_SEO[categoria] || { nombre: categoria, descripcion: categoria }
  
  if (!ciudadSEO || !CATEGORIAS_SEO[categoria]) {
    // 404 real: ciudad desconocida o slug de categoría arbitrario
    // (antes respondía 200 con contenido thin para cualquier /ciudad/cosa)
    notFound()
  }

  const productos = await getProductosCategoria(ciudadSEO.nombre, ciudadSEO.municipio, categoria)

  // Breadcrumb items visual
  const breadcrumbItems = [
    { label: ciudadSEO.nombre, href: `/${ciudad}` },
    { label: cat.nombre, href: undefined }
  ]

  const SITIO = 'https://camperocasion.online'
  const pageUrl = SITIO + '/' + ciudad + '/' + categoria

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITIO + '/' },
      { '@type': 'ListItem', position: 2, name: ciudadSEO.nombre, item: SITIO + '/' + ciudad },
      { '@type': 'ListItem', position: 3, name: cat.nombre, item: pageUrl },
    ],
  }

  const collectionPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': pageUrl + '#collection',
    name: cat.nombre + ' de ocasión en ' + ciudadSEO.nombre,
    description: cat.descripcion,
    url: pageUrl,
    isPartOf: { '@id': SITIO + '/#website' },
    breadcrumb: { '@id': pageUrl + '#breadcrumb' },
    mainEntity: productos.length > 0 ? { '@id': pageUrl + '#itemlist' } : undefined,
  }

  const itemListJsonLd = productos.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': pageUrl + '#itemlist',
    name: cat.nombre + ' en ' + ciudadSEO.nombre,
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
      <LandingCategoria 
        ciudadSlug={ciudad} 
        ciudadNombre={ciudadSEO.nombre}
        ciudadMunicipio={ciudadSEO.municipio}
        estado={ciudadSEO.estado}
        categoriaSlug={categoria} 
        categoriaNombre={cat.nombre}
        descripcion={cat.descripcion}
      />
    </>
  )
}
