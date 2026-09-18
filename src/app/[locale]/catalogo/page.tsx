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
  
  const ogImageUrl = categoria 
    ? `https://camperocasion.online/api/og/catalog?categoria=${categoria}`
    : 'https://camperocasion.online/api/og/catalog'

  return {
    title: 'Catálogo de furgonetas camper y autocaravanas de ocasión',
    description: 'Explora el catálogo de CamperOcasión: furgonetas camper, autocaravanas de ocasión, gran volumen, camper medianas, minicamper, perfiladas, capuchinas, integrales y 4x4 overland en toda España.',
    openGraph: {
      title: 'Catálogo de furgonetas camper y autocaravanas de ocasión',
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
  }
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

export default async function CatalogoPage() {
  // Fetch en servidor ANTES de renderizar
  const { products: initialProducts, count: initialCount } = await getInitialProducts()

  // ✅ Suspense boundary necesario para useSearchParams() en Next.js 14
  // Sin esto, la página se desopta de static rendering y causa hydration mismatch
  return (
    <Suspense>
      <CatalogoClient
        initialProducts={initialProducts}
        initialCount={initialCount}
      />
    </Suspense>
  )
}

// ISR: cache catalog for 10 minutes
export const revalidate = 600
