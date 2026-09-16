import { Metadata } from 'next'
import LandingCategoria from './LandingCategoria'
import { getCiudadBySlug, NOMBRES_CATEGORIA_POPULAR, CATEGORIAS_POPULARES } from '@/lib/ubicaciones-seo'
import { getSubcategoriaSEO } from '@/lib/categorias-seo'
import Breadcrumbs from '@/components/Breadcrumbs'
import { getTranslations } from 'next-intl/server'

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


import { getSupabaseServerClient } from '@/lib/supabase-server-client'
import { hayAnunciosEnCiudadCategoria } from '@/lib/seo-landings'
import { notFound } from 'next/navigation'

type Props = {
  params: Promise<{ ciudad: string; categoria: string; locale: string }>
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

  return {
    title,
    description,
    keywords,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'es_ES',
    },
    alternates: {
      canonical: `https://camperocasion.es/${ciudad}/${categoria}`,
      languages: {
        'es-ES': `https://camperocasion.es/${ciudad}/${categoria}`,
        'x-default': `https://camperocasion.es/${ciudad}/${categoria}`,
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

  // Breadcrumb items
  const breadcrumbItems = [
    { label: ciudadSEO.nombre, href: `/${ciudad}` },
    { label: cat.nombre, href: undefined }
  ]

  return (
    <>
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
