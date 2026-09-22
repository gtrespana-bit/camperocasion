'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import LocalLink from '@/components/LocalLink'
import ProductCard, { type ProductCardData } from '@/components/ProductCard'
import BadgeVerificado from '@/components/BadgeVerificado'
import BadgeTipoVendedor from '@/components/BadgeTipoVendedor'
import { getPrecioEur, formatPrecio } from '@/lib/precio'
import {
  Globe, MapPin, Clock, Star, Store, Share2, Check, Search,
} from 'lucide-react'

interface Perfil {
  id: string
  slug: string
  nombre: string | null
  descripcion: string | null
  web: string | null
  portada_url: string | null
  horario: string | null
  direccion: string | null
  ciudad: string | null
  estado: string | null
  verificado: boolean | null
  foto_perfil_url: string | null
  tipo_vendedor: string | null
  creado_en: string | null
}

export default function TiendaClient({
  perfil,
  productos,
  totalResenas,
  promedio,
}: {
  perfil: Perfil
  productos: any[]
  totalResenas: number
  promedio: number
}) {
  const [busqueda, setBusqueda] = useState('')
  const [copiado, setCopiado] = useState(false)

  const ubicacion = [perfil.ciudad, perfil.estado].filter(Boolean).join(', ')
  const esCamperizador = perfil.tipo_vendedor === 'camperizador'

  // Rango de precios: al comprador le dice de un vistazo si esta tienda juega
  // en su presupuesto antes de recorrer 40 anuncios.
  const { minimo, maximo } = useMemo(() => {
    const precios = productos.map(getPrecioEur).filter(p => p > 0)
    if (precios.length === 0) return { minimo: 0, maximo: 0 }
    return { minimo: Math.min(...precios), maximo: Math.max(...precios) }
  }, [productos])

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return productos
    return productos.filter(p => (p.titulo || '').toLowerCase().includes(q))
  }, [productos, busqueda])

  const anoAlta = perfil.creado_en ? new Date(perfil.creado_en).getFullYear() : null

  const compartir = async () => {
    const url = `https://camperocasion.online/tienda/${perfil.slug}`
    try {
      if (navigator.share) {
        await navigator.share({ title: perfil.nombre || 'Tienda', url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* el usuario canceló: no es un error */
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Portada */}
      <div className="relative h-40 md:h-60 bg-gradient-to-br from-brand-primary to-brand-dark">
        {perfil.portada_url && (
          <Image
            src={perfil.portada_url}
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4">
        {/* Cabecera */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 -mt-12 md:-mt-16 relative p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-start gap-5">
            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-100 border-4 border-white shadow-md shrink-0 -mt-16 md:-mt-20">
              {perfil.foto_perfil_url ? (
                <Image
                  src={perfil.foto_perfil_url}
                  alt={perfil.nombre || 'Logo'}
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full grid place-items-center text-gray-400">
                  <Store size={32} />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl md:text-3xl font-black text-gray-900">
                  {perfil.nombre || 'Tienda'}
                </h1>
                {perfil.verificado && <BadgeVerificado size="md" />}
                <BadgeTipoVendedor tipo={perfil.tipo_vendedor} size="md" />
              </div>

              <p className="text-sm text-gray-500 mb-3">
                {esCamperizador ? 'Taller de camperización' : 'Vendedor profesional'}
                {anoAlta ? ` · En CamperOcasión desde ${anoAlta}` : ''}
              </p>

              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600">
                {ubicacion && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={15} className="text-brand-accent" />
                    {perfil.direccion ? `${perfil.direccion}, ${ubicacion}` : ubicacion}
                  </span>
                )}
                {perfil.horario && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock size={15} className="text-brand-accent" />
                    {perfil.horario}
                  </span>
                )}
                {perfil.web && (
                  <a
                    href={perfil.web}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1.5 text-brand-primary hover:underline font-medium"
                  >
                    <Globe size={15} />
                    Web oficial
                  </a>
                )}
                {totalResenas > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Star size={15} className="text-amber-500 fill-amber-500" />
                    <strong>{promedio}</strong>
                    <span className="text-gray-400">
                      ({totalResenas} {totalResenas === 1 ? 'reseña' : 'reseñas'})
                    </span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex md:flex-col gap-2 shrink-0">
              <button
                onClick={compartir}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                {copiado ? <Check size={16} className="text-brand-accent" /> : <Share2 size={16} />}
                {copiado ? 'Enlace copiado' : 'Compartir'}
              </button>
              <LocalLink
                href={`/vendedor/${perfil.id}`}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-brand-dark transition"
              >
                Contactar
              </LocalLink>
            </div>
          </div>

          {perfil.descripcion && (
            <p className="text-gray-700 mt-5 pt-5 border-t border-gray-100 whitespace-pre-line leading-relaxed">
              {perfil.descripcion}
            </p>
          )}
        </div>

        {/* Resumen del stock */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Dato valor={String(productos.length)} etiqueta={productos.length === 1 ? 'vehículo en stock' : 'vehículos en stock'} />
          {minimo > 0 && <Dato valor={formatPrecio(minimo)} etiqueta="desde" />}
          {maximo > 0 && <Dato valor={formatPrecio(maximo)} etiqueta="hasta" />}
          {totalResenas > 0 && <Dato valor={`${promedio}★`} etiqueta={`${totalResenas} valoraciones`} />}
        </div>

        {/* Stock */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <h2 className="text-xl font-bold text-gray-900">
            Stock de {perfil.nombre || 'la tienda'}
          </h2>
          {productos.length > 4 && (
            <div className="relative sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar en este stock…"
                aria-label="Buscar en el stock de la tienda"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
              />
            </div>
          )}
        </div>

        {filtrados.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center mb-12">
            <Store size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">
              {productos.length === 0
                ? 'Esta tienda todavía no tiene vehículos publicados.'
                : 'Ningún vehículo coincide con tu búsqueda.'}
            </p>
            {productos.length > 0 && (
              <button onClick={() => setBusqueda('')} className="text-brand-primary font-semibold text-sm mt-2 hover:underline">
                Ver todo el stock
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12">
            {filtrados.map((p: ProductCardData) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Dato({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
      <p className="text-2xl font-black text-gray-900">{valor}</p>
      <p className="text-xs text-gray-500 mt-0.5">{etiqueta}</p>
    </div>
  )
}
