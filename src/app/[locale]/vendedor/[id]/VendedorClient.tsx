'use client'
import { formatPrecio } from '@/lib/precio'

import { useRouter } from 'next/navigation'
import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import BadgeVerificado from '@/components/BadgeVerificado'
import BadgeTipoVendedor from '@/components/BadgeTipoVendedor'
import Avatar from '@/components/Avatar'
import { MapPin, Phone, Mail, MessageSquare, Star, ArrowLeft, ShoppingBag } from 'lucide-react'
import SellerReputation from '@/components/SellerReputation'
import { useTranslations } from 'next-intl'
import { productUrl } from '@/lib/product-url'

interface VendedorClientProps {
  vendedor: any
  productos: any[]
  resenas: any[]
  promedio: number
}

export default function VendedorClient({
  vendedor,
  productos,
  resenas,
  promedio,
}: VendedorClientProps) {
  const t = useTranslations('seller')
  const router = useRouter()
  const vendedorId = vendedor.id

  // Métodos de contacto (genéricos del perfil, si hay)
  const tieneWhatsApp = vendedor.whatsapp_disponible && vendedor.telefono
  const tieneTelefono = vendedor.telefono_disponible && vendedor.telefono
  const tieneEmail = vendedor.email_disponible && vendedor.email_publico

  const estrellasRender = (rating: number, size = 16) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        size={size}
        className={i < Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-500'}
      />
    ))
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-6 text-sm"
      >
        <ArrowLeft size={16} /> {t('back')}
      </button>

      {/* Perfil del vendedor */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <Avatar nombre={vendedor.nombre || t('seller')} fotoUrl={vendedor.foto_perfil_url} size="xl" />

          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {vendedor.nombre || t('seller')}
              {vendedor.verificado && <BadgeVerificado size="md" />}
            </h1>

            {vendedor.tipo_vendedor && (
              <div className="mt-1">
                <BadgeTipoVendedor tipo={vendedor.tipo_vendedor} size="md" />
              </div>
            )}

            {(vendedor.ciudad || vendedor.estado) && (
              <p className="text-gray-500 text-sm flex items-center gap-1 mt-1">
                <MapPin size={14} /> {[vendedor.ciudad, vendedor.estado].filter(Boolean).join(', ')}
              </p>
            )}

            {/* Reputación */}
            <div className="mt-3">
              <SellerReputation
                nivel={vendedor.nivel_confianza || 0}
                numResenas={resenas.length}
                promedioResenas={promedio}
                numPubsActivas={productos.length}
                numPubsVendidas={vendedor.total_vendidas || 0}
                antiguedadDias={vendedor.antiguedad_dias || Math.floor((Date.now() - new Date(vendedor.creado_en).getTime()) / (1000*60*60*24))}
                ultimaActividad={vendedor.ultima_actividad}
                verificado={vendedor.verificado}
                badges={vendedor.badges_automaticos || []}
                size="md"
              />
            </div>

            {/* Contacto */}
            <div className="flex flex-wrap gap-2 mt-4">
              {tieneWhatsApp && (
                <a
                  href={`https://wa.me/${vendedor.telefono?.replace(/\s+/g, '')}`}
                  target="_blank"
                  className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition"
                >
                  💚 WhatsApp
                </a>
              )}
              {tieneTelefono && (
                <a
                  href={`tel:${vendedor.telefono}`}
                  className="flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  <Phone size={14} /> {t('call')}
                </a>
              )}
              {tieneEmail && vendedor.email_publico && (
                <a
                  href={`mailto:${vendedor.email_publico}`}
                  className="flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  <Mail size={14} /> Email
                </a>
              )}
              <button
                onClick={() => router.push(`/chat?vendedor=${vendedorId}`)}
                className="flex items-center gap-1.5 bg-brand-primary text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand-dark transition"
              >
                <MessageSquare size={14} /> {t('sendMessage')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reseñas */}
      {resenas.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
          <h2 className="font-bold text-lg flex items-center gap-2 mb-4">
            <Star size={20} className="text-yellow-400 fill-yellow-400" />
            {t('reviews')} ({resenas.length})
          </h2>
          <div className="space-y-4">
            {resenas.map(r => (
              <div key={r.id} className="border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  {estrellasRender(r.puntuacion, 14)}
                  <span className="text-xs text-gray-500 ml-auto">
                    {new Date(r.creado_en).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {r.producto?.titulo && (
                  <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">
                    📦 {r.producto.titulo}
                  </p>
                )}
                {r.comentario ? (
                  <p className="text-sm text-gray-600">{r.comentario}</p>
                ) : (
                  <p className="text-sm italic text-gray-400">{t('noComment')}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Productos del vendedor */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <ShoppingBag size={20} />
          {t('listingsBy', { name: vendedor.nombre || t('seller') })} ({productos.length})
        </h2>

        {productos.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border p-8 text-center text-gray-500">
            <ShoppingBag size={40} className="mx-auto mb-2" />
            <p>{t('noListings')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {productos.map(p => (
              <LocalLink key={p.id} href={productUrl(p)} className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition group">
                <div className="aspect-square bg-gray-100">
                  {p.imagen_url ? (
                    <Image src={p.imagen_url} alt={p.titulo} width={400} height={400} sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">{t('noPhoto')}</div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-gray-800 text-sm truncate">{p.titulo}</h3>
                  <p className="text-brand-primary font-bold mt-1">{formatPrecio(p.precio_usd || 0)}</p>
                </div>
              </LocalLink>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
