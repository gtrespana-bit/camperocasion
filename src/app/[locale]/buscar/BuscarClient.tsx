'use client'
import { formatPrecio } from '@/lib/precio'

import LocalLink from '@/components/LocalLink'
import BadgeHomologacion from '@/components/BadgeHomologacion'
import BadgeTipoVendedor from '@/components/BadgeTipoVendedor'
import { Search, ChevronRight, XCircle, Loader2, Bell, BellRing } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useMemo, use } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { categoriasData, FAMILIAS } from '@/lib/categorias'
import UbicacionSelector from '@/components/UbicacionSelector'
import { useTranslations } from 'next-intl'
import { productUrl } from '@/lib/product-url'
import { FiltrosTecnicosPanel } from '@/components/FiltrosTecnicosPanel'
import {
  leerFiltrosTecnicos,
  leerFiltrosRango,
} from '@/lib/filtros-tecnicos'
import {
  aplicarFiltrosBase,
  esErrorColumnasRango,
  type FiltrosCatalogo,
} from '@/lib/catalog-consulta'
import { SelectorMarca } from '@/components/SelectorMarca'

type Producto = {
  id: string
  titulo: string
  precio_usd: number | null
  estado: string
  imagen_url: string | null
  ubicacion_ciudad: string | null
  ubicacion_estado: string | null
  creado_en: string
  visitas: number
  subcategoria: string | null
  boosteado_en: string | null
  destacado: boolean | null
  destacado_hasta: string | null
  vendedor_verificado: boolean | null
  vendedor_tipo?: string | null
  verificacion_homologacion?: string | null
  reservado?: boolean | null
  descripcion?: string
}

const PLACEHOLDER_IMAGES = [
  '/placeholder-product.webp',
]

function getPlaceholderImage(titulo: string) {
  return PLACEHOLDER_IMAGES[Math.abs(titulo.charCodeAt(0)) % PLACEHOLDER_IMAGES.length]
}

function ProductCard({ p }: { p: Producto }) {
  const isBoosted = p.boosteado_en != null
  const isFeatured = p.destacado && p.destacado_hasta && new Date(p.destacado_hasta) > new Date()
  const isPromoted = isBoosted || isFeatured
  const imgUrl = p.imagen_url || getPlaceholderImage(p.titulo)

  return (
    <LocalLink
      href={productUrl(p)}
      className={`bg-white rounded-xl overflow-hidden transition-all duration-200 group block border
        ${isPromoted
          ? 'border-2 border-brand-accent shadow-md hover:shadow-xl hover:-translate-y-1'
          : 'border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-gray-200'
        }`}
    >
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        {isFeatured && (
          <div className="absolute top-2 left-2 z-10 bg-brand-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            ⭐ Destacado
          </div>
        )}
        {isBoosted && !isFeatured && (
          <div className="absolute top-2 left-2 z-10 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            ⚡ Boost
          </div>
        )}
        <Image
          src={imgUrl}
          alt={p.titulo}
          width={300}
          height={300}
          sizes="(max-width: 768px) 50vw, 25vw"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            if (!target.src.includes('/placeholder-product.webp')) {
              target.src = '/placeholder-product.webp'
            }
          }}
        />
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 truncate group-hover:text-brand-primary transition-colors">
          {p.titulo}
        </h3>
        <p className="text-xl font-black text-brand-primary mt-1">
          {formatPrecio(p.precio_usd || 0)}
        </p>
        {p.reservado && (
          <div className="mt-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
              🔒 Reservado
            </span>
          </div>
        )}
        {p.verificacion_homologacion === 'verificada' && (
          <div className="mt-1">
            <BadgeHomologacion estado={p.verificacion_homologacion} size="sm" />
          </div>
        )}
        {p.vendedor_tipo && (
          <div className="mt-1">
            <BadgeTipoVendedor tipo={p.vendedor_tipo} />
          </div>
        )}
        {p.vendedor_verificado && (
          <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full mt-1">
            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Verificado
          </div>
        )}
        <p className="text-xs text-gray-500 mt-1 truncate">
          {p.ubicacion_ciudad
            ? `${p.ubicacion_ciudad} · ${p.estado}`
            : p.estado}
        </p>
      </div>
    </LocalLink>
  )
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

export default function BuscarClient({ searchParams: searchParamsPromise }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const searchParams = use(searchParamsPromise)
  const router = useRouter()
  const t = useTranslations('search')
  const tc = useTranslations('catalog')
  const t2 = useTranslations()
  // Traductor universal para el panel técnico (resolve 'catalog.*' y, si la
  // clave no está en 'search', cae a 'catalog').
  const tu = (key: string) => {
    const parts = key.split('.')
    const ns = parts[0]
    const rest = parts.slice(1).join('.')
    if (ns === 'catalog') return tc(rest as any)
    return t(key as any)
  }
  
  const query = searchParams?.q || ''
  const categoria = searchParams?.categoria || ''
  const subcategoria = searchParams?.subcategoria || ''
  const marca = searchParams?.marca || ''
  const condicion = searchParams?.condicion || ''
  const ubicacionEstado = searchParams?.estado || ''
  const ubicacionCiudad = searchParams?.ciudad || ''
  const precioMin = searchParams?.precio_min || ''
  const precioMax = searchParams?.precio_max || ''
  const orden = searchParams?.orden || ''

  // Filtros técnicos camper (los mismos del catálogo): opciones + rangos.
  // Se memoizan por la referencia de `searchParams`: `use()` devuelve la misma
  // referencia mientras no cambie la query string, así que el efecto no se
  // reejecuta en bucle por identidades nuevas.
  const filtrosTecnicos = useMemo(() => leerFiltrosTecnicos(searchParams ?? {}), [searchParams])
  const filtrosRango = useMemo(() => leerFiltrosRango(searchParams ?? {}), [searchParams])
  const rangosEnBruto: Record<string, string> = {}
  for (const k of ['kmMax', 'anioMin', 'placaWatiosMin', 'inversorWatiosMin']) {
    const v = searchParams?.[k]
    if (v) rangosEnBruto[k] = v
  }

  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(false)
  const [resultCount, setResultCount] = useState(0)

  // ---- Búsqueda guardada ("avísame cuando aparezca") ----
  const { user } = useAuth()
  const [busquedaGuardadaId, setBusquedaGuardadaId] = useState<string | null>(null)
  const [guardandoBusqueda, setGuardandoBusqueda] = useState(false)
  const tieneFiltros = !!(query || categoria || subcategoria || marca || condicion || ubicacionEstado || ubicacionCiudad || precioMin || precioMax)

  // ¿Esta búsqueda ya está guardada? (marca el botón como activo)
  useEffect(() => {
    if (!user || !tieneFiltros) { setBusquedaGuardadaId(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/busquedas-guardadas', {
          headers: { Authorization: `Bearer ${session?.access_token || ''}` },
        })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        const match = (data.busquedas || []).find((b: any) =>
          (b.q || '') === (query || '') &&
          (b.categoria || '') === (categoria || '') &&
          (b.subcategoria || '') === (subcategoria || '') &&
          (b.marca || '') === (marca || '') &&
          (b.ubicacion_ciudad || '') === (ubicacionCiudad || '') &&
          (b.ubicacion_estado || '') === (ubicacionEstado || '')
        )
        setBusquedaGuardadaId(match?.id || null)
      } catch { /* silencioso */ }
    })()
    return () => { cancelled = true }
  }, [user, query, categoria, subcategoria, marca, ubicacionEstado, ubicacionCiudad, tieneFiltros])

  const toggleGuardarBusqueda = async () => {
    if (guardandoBusqueda) return
    if (!user) {
      const params = new URLSearchParams(window.location.search)
      router.push(`/login?redirect=${encodeURIComponent('/buscar?' + params.toString())}`)
      return
    }
    setGuardandoBusqueda(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers = { Authorization: `Bearer ${session?.access_token || ''}`, 'Content-Type': 'application/json' }

      if (busquedaGuardadaId) {
        const res = await fetch(`/api/busquedas-guardadas?id=${busquedaGuardadaId}`, { method: 'DELETE', headers })
        if (res.ok) setBusquedaGuardadaId(null)
      } else {
        const res = await fetch('/api/busquedas-guardadas', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            q: query || null,
            categoria: categoria || null,
            subcategoria: subcategoria || null,
            marca: marca || null,
            condicion: condicion || null,
            ubicacion_estado: ubicacionEstado || null,
            ubicacion_ciudad: ubicacionCiudad || null,
            precio_min: precioMin || null,
            precio_max: precioMax || null,
          }),
        })
        const data = await res.json()
        if (res.ok && data.id) setBusquedaGuardadaId(data.id)
      }
    } catch { /* silencioso */ } finally {
      setGuardandoBusqueda(false)
    }
  }

  const cat = categoria ? categoriasData[categoria] : undefined
  // El buscador es 100% camper: los tipos se ofrecen siempre aunque no haya
  // categoría en la URL (`categoria` solo queda como parámetro legado).
  const subs = cat ? cat.subs : categoriasData.camper.subs
  // Marcas/modelos estructurados por fabricante (ver @/lib/marcas). Con
  // subcategoría activa solo se ofrecen los modelos aptos para ella.
  const subActiva = subcategoria ? subs.find((s) => s.label === subcategoria) : undefined
  const modelosMarca = subActiva ? subActiva.marcas : subs.flatMap((s) => s.marcas || [])

  const setParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams ? Object.entries(searchParams).filter(([_, v]) => v).map(([k, v]) => [k, v!]) : [])
    if (value) params.set(key, value); else params.delete(key)
    if (key === 'categoria') params.delete('subcategoria')
    router.push('/buscar?' + params.toString())
  }, [searchParams, router])

  const clearAll = () => router.push('/buscar')

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function buscar() {
      const ejecutar = async (conRangos: boolean) => {
        let sq = supabase
          .from('productos')
          .select('id, slug, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, ubicacion_estado, creado_en, subcategoria, boosteado_en, destacado, destacado_hasta, vendedor_verificado, vendedor_tipo, verificacion_homologacion, reservado', { count: 'exact' })
          .eq('activo', true)
          .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado')

        if (categoria) {
          // maybeSingle(): evita el 406 de single() con cero filas.
          const { data: catRow } = await supabase.from('categorias').select('id').eq('nombre', categoria).maybeSingle()
          if (catRow) sq = sq.eq('categoria_id', catRow.id)
        }

        // Filtros compartidos con el catálogo (subcategoría, marca, q,
        // ubicación, precio, condición, ficha técnica camper y rangos).
        const filtros: Record<string, unknown> = {
          subcategoria,
          marca,
          q: query,
          ubicacionEstado,
          ubicacionCiudad,
          precioMin,
          precioMax,
          condicion,
          ...filtrosTecnicos,
        }
        if (conRangos) Object.assign(filtros, filtrosRango)
        const { categoria: _cat, ...resto } = filtros
        sq = aplicarFiltrosBase(sq, resto as FiltrosCatalogo) as typeof sq

        if (orden === 'precio_asc') sq = sq.order('precio_usd', { ascending: true })
        else if (orden === 'precio_desc') sq = sq.order('precio_usd', { ascending: false })
        else sq = sq.order('creado_en', { ascending: false })

        return await sq
      }

      // Plan B: sin columnas generadas de rangos (migración pendiente), reintenta
      // sin los rangos para que el resto de filtros siga funcionando.
      let result = await ejecutar(true)
      if (result.error && esErrorColumnasRango(result.error) && Object.keys(filtrosRango).length > 0) {
        result = await ejecutar(false)
      }

      const { data, count, error } = result
      if (!cancelled) {
        if (!error) {
          let sorted = data as Producto[]
          if (orden !== 'precio_asc' && orden !== 'precio_desc') {
            const now = new Date().toISOString()
            sorted = sorted.sort((a, b) => {
              const aBoost = a.boosteado_en || null
              const bBoost = b.boosteado_en || null
              if (aBoost && !bBoost) return -1
              if (!aBoost && bBoost) return 1
              if (aBoost && bBoost) return bBoost.localeCompare(aBoost)
              const aDest = a.destacado && a.destacado_hasta && a.destacado_hasta > now
              const bDest = b.destacado && b.destacado_hasta && b.destacado_hasta > now
              if (aDest && !bDest) return -1
              if (!aDest && bDest) return 1
              if (aDest && bDest) return b.destacado_hasta!.localeCompare(a.destacado_hasta!)
              return new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
            })
          }
          setResultCount(count ?? 0)
          setProductos(sorted)
        } else {
          console.error('Error buscando:', error)
          setResultCount(0)
          setProductos([])
        }
        setLoading(false)
      }
    }

    buscar()
    return () => { cancelled = true }
  }, [query, categoria, subcategoria, marca, condicion, ubicacionEstado, ubicacionCiudad, precioMin, precioMax, orden, filtrosTecnicos, filtrosRango])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Contenido SEO visible para motores de búsqueda */}
      <div className="mb-6">
        {query ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Resultados de búsqueda para &ldquo;{query}&rdquo; en España
            </h1>
            <p className="text-gray-600">
              Encuentra los mejores clasificados y productos relacionados con &ldquo;{query}&rdquo; en CamperOcasión.es. 
              Compra y vende de forma segura en todo el país.
            </p>
          </>
        ) : categoria ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {cat?.label || categoria} en España — Clasificados CamperOcasión.es
            </h1>
            <p className="text-gray-600">
              Explora {cat?.label || categoria.toLowerCase()} en venta. Los mejores clasificados de {cat?.label || categoria.toLowerCase()} en España. 
              Publica gratis y llega a miles de compradores.
            </p>
          </>
        ) : ubicacionCiudad || ubicacionEstado ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Clasificados en {ubicacionCiudad || ubicacionEstado}, España
            </h1>
            <p className="text-gray-600">
              Compra y vende en {ubicacionCiudad || ubicacionEstado}. Encuentra los mejores clasificados y productos 
              en {ubicacionCiudad || ubicacionEstado}, España. Publica tu anuncio gratis hoy mismo.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Buscar productos — Clasificados España
            </h1>
            <p className="text-gray-600">
              Busca y encuentra los mejores clasificados en España. Compra y vende productos nuevos y usados 
              de forma segura en CamperOcasión.es, el marketplace líder español.
            </p>
          </>
        )}
      </div>

      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6 flex-wrap">
        <LocalLink href="/" className="hover:text-brand-primary">Inicio</LocalLink>
        <ChevronRight size={14} />
        <span className="text-gray-800 font-medium">{t('title')}</span>
        {query && (<><ChevronRight size={14} /><span className="text-gray-900 font-semibold">&ldquo;{query}&rdquo;</span></>)}
      </nav>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="w-full lg:w-72 flex-shrink-0">
          <div className="bg-white rounded-xl p-5 shadow-sm sticky top-20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{t('filters')}</h3>
              {searchParams && Object.keys(searchParams).length > 0 && (
                <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                  <XCircle size={12} /> {t('clearAll')}
                </button>
              )}
            </div>

            <div className="space-y-4">
              {/* Tipo de vehículo: 7 tipos agrupados por familia (Campers /
                  Autocaravanas / Overland). El buscador es 100% camper, así
                  que no hay selector de categoría. */}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-1.5">{tc('typeLabel')}</label>
                <select value={subcategoria} onChange={(e) => setParam('subcategoria', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent">
                  <option value="">{tc('allTypes')}</option>
                  {FAMILIAS.map((f) => (
                    <optgroup key={f.key} label={`${f.icon} ${t2(`familias.${f.key}.label`)}`}>
                      {f.subs.map((slug) => {
                        const s = subs.find((x) => x.slug === slug)
                        if (!s) return null
                        return <option key={s.label} value={s.label}>{s.icon} {s.label}</option>
                      })}
                    </optgroup>
                  ))}
                </select>
              </div>

              {modelosMarca.length > 0 && (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-bold text-gray-900 mb-1.5">{t('brand')}</label>
                    {marca && (
                      <button onClick={() => setParam('marca', '')} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                        <XCircle size={12} /> Quitar
                      </button>
                    )}
                  </div>
                  <SelectorMarca
                    value={marca}
                    modelos={modelosMarca}
                    allLabel={tc('allBrands')}
                    onChange={(v) => setParam('marca', v)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-1.5">{t('condition')}</label>
                <div className="space-y-1.5">
                  {['Nuevo', 'Como nuevo', 'Bueno', 'Usado', 'Para repuestos'].map((e) => (
                    <label key={e} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={condicion === e}
                        onChange={(ev) => setParam('condicion', ev.target.checked ? e : '')}
                        className="rounded text-brand-primary"
                      />
                      {e}
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-bold text-gray-900 mb-3">{t('location')}</h4>
                <UbicacionSelector
                  estado={ubicacionEstado}
                  ciudad={ubicacionCiudad}
                  onChange={(estado, ciudad) => {
                    const params = new URLSearchParams(searchParams ? Object.entries(searchParams).filter(([_, v]) => v).map(([k, v]) => [k, v!]) : [])
                    if (estado) params.set('estado', estado); else params.delete('estado')
                    if (ciudad) params.set('ciudad', ciudad); else params.delete('ciudad')
                    router.push('/buscar?' + params.toString())
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-1.5">{t('priceUsd')}</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={precioMin}
                    onChange={(e) => setParam('precio_min', e.target.value)}
                    placeholder="Min"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white"
                  />
                  <input
                    type="number"
                    value={precioMax}
                    onChange={(e) => setParam('precio_max', e.target.value)}
                    placeholder="Max"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white"
                  />
                </div>
              </div>

              {/* Ficha técnica camper: el mismo panel que usa /catalogo, con las
                  mismas opciones del formulario de publicación. */}
              <div className="mt-4 pt-4 border-t">
                <FiltrosTecnicosPanel
                  filtrosTecnicos={filtrosTecnicos}
                  rangos={rangosEnBruto}
                  t={tu}
                  onSetParam={setParam}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-1.5">Ordenar</label>
                <select value={orden} onChange={(e) => setParam('orden', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent">
                  <option value="">Relevancia</option>
                  <option value="reciente">Mas recientes</option>
                  <option value="precio_asc">Precio: menor a mayor</option>
                  <option value="precio_desc">Precio: mayor a menor</option>
                </select>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1">
          <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
            <form action="/buscar" method="GET" className="flex gap-2">
              {categoria && <input type="hidden" name="categoria" value={categoria} />}
              {subcategoria && <input type="hidden" name="subcategoria" value={subcategoria} />}
              {marca && <input type="hidden" name="marca" value={marca} />}
              {condicion && <input type="hidden" name="condicion" value={condicion} />}
              {ubicacionEstado && <input type="hidden" name="estado" value={ubicacionEstado} />}
              {ubicacionCiudad && <input type="hidden" name="ciudad" value={ubicacionCiudad} />}
              {precioMin && <input type="hidden" name="precio_min" value={precioMin} />}
              {precioMax && <input type="hidden" name="precio_max" value={precioMax} />}
              {orden && <input type="hidden" name="orden" value={orden} />}
              <div className="relative flex-1">
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="Que estas buscando?"
                  autoFocus={query === ''}
                  className="w-full border rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-accent bg-white text-gray-900"
                />
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
              <button type="submit" className="bg-brand-accent text-white px-6 rounded-lg font-bold hover:bg-accent/90 transition shrink-0">Buscar</button>
            </form>
          </div>

          {true && (
            <>
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <p className="text-sm text-gray-500">
                  {loading ? 'Buscando...' : `${resultCount} resultado${resultCount !== 1 ? 's' : ''}${query ? ` para &ldquo;<strong>${query}</strong>&rdquo;` : ''}`}
                </p>
                {tieneFiltros && (
                  <button
                    type="button"
                    onClick={toggleGuardarBusqueda}
                    disabled={guardandoBusqueda}
                    className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full border transition ${
                      busquedaGuardadaId
                        ? 'bg-brand-primary text-white border-brand-primary hover:bg-brand-dark'
                        : 'bg-white text-brand-primary border-brand-primary/40 hover:border-brand-primary'
                    } ${guardandoBusqueda ? 'opacity-60' : ''}`}
                  >
                    {guardandoBusqueda ? <Loader2 size={14} className="animate-spin" /> : busquedaGuardadaId ? <BellRing size={14} /> : <Bell size={14} />}
                    {busquedaGuardadaId ? t('savedAlertOn') : t('saveAlert')}
                  </button>
                )}
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <ProductCardSkeleton key={i} />
                  ))}
                </div>
              ) : (
                productos.length === 0 ? (
                  <div className="bg-white rounded-xl p-16 text-center shadow-sm border">
                    <Search size={48} className="text-gray-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-gray-800 mb-2">{t('noResults')}</h3>
                    <p className="text-gray-500">{t('noResultsDesc')}</p>
                    {query && (
                      <p className="text-sm text-gray-500 mt-1">Prueba buscando: <button onClick={() => setParam('q', '')} className="text-brand-primary hover:underline">mostrar todos los productos</button></p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {productos.map((p) => <ProductCard key={p.id} p={p} />)}
                  </div>
                )
              )}
            </>
          )}

          {!query && !categoria && !subcategoria && !marca && !condicion && !ubicacionEstado && !ubicacionCiudad && !precioMin && !precioMax && productos.length > 0 && (
            <p className="text-sm text-gray-500 mb-4">Mostrando todos los productos ({resultCount} resultados)</p>
          )}
        </div>
      </div>
    </div>
  )
}