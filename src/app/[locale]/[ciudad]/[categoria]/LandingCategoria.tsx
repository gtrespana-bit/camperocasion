import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import { supabase } from '@/lib/supabase-server-client'
import { aplicarOrdenCatalogo } from '@/lib/catalog-consulta'
import { ChevronRight, ArrowRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { productUrl } from '@/lib/product-url'
import { SUBCATEGORIAS_SEO, getSubcategoriaSEO } from '@/lib/categorias-seo'
import { formatPrecio, formatRango } from '@/lib/precio'
import { estadisticasCiudad } from '@/lib/seo-landings'
import { serializeJsonLd } from '@/lib/serialize-json-ld'

interface Props {
  ciudadSlug: string
  ciudadNombre: string
  ciudadMunicipio?: string
  estado: string
  categoriaSlug: string
  categoriaNombre: string
  descripcion: string
}

// Subcategorías camper: slug → subcategoría tal como se guarda en la BD
const CATEGORIA_MAP: Record<string, string> = Object.fromEntries(
  SUBCATEGORIAS_SEO.map(s => [s.slug, s.categoria])
)

async function getProductos(ciudadNombre: string, ciudadMunicipio: string | undefined, categoriaSlug: string) {
  if (!supabase) return []
  try {
    // Mismo ORDER BY compartido que el catálogo: prioridad pagada primero.
    let query = aplicarOrdenCatalogo(
      supabase
        .from('productos')
        .select('id, slug, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, subcategoria, destacado, destacado_hasta')
        .eq('activo', true)
        .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado'),
    ).limit(24)

    // La landing filtra por la etiqueta real de subcategoría camper
    const subLabel = CATEGORIA_MAP[categoriaSlug]
    if (subLabel) {
      query = query.eq('subcategoria', subLabel)
    }

    if (ciudadMunicipio && ciudadMunicipio !== ciudadNombre) {
      query = query.or(`ubicacion_ciudad.eq.\"${ciudadNombre}\",ubicacion_ciudad.eq.\"${ciudadMunicipio}\"`)
    } else {
      query = query.eq('ubicacion_ciudad', ciudadNombre)
    }

    const { data } = await query
    return data || []
  } catch (error) {
    console.error('Error fetching productos:', error)
    return []
  }
}

const CATEGORIA_NAMES: Record<string, string> = Object.fromEntries(
  SUBCATEGORIAS_SEO.map(s => [s.slug, s.nombre])
)

function ProductosGrid({ productos, categoriaNombre, ciudadNombre, t }: { productos: any[], categoriaNombre: string, ciudadNombre: string, t: any }) {
  if (productos.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-xl mb-2">{t('noAds', { category: categoriaNombre.toLowerCase(), city: ciudadNombre })}</p>
        <p className="mb-4">{t('beFirst')}</p>
        <LocalLink href="/publicar" className="inline-block bg-brand-primary text-white px-6 py-3 rounded-lg font-bold">{t('postFree')}</LocalLink>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {productos.map((p: any) => (
        <LocalLink key={p.id} href={productUrl(p)} className="bg-white rounded-xl overflow-hidden shadow-sm border hover:shadow-lg transition group block">
          <div className="aspect-square bg-gray-100 relative overflow-hidden">
            {p.destacado && new Date(p.destacado_hasta) > new Date() && (
              <div className="absolute top-2 left-2 z-10 bg-brand-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full">⭐ {t('featured')}</div>
            )}
            {p.imagen_url ? (
              <Image src={p.imagen_url} alt={p.titulo} width={300} height={300} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 text-4xl"></div>
            )}
          </div>
          <div className="p-3">
            <h3 className="font-semibold text-gray-900 text-sm truncate">{p.titulo}</h3>
            <p className="text-lg font-black text-brand-primary mt-1">{formatPrecio(p.precio_usd || 0)}</p>
            <p className="text-xs text-gray-500">{p.estado} · {p.subcategoria}</p>
          </div>
        </LocalLink>
      ))}
    </div>
  )
}

export default async function LandingCategoria({ ciudadSlug, ciudadNombre, ciudadMunicipio, estado, categoriaSlug, categoriaNombre }: Props) {
  // getTranslations (API server de next-intl) en vez de useTranslations:
  // useTranslations dentro de un Server Component async bajo <Suspense>
  // lanzaba "Expected a suspended thenable" en Next 16 → 500.
  const t = await getTranslations('catLanding')
  const subLabel = CATEGORIA_MAP[categoriaSlug]
  const [productos, stats] = await Promise.all([
    getProductos(ciudadNombre, ciudadMunicipio, categoriaSlug),
    // Agregados de ESTA categoría en ESTA provincia (fail-open:
    // si la DB falla, stats.total = 0 y las secciones se omiten).
    estadisticasCiudad(supabase, ciudadNombre, ciudadMunicipio, subLabel),
  ])
  const seoCat = getSubcategoriaSEO(categoriaSlug)

  // Categorias relacionadas para la ciudad
  const categoriasRelacionadas = Object.entries(CATEGORIA_MAP)
    .filter(([k]) => k !== categoriaSlug)
    .map(([k, v]) => ({ slug: k, nombre: CATEGORIA_NAMES[k] || k }))

  // FAQ: la de la categoría (ya redactada) + 2 específicas de
  // provincia con datos reales de precio → contenido único por URL.
  const precioTexto =
    stats.precioMedio !== null
      ? `alrededor de ${formatPrecio(stats.precioMedio)} de media`
      : null
  const rangoTexto =
    stats.precioMin !== null && stats.precioMax !== null
      ? formatRango(stats.precioMin, stats.precioMax)
      : null

  const faqs = [
    ...(seoCat?.faq || []),
    {
      pregunta: `¿Cuánto cuesta una ${categoriaNombre.toLowerCase()} en ${ciudadNombre}?`,
      respuesta:
        precioTexto && rangoTexto
          ? `En ${ciudadNombre} (${estado}) el precio medio de una ${categoriaNombre.toLowerCase()} de ocasión es ${precioTexto}, con anuncios que van ${rangoTexto} según año, kilometraje y equipamiento. Filtra el catálogo por rango de precio para ajustar la búsqueda y calcula el ITP de tu comunidad antes de comprar.`
          : `El precio de una ${categoriaNombre.toLowerCase()} de ocasión en ${ciudadNombre} depende del año, los kilómetros y el equipamiento. Filtra el catálogo por rango de precio para ajustar la búsqueda y calcula el ITP de tu comunidad antes de comprar.`,
    },
    {
      pregunta: `¿Dónde veo todas las ${categoriaNombre.toLowerCase()} de ${ciudadNombre}?`,
      respuesta: `Esta landing muestra las ${stats.total > 0 ? stats.total : 'principales'} ${categoriaNombre.toLowerCase()} de ocasión en ${ciudadNombre}. Para ver el listado completo con todos los filtros (precio, kilómetros, año, homologación verificada), entra al catálogo filtrado por ${ciudadNombre}.`,
    },
  ]

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `https://camperocasion.online/${ciudadSlug}/${categoriaSlug}#faq`,
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.pregunta,
      acceptedAnswer: {
        '@type': 'Answer',
        text: f.respuesta,
      },
    })),
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
      />
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6 flex-wrap">
        <LocalLink href="/" className="hover:text-brand-primary">{t('breadcrumb')}</LocalLink>
        <ChevronRight size={14} />
        <LocalLink href={`/${ciudadSlug}`} className="hover:text-brand-primary">{ciudadNombre}</LocalLink>
        <ChevronRight size={14} />
        <span className="text-gray-800 font-medium">{categoriaNombre}</span>
      </nav>

      <h1 className="text-2xl md:text-3xl font-black text-gray-900 mb-2">
        {categoriaNombre} en {ciudadNombre}
      </h1>
      <p className="text-gray-500 mb-6">
        {t('desc', { category: categoriaNombre.toLowerCase(), city: ciudadNombre })}
      </p>

      {/* Categorias en esta ciudad */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categoriasRelacionadas.map((cat) => (
          <LocalLink key={cat.slug} href={`/${ciudadSlug}/${cat.slug}`} className="text-sm bg-gray-100 text-gray-600 px-3 py-1 rounded-full hover:bg-brand-primary hover:text-white transition">
            {t('title', { category: cat.nombre, city: ciudadNombre })}
          </LocalLink>
        ))}
      </div>

      {/* ── Contenido único por ciudad + categoría ── */}
      {(stats.total > 0 || seoCat?.introduccion) && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 mb-8">
          {stats.total > 0 && (
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>{stats.total} {stats.total === 1 ? 'anuncio' : 'anuncios'} de {categoriaNombre.toLowerCase()}</strong> de ocasión en {ciudadNombre} ({estado})
              {precioTexto ? <> con un precio medio de <strong>{formatPrecio(stats.precioMedio)}</strong></> : ''}
              {rangoTexto ? <> (rango {rangoTexto})</> : ''}.
              {stats.porMarca.length > 0 && (
                <> Las marcas más habituales en {ciudadNombre} para esta categoría: {stats.porMarca.slice(0, 4).map(m => m.marca).join(', ')}.</>
              )}
            </p>
          )}
          {seoCat?.introduccion?.map((parrafo, i) => (
            <p key={i} className="text-gray-700 leading-relaxed mb-4">{parrafo}</p>
          ))}
        </section>
      )}

      {/* Sin <Suspense>: los productos ya están cargados (await arriba) y el
          Suspense alrededor de un Server Component con thenables de next-intl
          causaba "Expected a suspended thenable" en Next 16. */}
      <ProductosGrid productos={productos} categoriaNombre={categoriaNombre} ciudadNombre={ciudadNombre} t={t} />

      {/* ── FAQ (La gente también pregunta) ── */}
      <section className="mt-12">
        <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-4">
          Preguntas frecuentes: {categoriaNombre} en {ciudadNombre}
        </h2>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <details key={i} className="bg-white border border-gray-200 rounded-xl p-4 group">
              <summary className="font-bold text-gray-900 cursor-pointer list-none flex justify-between items-center gap-4">
                {f.pregunta}
                <ArrowRight size={16} className="text-brand-accent shrink-0 transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-sm text-gray-700 leading-relaxed">{f.respuesta}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Enlazado interno: volver a la provincia y al catálogo ── */}
      <section className="mt-10 flex flex-wrap gap-3">
        <LocalLink href={`/${ciudadSlug}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-primary hover:underline">
          <ArrowRight size={14} className="rotate-180" /> Todas las campers de ocasión en {ciudadNombre}
        </LocalLink>
        <LocalLink href={`/catalogo?subcategoria=${encodeURIComponent(subLabel || categoriaNombre)}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-brand-primary">
          Ver todas las {categoriaNombre.toLowerCase()} de España <ArrowRight size={14} />
        </LocalLink>
      </section>
    </div>
  )
}
