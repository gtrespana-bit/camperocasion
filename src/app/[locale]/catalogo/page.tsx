import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase-server-client'
import { CATALOG_PAGE_SIZE } from '@/lib/catalog-pagination'
import {
  CATALOG_PRODUCT_COLUMNS,
  CATALOG_FILTRO_MODERACION,
  aplicarOrdenCatalogo,
  marcarDestacados,
  ordenarProductosCatalogo,
  type ProductoCatalogo,
} from '@/lib/catalog-consulta'
import CatalogoClient from './CatalogoPage'
import { Suspense } from 'react'

type PageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

// Filtros vía query string (?categoria=, ?ciudad=, ?q=...). Como el
// canonical siempre apunta a /catalogo limpio, cada combinación de filtros
// consolida su señal en UNA sola URL en vez de competir como duplicado.
// (Las landing pages indexables por provincia ya existen como
// rutas /madrid, /barcelona etc. — esas sí posicionan.)
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const resolvedParams = await searchParams
  const categoria = (resolvedParams?.categoria as string) || ''
  const paginaRaw = (resolvedParams?.pagina as string) || ''
  const paginaNum = parseInt(paginaRaw, 10)
  const hasPagination = Number.isFinite(paginaNum) && paginaNum > 1
  
  const ogImageUrl = categoria 
    ? `https://camperocasion.online/api/og/catalog?categoria=${categoria}`
    : 'https://camperocasion.online/api/og/catalog'

  // Paginación: canonical siempre a /catalogo limpio para consolidar señal,
  // pero si es pagina>1 se sugiere noindex para evitar duplicado thin
  // (contenido ya listado en pagina 1 + ItemList). Productos individuales
  // se indexan por su propia URL /producto/*.
  return {
    title: hasPagination
      ? `Catálogo de campers — página ${paginaNum} | CamperOcasión`
      : 'Catálogo de furgonetas camper y autocaravanas de ocasión',
    description: 'Explora el catálogo de CamperOcasión: furgonetas camper, autocaravanas de ocasión, gran volumen, camper medianas, minicamper, perfiladas, capuchinas, integrales y 4x4 overland en toda España.',
    openGraph: {
      title: hasPagination
        ? `Catálogo de campers — página ${paginaNum}`
        : 'Catálogo de furgonetas camper y autocaravanas de ocasión',
      description: 'Furgonetas camper y autocaravanas de ocasión en España. Gran volumen, camper medianas, minicamper, autocaravanas y 4x4 overland.',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: 'Catálogo - CamperOcasión' }],
      locale: 'es_ES',
    },
    alternates: {
      canonical: 'https://camperocasion.online/catalogo',
      languages: {
        'es-ES': 'https://camperocasion.online/catalogo',
        'x-default': 'https://camperocasion.online/catalogo',
      },
    },
    robots: hasPagination
      ? { index: false, follow: true }
      : { index: true, follow: true },
  }
}

function buildCatalogSchemas(products: any[]) {
  const SITIO = 'https://camperocasion.online'
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITIO + '/' },
      { '@type': 'ListItem', position: 2, name: 'Catálogo', item: SITIO + '/catalogo' },
    ],
  }
  if (!products || products.length === 0) return { breadcrumb, itemList: null }
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Catálogo de furgonetas camper y autocaravanas de ocasión',
    numberOfItems: products.length,
    itemListElement: products.slice(0, 20).map((p: any, i: number) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: SITIO + '/producto/' + (p.slug || p.id),
      name: p.titulo,
      ...(p.imagen_url ? { image: p.imagen_url } : {}),
      offers: {
        '@type': 'Offer',
        price: p.precio_usd || 0,
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        url: SITIO + '/producto/' + (p.slug || p.id),
      },
    })),
  }
  const collectionPage = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Catálogo de furgonetas camper y autocaravanas de ocasión',
    description: 'Furgonetas camper y autocaravanas de ocasión en España: gran volumen, camper medianas, minicamper, perfiladas, capuchinas, integrales y 4x4 overland.',
    url: SITIO + '/catalogo',
    isPartOf: { '@id': SITIO + '/#website' },
    breadcrumb: { '@id': SITIO + '/catalogo#breadcrumb' },
    mainEntity: { '@id': SITIO + '/catalogo#itemlist' },
  }
  return { breadcrumb, itemList, collectionPage }
}

// ✅ Fetch server-side de productos iniciales
// Replica exactamente la misma query + ordenamiento que usa el cliente
async function getInitialProducts() {
  if (!supabase) return { products: [], count: 0 }
  try {
    // Optimización: Seleccionar solo columnas necesarias para la vista de catálogo
    // (las mismas que usa el cliente: ver src/lib/catalog-consulta.ts)
    const { data, count, error } = await aplicarOrdenCatalogo(
      supabase
        .from('productos')
        .select(CATALOG_PRODUCT_COLUMNS, { count: 'exact' })
        .eq('activo', true)
        .or(CATALOG_FILTRO_MODERACION),
    )
      .limit(CATALOG_PAGE_SIZE) // Debe coincidir con la página del cliente; de lo contrario se omiten filas.

    if (error || !data) return { products: [], count: 0 }

    // Mismo ordenamiento que el cliente: boost > destacado vigente > fecha.
    // Los flags van pre-computados para evitar hydration mismatch.
    const sorted = ordenarProductosCatalogo(marcarDestacados(data as unknown as ProductoCatalogo[]))

    return { products: sorted, count: count ?? 0 }
  } catch {
    return { products: [], count: 0 }
  }
}

export default async function CatalogoPage({ searchParams }: PageProps) {
  // Fetch en servidor ANTES de renderizar
  const { products: initialProducts, count: initialCount } = await getInitialProducts()
  const { breadcrumb, itemList, collectionPage } = buildCatalogSchemas(initialProducts)
  const resolvedParams = searchParams ? await searchParams : {}
  const paginaRaw = (resolvedParams as any)?.pagina as string | undefined
  const currentPage = Math.max(1, parseInt(paginaRaw || '1', 10) || 1)
  const totalPages = Math.max(1, Math.ceil(initialCount / CATALOG_PAGE_SIZE))
  const prevPage = currentPage > 1 ? currentPage - 1 : null
  const nextPage = currentPage < totalPages ? currentPage + 1 : null
  const baseUrl = 'https://camperocasion.online/catalogo'

  // ✅ Suspense boundary necesario para useSearchParams() en Next.js 14
  // Sin esto, la página se desopta de static rendering y causa hydration mismatch
  return (
    <>
      {prevPage && <link rel="prev" href={prevPage === 1 ? baseUrl : baseUrl + '?pagina=' + prevPage} />}
      {nextPage && <link rel="next" href={baseUrl + '?pagina=' + nextPage} />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      {itemList && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
        />
      )}
      {collectionPage && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPage) }}
        />
      )}
      <Suspense>
        <CatalogoClient
          initialProducts={initialProducts}
          initialCount={initialCount}
        />
      </Suspense>
    </>
  )
}

// ISR: cache catalog for 10 minutes
export const revalidate = 600
