import type { Metadata } from 'next'
import { supabase } from '@/lib/supabase-server-client'
import { CATALOG_PAGE_SIZE } from '@/lib/catalog-pagination'
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
    ? `https://camperocasion.es/api/og/catalog?categoria=${categoria}`
    : 'https://camperocasion.es/api/og/catalog'

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
      canonical: 'https://camperocasion.es/catalogo',
      languages: {
        'es-ES': 'https://camperocasion.es/catalogo',
        'x-default': 'https://camperocasion.es/catalogo',
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
    const { data, count, error } = await supabase
      .from('productos')
      .select('id, slug, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, ubicacion_estado, creado_en, subcategoria, boosteado_en, destacado, destacado_hasta, vendedor_verificado', { count: 'exact' })
      .eq('activo', true)
      .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado,estado_moderacion.eq.pendiente')
      .order('creado_en', { ascending: false })
      .limit(CATALOG_PAGE_SIZE) // Debe coincidir con la página del cliente; de lo contrario se omiten filas.

    if (error || !data) return { products: [], count: 0 }

    // Mismo ordenamiento que el cliente: boost > destacado vigente > fecha
    // Pre-computamos flags de estado para evitar hydration mismatch
    const now = new Date().toISOString()
    const sorted = data.sort((a: any, b: any) => {
      const aBoost = a.boosteado_en || null
      const bBoost = b.boosteado_en || null
      if (aBoost && !bBoost) return -1
      if (!aBoost && bBoost) return 1
      if (aBoost && bBoost) return bBoost.localeCompare(aBoost)
      const aDest = a.destacado && a.destacado_hasta && a.destacado_hasta > now
      const bDest = b.destacado && b.destacado_hasta && b.destacado_hasta > now
      if (aDest && !bDest) return -1
      if (!aDest && bDest) return 1
      if (aDest && bDest) return b.destacado_hasta.localeCompare(a.destacado_hasta)
      return b.creado_en.localeCompare(a.creado_en)
    }).map((p: any) => ({
      ...p,
      // Pre-computar flags para evitar hydration mismatch en cliente
      _isFeatured: !!(p.destacado && p.destacado_hasta && p.destacado_hasta > now),
    }))

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
