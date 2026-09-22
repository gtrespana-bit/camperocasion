import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { supabase } from '@/lib/supabase-server-client'
import { COLUMNAS_PRECIO } from '@/lib/precio'
import { slugValido } from '@/lib/tiendas'
import TiendaClient from './TiendaClient'

/**
 * Escaparate público de un camperizador o profesional: /tienda/[slug].
 *
 * Existe aparte de `/vendedor/[id]` a propósito. Aquella es una ficha de
 * usuario con una URL de UUID que nadie puede pegar en su web; esta es una
 * dirección legible y estable que el profesional reparte en su Instagram y en
 * su propia página. Esa diferencia es justo lo que convierte al vendedor
 * recurrente en una fuente fija de inventario.
 */

export const revalidate = 300

type Props = { params: Promise<{ locale: string; slug: string }> }

const SITIO = 'https://camperocasion.online'

async function getTienda(slug: string) {
  if (!slug || !slugValido(slug)) return null
  if (!supabase) return null

  const { data: perfil, error } = await supabase
    .from('perfiles')
    .select(
      'id, slug, nombre, descripcion, web, portada_url, horario, direccion, ' +
        'ciudad, estado, verificado, nivel_confianza, creado_en, foto_perfil_url, ' +
        'tipo_vendedor, tienda_activa'
    )
    .eq('slug', slug)
    .maybeSingle()

  // Si la migración de tiendas aún no está aplicada, la columna no existe:
  // 404 limpio en vez de un 500 con traza.
  if (error || !perfil) return null
  // Una tienda desactivada no se publica, aunque conserve su slug.
  if (!perfil.tienda_activa) return null

  const { data: prods } = await supabase
    .from('productos')
    .select(
      `id, slug, titulo, ${COLUMNAS_PRECIO}, imagen_url, categoria_id, subcategoria, ` +
        'ubicacion_ciudad, ubicacion_estado, estado, boosteado_en, destacado, destacado_hasta, ' +
        'vendedor_verificado, vendedor_tipo, verificacion_homologacion, reservado, es_demo'
    )
    .eq('user_id', perfil.id)
    .eq('activo', true)
    .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado,estado_moderacion.eq.pendiente')
    .order('creado_en', { ascending: false })
    .limit(60)

  const { data: res } = await supabase
    .from('resenas')
    .select('puntuacion')
    .eq('vendedor_id', perfil.id)

  const resenas = res || []
  const promedio =
    resenas.length > 0
      ? Math.round((resenas.reduce((s, r) => s + r.puntuacion, 0) / resenas.length) * 10) / 10
      : 0

  return { perfil, productos: prods || [], totalResenas: resenas.length, promedio }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await getTienda(slug)

  if (!data) {
    return { title: 'Tienda no encontrada', robots: { index: false, follow: false } }
  }

  const { perfil, productos, totalResenas, promedio } = data
  const nombre = perfil.nombre || 'Tienda'
  const ubicacion = [perfil.ciudad, perfil.estado].filter(Boolean).join(', ')
  const esCamperizador = perfil.tipo_vendedor === 'camperizador'

  const title = ubicacion
    ? `${nombre} — ${esCamperizador ? 'Camperizador' : 'Concesionario'} en ${ubicacion}`
    : `${nombre} — ${esCamperizador ? 'Camperizador' : 'Profesional'}`

  const partes: string[] = []
  if (productos.length > 0) {
    partes.push(`${productos.length} ${productos.length === 1 ? 'vehículo' : 'vehículos'} en stock`)
  }
  if (perfil.verificado) partes.push('vendedor verificado')
  if (totalResenas > 0) partes.push(`${promedio}★ (${totalResenas})`)

  const description =
    (perfil.descripcion || '').trim().slice(0, 150) ||
    `Stock de furgonetas camper y autocaravanas de ${nombre}${ubicacion ? ` en ${ubicacion}` : ''}. ${partes.join(' · ')}.`

  const url = `${SITIO}/tienda/${perfil.slug}`
  const images = perfil.portada_url
    ? [{ url: perfil.portada_url }]
    : perfil.foto_perfil_url
      ? [{ url: perfil.foto_perfil_url }]
      : undefined

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: { 'es-ES': url, 'x-default': url },
    },
    openGraph: { title, description, url, siteName: 'CamperOcasión', type: 'profile', locale: 'es_ES', images },
    twitter: { card: 'summary_large_image', title, description, images },
  }
}

export default async function TiendaPage({ params }: Props) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const data = await getTienda(slug)
  if (!data) notFound()

  const { perfil, productos, totalResenas, promedio } = data

  // JSON-LD: un profesional con stock es un AutoDealer a ojos de Google, y eso
  // le da ficha de negocio local en vez de una página suelta.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    name: perfil.nombre,
    url: `${SITIO}/tienda/${perfil.slug}`,
    ...(perfil.descripcion ? { description: perfil.descripcion } : {}),
    ...(perfil.foto_perfil_url ? { image: perfil.foto_perfil_url } : {}),
    ...(perfil.web ? { sameAs: [perfil.web] } : {}),
    ...(perfil.ciudad || perfil.estado
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(perfil.direccion ? { streetAddress: perfil.direccion } : {}),
            ...(perfil.ciudad ? { addressLocality: perfil.ciudad } : {}),
            ...(perfil.estado ? { addressRegion: perfil.estado } : {}),
            addressCountry: 'ES',
          },
        }
      : {}),
    ...(perfil.horario ? { openingHours: perfil.horario } : {}),
    ...(totalResenas > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: promedio,
            reviewCount: totalResenas,
          },
        }
      : {}),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <TiendaClient
        perfil={perfil}
        productos={productos}
        totalResenas={totalResenas}
        promedio={promedio}
      />
    </>
  )
}
