import type { Metadata } from 'next'
import Image from 'next/image'
import { supabase } from '@/lib/supabase-server-client'
import { routing } from '@/i18n/routing'
import { Suspense, cache } from 'react'
import { permanentRedirect, notFound } from 'next/navigation'
import ProductoPageClient from './ProductoPageClient'
import { getTranslations } from 'next-intl/server'
import Breadcrumbs from '@/components/Breadcrumbs'
import LocalLink from '@/components/LocalLink'
import { isUuid } from '@/lib/product-url'
import { getCiudadByMunicipioYEstado } from '@/lib/ubicaciones-seo'
import { formatPrecio } from '@/lib/precio'

// IMPORTANTE — Ruta DINÁMICA a propósito: ver el comentario en
// src/app/[locale]/[ciudad]/page.tsx. Con generateStaticParams + revalidate
// (ISR), cualquier producto fuera del top-100 prerenderizado (productos
// viejos o publicados después del deploy) se renderizaba "on-demand" en modo
// static-generation y lanzaba DYNAMIC_SERVER_USAGE → 500 en /producto/[slug].
// Sin generateStaticParams la página se sirve por SSR dinámico (como la home
// y /catalogo) y funciona para TODOS los productos.

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

// ISR on-demand: cachea la página renderizada 5 minutos para evitar que cada
// visita/rastreo de Google re-ejecute el render + queries a Supabase (TTFB alto).
// Sin generateStaticParams a propósito (ver comentario de la ruta: eso causaba
// DYNAMIC_SERVER_USAGE → 500). Solo con revalidate se sirve estático y se
// regenera bajo demanda. Requiere Supabase configurado en el entorno de build.
export const revalidate = 300

const PRODUCT_COLUMNS = `
  id,
  slug,
  titulo,
  descripcion,
  precio_usd,
  estado,
  categoria_id,
  subcategoria,
  marca,
  modelo,
  especificaciones,
  ubicacion_estado,
  ubicacion_ciudad,
  activo,
  visitas,
  creado_en,
  user_id,
  imagen_url,
  imagenes,
  metodos_contacto,
  destacado,
  destacado_hasta,
  boosteado_en
`

const PRODUCT_COLUMNS_LEGACY = PRODUCT_COLUMNS.replace(/\n\s*slug,/, '')

// Sin `especificaciones`: para bases donde la migración 025 aún no se aplicó.
// PostgREST responde 42703 y rechaza el SELECT entero si se pide una columna
// inexistente, así que hay que poder reintentar sin ella.
const PRODUCT_COLUMNS_SIN_SPECS = PRODUCT_COLUMNS.replace(/\n\s*especificaciones,/, '')
const PRODUCT_COLUMNS_LEGACY_SIN_SPECS = PRODUCT_COLUMNS_LEGACY.replace(/\n\s*especificaciones,/, '')

const faltaColumna = (error: any, columna: string) =>
  !!error && new RegExp(columna, 'i').test(error.message || '')

function queryProducto(column: 'id' | 'slug', value: string, columns: string) {
  return supabase
    .from('productos')
    .select(columns)
    .eq(column, value)
    // Sin filtro de `activo` aquí: los VENDIDOS siguen renderizándose con
    // estado "vendido" + noindex (más abajo se decide). Pausados/eliminados
    // → 404. Antes todo inactivo caía en un 200 "No encontrado" = soft-404.
    .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado,estado_moderacion.eq.pendiente')
    .maybeSingle()
}

/**
 * Estado del expediente de homologación del anuncio (Fase 0.2).
 *
 * Va en consultas SEPARADAS y tolerantes a fallo a propósito: si la migración
 * todavía no está aplicada en esta base de datos, PostgREST responde 42703 por
 * columna/tabla inexistente y rechazaría el SELECT entero. La ficha del
 * producto no puede caerse por un sello informativo.
 */
async function getVerificacionHomologacion(productoId: string) {
  if (!supabase || !productoId) return null
  try {
    const { data: producto, error } = await supabase
      .from('productos')
      .select('verificacion_homologacion, verificacion_homologacion_motivo')
      .eq('id', productoId)
      .maybeSingle()
    if (error || !producto) return null

    const { data: documentos } = await supabase
      .from('documentos_vehiculo')
      .select('tipo, estado')
      .eq('producto_id', productoId)
      .eq('estado', 'verificado')

    return {
      estado: (producto as any).verificacion_homologacion || 'sin_verificar',
      motivo: (producto as any).verificacion_homologacion_motivo || null,
      documentos: documentos || [],
    }
  } catch {
    return null
  }
}

/**
 * Estado de reserva del anuncio (Fase 1.2) — consulta aparte y tolerante a
 * fallo: si la migración no está aplicada, la ficha sigue funcionando sin CTA
 * de reserva.
 */
async function getEstadoReserva(productoId: string, userId?: string | null) {
  if (!supabase || !productoId) return null
  try {
    const { data: producto, error } = await supabase
      .from('productos')
      .select('reservado, reservado_hasta')
      .eq('id', productoId)
      .maybeSingle()
    if (error || !producto) return null

    let propia: string | null = null
    if (userId) {
      const { data: reserva } = await supabase
        .from('reservas')
        .select('estado')
        .eq('producto_id', productoId)
        .eq('comprador_id', userId)
        .in('estado', ['pendiente_pago', 'en_revision', 'activa'])
        .maybeSingle()
      propia = reserva?.estado || null
    }

    return {
      reservado: !!(producto as any).reservado,
      reservado_hasta: (producto as any).reservado_hasta || null,
      reserva_propia_estado: propia,
    }
  } catch {
    return null
  }
}

async function getProduct(slugOrId: string) {
  // Validate param format first to avoid unnecessary DB queries
  if (!slugOrId || typeof slugOrId !== 'string' || slugOrId.length < 3) {
    return null
  }

  if (!supabase) {
    // Sin Supabase configurado: no hay datos; se responde 404 limpio
    // en lugar de 500 (la página es privada de datos pero la URL existe).
    return null
  }

  let data: any = null
  let error: any = null

  try {
    if (isUuid(slugOrId)) {
      // URL legacy con UUID
      ;({ data, error } = await queryProducto('id', slugOrId, PRODUCT_COLUMNS))
      if (faltaColumna(error, 'especificaciones')) {
        ;({ data, error } = await queryProducto('id', slugOrId, PRODUCT_COLUMNS_SIN_SPECS))
      }
      if (faltaColumna(error, 'slug')) {
        ;({ data, error } = await queryProducto('id', slugOrId, PRODUCT_COLUMNS_LEGACY))
        if (faltaColumna(error, 'especificaciones')) {
          ;({ data, error } = await queryProducto('id', slugOrId, PRODUCT_COLUMNS_LEGACY_SIN_SPECS))
        }
      }
    } else {
      // URL canónica con slug SEO
      ;({ data, error } = await queryProducto('slug', slugOrId, PRODUCT_COLUMNS))
      if (faltaColumna(error, 'especificaciones')) {
        ;({ data, error } = await queryProducto('slug', slugOrId, PRODUCT_COLUMNS_SIN_SPECS))
      }
      if (faltaColumna(error, 'slug')) {
        // Migración de slugs aún no aplicada en la DB: intenta por id
        ;({ data, error } = await queryProducto('id', slugOrId, PRODUCT_COLUMNS_LEGACY))
        if (faltaColumna(error, 'especificaciones')) {
          ;({ data, error } = await queryProducto('id', slugOrId, PRODUCT_COLUMNS_LEGACY_SIN_SPECS))
        }
      }
    }
  } catch (e: any) {
    console.error('Error fetching product:', e?.message)
    return null
  }

  if (error || !data) {
    // Avoid logging expected missing/inactive products during ISR generation.
    if (error) {
      console.error('Error fetching product:', error.code || error.message, 'Slug:', slugOrId)
    }
    return null
  }
  // Inactivo: SOLO los vendidos se siguen sirviendo (con noindex y sección
  // de similares). Pausados/eliminados → notFound() real (404 de estado).
  if (!data.activo) {
    const { data: flag } = await supabase
      .from('productos')
      .select('vendido')
      .eq('id', data.id)
      .maybeSingle()
    if (!flag?.vendido) return null
    return { ...data, vendido: true }
  }

  // productos.user_id references auth.users, not perfiles. PostgREST can only embed
  // tables connected by a real FK, so load the public seller profile separately.
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombre, ciudad, estado')
    .eq('id', data.user_id)
    .maybeSingle()

  return { ...data, perfil: perfil ? { ...perfil, nombre_completo: perfil.nombre } : null }
}

// cache(): generateMetadata() y la página piden el mismo producto — una sola
// query a Supabase por request en vez de dos.
const getProductCached = cache(getProduct)

/**
 * Productos relacionados: misma categoría (o subcategoría/marca como fallback).
 * Evita el "callejón sin salida": si el anuncio no convence, el visitante
 * sigue explorando en vez de salir de la web.
 */
async function getRelacionados(producto: any) {
  if (!supabase) return []

  const base = () =>
    supabase
      .from('productos')
      .select('id, slug, titulo, precio_usd, imagen_url, ubicacion_ciudad')
      .eq('activo', true)
      .neq('id', producto.id)
      // Los vendidos se marcan activo=false, pero por si acaso
      .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado,estado_moderacion.eq.pendiente')
      .order('creado_en', { ascending: false })
      .limit(4)

  try {
    if (producto.categoria_id) {
      const { data } = await base().eq('categoria_id', producto.categoria_id)
      if (data && data.length > 0) return data
    }
    if (producto.subcategoria) {
      const { data } = await base().eq('subcategoria', producto.subcategoria)
      if (data && data.length > 0) return data
    }
    if (producto.marca) {
      const { data } = await base().eq('marca', producto.marca)
      if (data && data.length > 0) return data
    }
    // Último recurso: lo más reciente de todo el catálogo
    const { data } = await base()
    return data || []
  } catch {
    return []
  }
}

/** Nº de personas que guardaron el producto en favoritos (señal de urgencia). */
async function getFavoritosCount(productoId: string) {
  if (!supabase) return 0
  try {
    const { count } = await supabase
      .from('favoritos')
      .select('id', { count: 'exact', head: true })
      .eq('producto_id', productoId)
    return count || 0
  } catch {
    return 0
  }
}

/**
 * Reseñas de este producto (las reseñas se escriben tras una venta verificada
 * y llevan producto_id). Con ≥1 reseña se expone AggregateRating en el schema:
 * Google dibuja las estrellas en el resultado → CTR.
 */
export const getResumenResenas = cache(
  async (productoId: string): Promise<{ count: number; avg: number }> => {
    if (!supabase) return { count: 0, avg: 0 }
    try {
      const { data } = await supabase
        .from('resenas')
        .select('puntuacion')
        .eq('producto_id', productoId)
        .limit(50)
      if (!data || data.length === 0) return { count: 0, avg: 0 }
      const count = data.length
      const avg = Math.round((data.reduce((s: number, r: any) => s + r.puntuacion, 0) / count) * 10) / 10
      return { count, avg }
    } catch {
      return { count: 0, avg: 0 }
    }
  },
)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const producto = await getProductCached(slug)

  if (!producto) {
    // notFound() AQUÍ (en generateMetadata) y no solo en la página: con
    // loading.tsx el shell se streamea con 200 antes de que la página
    // ejecute; lanzándolo antes del stream el status es 404 de verdad.
    notFound()
  }

  // La canonical SIEMPRE usa el slug SEO aunque se haya entrado por UUID
  const canonicalSlug = producto.slug || slug

  const parts = [producto.titulo]
  if (producto.precio_usd) {
    parts.push(formatPrecio(producto.precio_usd))
  }
  const ubicacion = [producto.ubicacion_ciudad, producto.ubicacion_estado].filter(Boolean).join(', ')
  if (ubicacion) parts.push(ubicacion)
  // Sin marca aquí: el template del layout raíz (%s | CamperOcasión) la agrega una sola vez.

  const title = parts.join(' — ')

  const desc = producto.descripcion
    ? producto.descripcion.slice(0, 155).replace(/\n/g, ' ')
    : `${producto.estado || 'Producto'} en venta ${ubicacion ? 'en ' + ubicacion : 'en España'}`

  const image = producto.imagen_url
    ? [{ url: producto.imagen_url, width: 800, height: 600, alt: producto.titulo }]
    : undefined

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      type: 'article',
      images: image,
      locale: 'es_ES',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      images: image,
    },
    alternates: {
      canonical: `https://camperocasion.es/producto/${canonicalSlug}`,
      languages: {
        'es-VE': `https://camperocasion.es/producto/${canonicalSlug}`,
        'x-default': `https://camperocasion.es/producto/${canonicalSlug}`,
      },
    },
    // Vendido: la URL sigue viva (llega tráfico de WhatsApp/Google y hay
    // similares que mostrar) pero fuera del índice: contenido agotado.
    robots: producto.vendido
      ? { index: false, follow: true }
      : { index: true, follow: true },
  }
}

export default async function ProductoPage({ params }: Props) {
  const { locale, slug } = await params
  const producto = await getProductCached(slug)
  const t = await getTranslations('productDetail')

  // 301 permanente: URLs legacy con UUID o con slug viejo → slug canónico.
  // Transfiere el link equity acumulado a las nuevas URLs semánticas.
  if (producto?.slug && producto.slug !== slug) {
    const canonicalPath = `/producto/${producto.slug}`
    permanentRedirect(
      locale === routing.defaultLocale ? canonicalPath : `/${locale}${canonicalPath}`
    )
  }

  // 404 REAL (status 404, no soft-404): pausados, eliminados o inexistentes.
  if (!producto) {
    notFound()
  }

  const [relacionados, favoritosCount, resumenResenas, verificacion, reserva] = await Promise.all([
    getRelacionados(producto),
    getFavoritosCount(producto.id),
    getResumenResenas(producto.id),
    getVerificacionHomologacion(producto.id),
    getEstadoReserva(producto.id),
  ])

  // JSON-LD Product Schema
  const sellerName = producto.perfil?.nombre_completo || 'Vendedor CamperOcasión';
  const sellerPhone = producto.perfil?.telefono;
  const sellerCity = producto.perfil?.ciudad || producto.ubicacion_ciudad || '';
  const sellerState = producto.perfil?.estado || producto.ubicacion_estado || '';
  
  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `https://camperocasion.es/producto/${producto.slug || slug}`,
    name: producto.titulo,
    description: producto.descripcion?.slice(0, 500) || producto.titulo,
    image: producto.imagen_url ? [producto.imagen_url] : [],
    url: `https://camperocasion.es/producto/${producto.slug || slug}`,
    sku: producto.id,
    offers: {
      '@type': 'Offer',
      price: producto.precio_usd || 0,
      priceCurrency: 'EUR',
      availability: producto.vendido ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      seller: {
        '@type': 'Person',
        name: sellerName,
        ...(sellerPhone && { telephone: sellerPhone }),
        address: {
          '@type': 'PostalAddress',
          addressLocality: sellerCity,
          addressRegion: sellerState,
          addressCountry: 'ES',
        },
      },
    },
    category: producto.subcategoria || '',
    itemCondition: 'https://schema.org/' + (producto.estado === 'Nuevo' ? 'NewCondition' : 'UsedCondition'),
    address: {
      '@type': 'PostalAddress',
      addressLocality: producto.ubicacion_ciudad || '',
      addressRegion: producto.ubicacion_estado || '',
      addressCountry: 'ES',
    },
  }

  // Estrellas en resultados de Google: solo con reseñas reales de este
  // producto (Google exige reviewCount ≥ 1; sin reseñas no se envía nada).
  if (resumenResenas.count > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: resumenResenas.avg,
      reviewCount: resumenResenas.count,
      bestRating: 5,
      worstRating: 1,
    }
  }

  // Encontrar ciudad SEO para la ubicación
  const ciudadSEO = producto.ubicacion_ciudad 
    ? getCiudadByMunicipioYEstado(producto.ubicacion_ciudad, producto.ubicacion_estado || '') 
    : undefined

  // Breadcrumb items
  const breadcrumbItems = [
    { label: producto.subcategoria || 'Categoría', href: `/catalogo?subcategoria=${producto.subcategoria}` },
    { 
      label: ciudadSEO ? ciudadSEO.nombre : (producto.ubicacion_ciudad || 'Ubicación'), 
      href: ciudadSEO ? `/${ciudadSEO.slug}` : `/catalogo?ciudad=${producto.ubicacion_ciudad}` 
    },
    { label: producto.titulo, href: undefined }
  ]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Breadcrumbs items={breadcrumbItems} />
      <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-20 text-center">{t('loading')}</div>}>
        <ProductoPageClient
          initialProduct={producto}
          favoritosCount={favoritosCount}
          verificacion={verificacion}
          reserva={reserva}
        />
      </Suspense>

      {relacionados.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-8 border-t border-gray-100 mt-8">
          <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-4">
            {t('relatedTitle')}
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {relacionados.map((p: any) => (
              <LocalLink
                key={p.id}
                href={`/producto/${p.slug || p.id}`}
                className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition group block"
              >
                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                  <Image
                    src={p.imagen_url || '/placeholder-product.webp'}
                    alt={p.titulo}
                    fill
                    sizes="(max-width: 768px) 45vw, 300px"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    decoding="async"
                    quality={75}
                  />
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-gray-900 text-sm truncate group-hover:text-brand-primary transition-colors">
                    {p.titulo}
                  </h3>
                  <p className="text-lg font-black text-brand-primary mt-0.5">
                    {formatPrecio(p.precio_usd || 0)}
                  </p>
                  {p.ubicacion_ciudad && (
                    <p className="text-[11px] text-gray-500 truncate">{p.ubicacion_ciudad}</p>
                  )}
                </div>
              </LocalLink>
            ))}
          </div>
        </section>
      )}
    </>
  )
}