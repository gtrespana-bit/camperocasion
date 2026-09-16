'use client'
import { formatPrecio } from '@/lib/precio'

import { useEffect, useMemo, useState, useRef, memo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import { Search, ChevronRight, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { categoriasData } from '@/lib/categorias'
import UbicacionSelector from '@/components/UbicacionSelector'
import { Pagination } from '@/components/Pagination'
import { OptimizedProductGrid } from '@/components/OptimizedProductGrid'
import { CatalogFilters } from '@/components/CatalogFilters'
import BadgeHomologacion from '@/components/BadgeHomologacion'
import { useProductPagination } from '@/hooks/useProductPagination'
import { useProductLoader } from '@/hooks/useProductLoader'
import { CATALOG_PAGE_SIZE } from '@/lib/catalog-pagination'
import {
  firmaFiltrosTecnicos,
  hayFiltrosTecnicos,
  leerFiltrosTecnicos,
} from '@/lib/filtros-tecnicos'
import { FILTRO_VERIFICADA_PARAM } from '@/lib/catalog-consulta'
import { LoadingIndicator } from '@/components/LoadingIndicator'
import { usePrefetch } from '@/hooks/usePrefetch'
import { productUrl } from '@/lib/product-url'

type Producto = {
  id: string
  slug?: string | null
  titulo: string
  precio_usd: number
  estado: string
  imagen_url: string | null
  ubicacion_ciudad: string | null
  ubicacion_estado: string | null
  creado_en: string
  subcategoria: string | null
  boosteado_en: string | null
  destacado: boolean
  destacado_hasta: string | null
  vendedor_verificado: boolean | null
  verificacion_homologacion?: string | null
}

interface CatalogoPageProps {
  initialProducts?: Producto[]
  initialCount?: number
}

const PLACEHOLDER_IMAGES = [
  '/placeholder-product.webp',
]

const BLUR_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAADAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='

function getPlaceholderImage(titulo: string) {
  return PLACEHOLDER_IMAGES[Math.abs(titulo.charCodeAt(0)) % PLACEHOLDER_IMAGES.length]
}

function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm animate-pulse">
      <div className="aspect-square bg-gray-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-6 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded w-1/3" />
      </div>
    </div>
  )
}

const ProductCard = memo(({ p, priority = false, t }: { p: Producto; priority?: boolean; t: (key: string) => string }) => {
  const isBoosted = p.boosteado_en != null
  // Usar flag pre-computado del servidor para evitar hydration mismatch
  // Si no existe (datos frescos del cliente), calcular en el cliente
  const isFeatured = (p as any)._isFeatured !== undefined
    ? (p as any)._isFeatured
    : !!(p.destacado && p.destacado_hasta && new Date(p.destacado_hasta) > new Date())
  const isPromoted = isBoosted || isFeatured

  const imgUrl = p.imagen_url || getPlaceholderImage(p.titulo)

  return (
    <LocalLink href={productUrl(p)} className={`bg-white rounded-xl overflow-hidden transition-all duration-200 group block border ${isPromoted ? 'border-2 border-brand-accent shadow-md hover:shadow-xl hover:-translate-y-1' : 'border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-gray-200'}`}>
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        {isFeatured && (
          <div className="absolute top-2 left-2 z-10 bg-brand-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
            ⭐ {t('product.featured')}
          </div>
        )}
        {isBoosted && !isFeatured && (
          <div className="absolute top-2 left-2 z-10 bg-green-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
            ⚡ <span className="text-white">Boost</span>
          </div>
        )}
        <Image
          src={imgUrl}
          alt={p.titulo}
          width={300}  // Reducir tamaño para optimización
          height={300}
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading={priority ? 'eager' : 'lazy'}
          priority={priority}
          decoding="async"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          fetchPriority={priority ? 'high' : 'low'} // Cambiar a 'low' para no prioritarios
          onError={(e) => {
            // ✅ CORREGIDO: Previene loop infinito
            const target = e.target as HTMLImageElement
            if (!target.src.includes('/placeholder-product.webp')) {
              target.src = '/placeholder-product.webp'
            }
          }}
        />
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate group-hover:text-brand-primary transition-colors">{p.titulo}</h3>
        <p className="text-xl font-black text-brand-primary mt-1">{formatPrecio(p.precio_usd || 0)}</p>
        {p.verificacion_homologacion === 'verificada' && (
          <div className="mt-1">
            <BadgeHomologacion estado={p.verificacion_homologacion} size="sm" />
          </div>
        )}
        {p.vendedor_verificado && (
          <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full mt-1">
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            {t('product.verified')}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-1">{p.ubicacion_ciudad || p.ubicacion_estado || 'España'}</p>
      </div>
    </LocalLink>
  )
})

ProductCard.displayName = 'ProductCard'

export default function CatalogoClient({ initialProducts = [], initialCount = 0 }: CatalogoPageProps) {
  const tc = useTranslations('catalog')
  const tp = useTranslations('product')
  const tcm = useTranslations('common')
  // Universal translator function (supports any namespace with variables)
  const t = (key: string, vars?: Record<string, string | number>) => {
    const parts = key.split('.')
    const ns = parts[0]
    const rest = parts.slice(1).join('.')
    if (ns === 'catalog') return tc(rest, vars as any)
    if (ns === 'product') return tp(rest, vars as any)
    if (ns === 'common') return tcm(rest, vars as any)
    return key
  }
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  // Usar hook de paginación
  const { currentPage, itemsPerPage, goToPage } = useProductPagination({ itemsPerPage: CATALOG_PAGE_SIZE })

  const categoria = searchParams.get('categoria') || ''
  const subcategoria = searchParams.get('subcategoria') || ''
  const marca = searchParams.get('marca') || ''
  const q = searchParams.get('q') || ''
  const precioMin = searchParams.get('precioMin') || ''
  const precioMax = searchParams.get('precioMax') || ''
  const ubicacionEstado = searchParams.get('estado') || ''
  const ubicacionCiudad = searchParams.get('ciudad') || ''

  // Filtros técnicos (ficha técnica camper): DGT, homologación, plazas, baño,
  // autonomía, medidas… Todos se leen de una vez desde el registro
  // @/lib/filtros-tecnicos, que también decide las opciones que ofrece la barra
  // lateral.
  //
  // Se memoiza con el string de la query (primitivo) y no con el objeto de
  // `useSearchParams`: si su identidad cambiase entre renders, los efectos que
  // dependen de los filtros se reejecutarían en bucle.
  // Filtro "solo homologación verificada": no forma parte del registro JSONB
  // (es una columna de `productos`), así que se lee aparte.
  const verificada = searchParams.get(FILTRO_VERIFICADA_PARAM) || ''

  const queryString = searchParams.toString()
  const filtrosTecnicos = useMemo(() => leerFiltrosTecnicos(new URLSearchParams(queryString)), [queryString])
  const firmaTecnica = firmaFiltrosTecnicos(filtrosTecnicos)

  const hasActiveFilters = !!(
    categoria || subcategoria || marca || q || precioMin || precioMax ||
    ubicacionEstado || ubicacionCiudad || verificada || hayFiltrosTecnicos(filtrosTecnicos)
  )

  // Carga real por página desde el servidor (range()).
  const { productos: loadedProductos, loading, error, totalCount: loaderTotalCount, loadPage } = useProductLoader();
  const { prefetchPage } = usePrefetch();

  // Durante la primera renderización SSR (página 1 sin filtros) usamos los
  // productos servidos por el servidor. En cuanto se navega o se filtran, se
  // pasa a los productos cargados desde el cliente (server-driven por página).
  const [useServerData, setUseServerData] = useState(false)

  // ¿Mostramos los iniciales del SSR o los cargados por página?
  const showInitialSSR = !useServerData && !hasActiveFilters && currentPage === 1
  const productosToShow = showInitialSSR ? initialProducts : loadedProductos
  const totalCountToUse = showInitialSSR ? initialCount : loaderTotalCount

  // totalPages se calcula con el total REAL (totalCount), no con las filas
  // cargadas. Así la paginación es correcta aunque solo se cargue una página.
  const totalPages = Math.max(1, Math.ceil(totalCountToUse / itemsPerPage))

  // Firma de filtros para detectar cambios y resetear la página.
  const filterSig = [categoria, subcategoria, marca, q, precioMin, precioMax, ubicacionEstado, ubicacionCiudad, firmaTecnica, verificada].join('|')
  const prevFilterSig = useRef(filterSig)

  const cat = categoriasData[categoria]
  const subs = cat ? cat.subs : []
  const allMarcas = subs.flatMap(s => s.marcas || []).filter((v, i, a) => a.indexOf(v) === i).sort()

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value); else params.delete(key)
    if (key === 'categoria') params.delete('subcategoria')
    router.push(`${pathname}?${params.toString()}`)
  }

  useEffect(() => {
    // Si cambian los filtros y no estamos en la página 1, resetear a la página 1.
    if (prevFilterSig.current !== '' && prevFilterSig.current !== filterSig && currentPage !== 1) {
      prevFilterSig.current = filterSig
      goToPage(1)
      return
    }
    prevFilterSig.current = filterSig

    // Durante la primera renderización SSR (página 1 sin filtros) usamos los
    // productos del servidor; no hace falta recargar.
    if (!hasActiveFilters && currentPage === 1 && !useServerData) {
      return
    }

    setUseServerData(true)
    loadPage({
      page: currentPage,
      pageSize: itemsPerPage,
      filters: {
        categoria,
        subcategoria,
        marca,
        q,
        precioMin,
        precioMax,
        ubicacionEstado,
        ubicacionCiudad,
        [FILTRO_VERIFICADA_PARAM]: verificada || undefined,
        ...filtrosTecnicos
      }
    });
  }, [filterSig, currentPage, itemsPerPage, hasActiveFilters, useServerData, goToPage, loadPage, categoria, subcategoria, marca, q, precioMin, precioMax, ubicacionEstado, ubicacionCiudad, filtrosTecnicos, verificada]);

  // Precargar la siguiente página cuando sea apropiado
  useEffect(() => {
    if (!loading && productosToShow.length > 0 && totalPages > currentPage) {
      // Precargar la siguiente página después de un breve retraso
      const prefetchTimer = setTimeout(() => {
        prefetchPage(
          currentPage + 1,
          itemsPerPage,
          {
            categoria,
            subcategoria,
            marca,
            q,
            precioMin,
            precioMax,
            ubicacionEstado,
            ubicacionCiudad,
            [FILTRO_VERIFICADA_PARAM]: verificada || undefined,
            ...filtrosTecnicos
          }
        );
      }, 2000); // Precargar después de 2 segundos para permitir la carga completa de la página actual

      return () => clearTimeout(prefetchTimer);
    }
  }, [currentPage, totalPages, loading, productosToShow.length, categoria, subcategoria, marca, q, precioMin, precioMax, ubicacionEstado, ubicacionCiudad, filtrosTecnicos, verificada, itemsPerPage, prefetchPage]);

  const subLabel = subcategoria
    ? (cat?.subs.find(s => s.label === subcategoria)?.label || subcategoria)
    : ''

  const tituloMostrar = q
    ? t('catalog.resultsFor', { q })
    : subcategoria
      ? subLabel
      : cat
        ? t('catalog.categories.' + categoria)
        : t('catalog.allProducts')

  // Generar breadcrumbs jerárquicos con schema.org
  const breadcrumbs = [
    { label: t('catalog.breadcrumb'), href: '/' },
    { label: t('catalog.title'), href: '/catalogo' }
  ]
  
  if (categoria && cat) {
    breadcrumbs.push({ 
      label: `${cat.icon} ${t('catalog.categories.' + categoria)}`, 
      href: `/categoria/${categoria}`
    })
  }
  
  if (subcategoria) {
    breadcrumbs.push({ 
      label: subLabel, 
      href: '' // Página actual
    })
  }
  
  if (q) {
    breadcrumbs.push({ 
      label: `${t('catalog.searchLabel')}: "${q}"`, 
      href: '' // Página actual
    })
  }
  
  // Schema.org BreadcrumbList JSON-LD
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label.replace(/^[^ ]+ /, ''), // Remover emoji del nombre para schema
      item: item.href ? `https://camperocasion.es${item.href}` : undefined
    }))
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumbs visuales */}
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap" aria-label="Breadcrumb">
          {breadcrumbs.map((item, index) => (
            <span key={index} className="flex items-center gap-2">
              {index > 0 && <ChevronRight size={14} className="text-gray-500" />}
              {item.href ? (
                <LocalLink 
                  href={item.href} 
                  className="hover:text-brand-primary transition"
                >
                  {item.label}
                </LocalLink>
              ) : (
                <span className="text-gray-900 font-medium">{item.label}</span>
              )}
            </span>
          ))}
        </nav>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="w-full lg:w-72 flex-shrink-0">
          <CatalogFilters
            categoria={categoria}
            subcategoria={subcategoria}
            marca={marca}
            precioMin={precioMin}
            precioMax={precioMax}
            ubicacionEstado={ubicacionEstado}
            ubicacionCiudad={ubicacionCiudad}
            filtrosTecnicos={filtrosTecnicos}
            verificada={verificada}
            t={t}
          />
        </aside>

        <div className="flex-1">
          <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">{tituloMostrar}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {loading ? t('common.loading') : t('catalog.results', { count: totalCountToUse || 0 })}
                </p>
              </div>
              <form action="/buscar" method="GET" className="flex gap-2 w-full sm:w-auto">
                <input name="q" defaultValue={q} placeholder={`${t('common.search')}...`} className="w-full sm:w-60 border rounded-lg px-4 py-2 text-sm" />
                <button type="submit" className="bg-brand-primary text-white px-4 rounded-lg font-bold text-sm hover:bg-brand-dark transition">{t('common.search')}</button>
              </form>
            </div>
          </div>

          <div className="mb-4">
            <UbicacionSelector
              estado={ubicacionEstado}
              ciudad={ubicacionCiudad}
              onChange={(estado, ciudad) => {
                const params = new URLSearchParams(searchParams.toString())
                if (estado) params.set('estado', estado); else params.delete('estado')
                if (ciudad) params.set('ciudad', ciudad); else params.delete('ciudad')
                router.push(`${pathname}?${params.toString()}`)
              }}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6 mb-4 flex items-start gap-3" role="alert">
              <XCircle size={20} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{t('catalog.loadErrorTitle')}</p>
                <p className="text-sm mt-1">{error}</p>
                <button
                  onClick={() => loadPage({ page: currentPage, pageSize: itemsPerPage, filters: { categoria, subcategoria, marca, q, precioMin, precioMax, ubicacionEstado, ubicacionCiudad, [FILTRO_VERIFICADA_PARAM]: verificada || undefined, ...filtrosTecnicos } })}
                  className="mt-3 text-sm font-semibold text-red-700 underline hover:text-red-900"
                >
                  {t('catalog.retry')}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <LoadingIndicator count={6} />
          ) : !error && productosToShow.length === 0 ? (
            <div className="bg-white rounded-xl p-16 text-center shadow-sm border">
              <Search size={48} className="text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">{t('catalog.empty')}</h3>
              <p className="text-gray-500 mb-4">{t('catalog.emptyCta')}</p>
              <LocalLink href="/publicar" className="inline-block bg-brand-accent text-white px-6 py-3 rounded-lg font-bold hover:bg-accent/90 transition">
                {t('catalog.publishFree')}
              </LocalLink>
            </div>
          ) : (
            <OptimizedProductGrid
              productos={productosToShow}
              t={t}
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
            />
          )}
        </div>
      </div>

      {/* Componente de paginación optimizado */}
      <Pagination 
        currentPage={currentPage} 
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        totalItems={totalCountToUse} 
      />
    </div>
    </>
  )
}