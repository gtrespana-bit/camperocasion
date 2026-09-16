import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import { supabase } from '@/lib/supabase-server-client'
import { ChevronRight } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { productUrl } from '@/lib/product-url'
import { SUBCATEGORIAS_SEO } from '@/lib/categorias-seo'
import { formatPrecio } from '@/lib/precio'

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
    let query = supabase
      .from('productos')
      .select('id, slug, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, subcategoria, destacado, destacado_hasta')
      .eq('activo', true)
      .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado')
      .order('creado_en', { ascending: false })
      .limit(24)

    // La landing filtra por la etiqueta real de subcategoría camper
    const subLabel = CATEGORIA_MAP[categoriaSlug]
    if (subLabel) {
      query = query.eq('subcategoria', subLabel)
    }

    if (ciudadMunicipio && ciudadMunicipio !== ciudadNombre) {
      query = query.or(`ubicacion_ciudad.eq."${ciudadNombre}",ubicacion_ciudad.eq."${ciudadMunicipio}"`)
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

export default async function LandingCategoria({ ciudadSlug, ciudadNombre, ciudadMunicipio, categoriaSlug, categoriaNombre }: Props) {
  // getTranslations (API server de next-intl) en vez de useTranslations:
  // useTranslations dentro de un Server Component async bajo <Suspense>
  // lanzaba "Expected a suspended thenable" en Next 16 → 500.
  const t = await getTranslations('catLanding')
  const productos = await getProductos(ciudadNombre, ciudadMunicipio, categoriaSlug)

  // Categorias relacionadas para la ciudad
  const categoriasRelacionadas = Object.entries(CATEGORIA_MAP)
    .filter(([k]) => k !== categoriaSlug)
    .map(([k, v]) => ({ slug: k, nombre: CATEGORIA_NAMES[k] || k }))

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
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

      {/* Sin <Suspense>: los productos ya están cargados (await arriba) y el
          Suspense alrededor de un Server Component con thenables de next-intl
          causaba "Expected a suspended thenable" en Next 16. */}
      <ProductosGrid productos={productos} categoriaNombre={categoriaNombre} ciudadNombre={ciudadNombre} t={t} />
    </div>
  )
}
