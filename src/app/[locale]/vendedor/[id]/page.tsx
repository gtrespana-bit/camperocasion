import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase-server-client'
import VendedorClient from './VendedorClient'

// ISR: perfiles de vendedor cacheados 5 minutos
export const revalidate = 300

type Props = {
  params: Promise<{ locale: string; id: string }>
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function getVendedor(id: string) {
  if (!id || !UUID_RE.test(id)) return null
  if (!supabase) return null // Sin Supabase: 404 limpio en vez de 500

  const { data: perfil, error } = await supabase
    .from('perfiles')
    .select(
      'id, nombre, estado, ciudad, verificado, nivel_confianza, creado_en, foto_perfil_url, badges_automaticos, tipo_vendedor'
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !perfil) return null

  // Reseñas reales (base de la reputación y del AggregateRating)
  // Nota: `producto_titulo` NO es columna de `resenas` — se une con `productos`
  // para obtener el título real y evitar que la query falle en silencio (0 reseñas).
  const { data: res, error: errRes } = await supabase
    .from('resenas')
    .select('id, puntuacion, comentario, producto_id, creado_en, producto:productos(titulo)')
    .eq('vendedor_id', id)
    .order('creado_en', { ascending: false })

  if (errRes) {
    console.error('[vendedor] Error al cargar reseñas:', errRes)
  }

  const resenas = res || []
  const promedio =
    resenas.length > 0
      ? Math.round(
          (resenas.reduce((sum, r) => sum + r.puntuacion, 0) / resenas.length) * 10
        ) / 10
      : 0

  // Productos activos del vendedor (con slug para URLs canónicas)
  const { data: prods } = await supabase
    .from('productos')
    .select('id, slug, titulo, precio_usd, imagen_url, categoria_id, subcategoria')
    .eq('user_id', id)
    .eq('activo', true)
    .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado,estado_moderacion.eq.pendiente')
    .order('creado_en', { ascending: false })
    .limit(12)

  let productos = prods || []
  // Fallback si la migración de slugs aún no corrió
  if (prods === null) {
    const { data: legacy } = await supabase
      .from('productos')
      .select('id, titulo, precio_usd, imagen_url, categoria_id, subcategoria')
      .eq('user_id', id)
      .eq('activo', true)
      .order('creado_en', { ascending: false })
      .limit(12)
    productos = legacy || []
  }

  return { perfil, resenas, promedio, productos }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const data = await getVendedor(id)

  if (!data) {
    return {
      title: 'Vendedor no encontrado',
      robots: { index: false, follow: false },
    }
  }

  const { perfil, resenas, promedio, productos } = data
  const nombre = perfil.nombre || 'Vendedor'
  const ubicacion = [perfil.ciudad, perfil.estado].filter(Boolean).join(', ')

  const title = ubicacion
    ? `${nombre} — Vendedor en ${ubicacion}`
    : `${nombre} — Vendedor`

  const parts: string[] = []
  if (perfil.verificado) parts.push('Vendedor verificado')
  if (resenas.length > 0) {
    parts.push(`${promedio}★ de ${resenas.length} ${resenas.length === 1 ? 'reseña' : 'reseñas'}`)
  }
  if (productos.length > 0) parts.push(`${productos.length} productos en venta`)
  if (ubicacion) parts.push(ubicacion)

  const description = `Perfil de ${nombre} en CamperOcasión España. ${
    parts.length > 0 ? parts.join(' · ') + '. ' : ''
  }Compra y vende de forma segura en el marketplace de clasificados de España.`

  const images = perfil.foto_perfil_url ? [{ url: perfil.foto_perfil_url }] : undefined

  return {
    title,
    description,
    alternates: {
      canonical: `https://camperocasion.online/vendedor/${id}`,
      languages: {
        'es-ES': `https://camperocasion.online/vendedor/${id}`,
        'x-default': `https://camperocasion.online/vendedor/${id}`,
      },
    },
    openGraph: {
      title,
      description,
      url: `https://camperocasion.online/vendedor/${id}`,
      siteName: 'CamperOcasión',
      type: 'profile',
      locale: 'es_ES',
      images,
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images,
    },
  }
}

export default async function VendedorPage({ params }: Props) {
  const { id } = await params
  const data = await getVendedor(id)

  // 404 real (el cliente anterior hacía redirect a /, devolviendo 200 vacío
  // para vendedores inexistentes → soft 404, penalizado por Google)
  if (!data) notFound()

  const { perfil, resenas, promedio, productos } = data

  // JSON-LD: Person/Organization con AggregateRating SOLO si hay reseñas
  // reales — ratingValue sin reviewCount real es spam según las políticas
  // de Google para datos estructurados.
  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': perfil.verificado ? 'Organization' : 'Person',
    name: perfil.nombre || 'Vendedor CamperOcasión',
    url: `https://camperocasion.online/vendedor/${id}`,
    ...(perfil.foto_perfil_url && { image: perfil.foto_perfil_url }),
    address: {
      '@type': 'PostalAddress',
      addressLocality: perfil.ciudad || '',
      addressRegion: perfil.estado || '',
      addressCountry: 'ES',
    },
    ...(resenas.length > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: promedio.toFixed(1),
        reviewCount: resenas.length,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <VendedorClient
        vendedor={perfil}
        productos={productos}
        resenas={resenas}
        promedio={promedio}
      />
    </>
  )
}
