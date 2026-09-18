'use client'
import { Component, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { MapPin, Tag, MessageCircle, Phone, Mail, ChevronRight, Shield, Clock, Heart, Share2, CheckCircle2, FileCheck2, Calculator, CalendarClock } from 'lucide-react'
import Avatar from '@/components/Avatar'
import ReportarButton from '@/components/ReportarButton'
import BadgeVerificado from '@/components/BadgeVerificado'
import BadgeTipoVendedor from '@/components/BadgeTipoVendedor'
import BadgeHomologacion from '@/components/BadgeHomologacion'
import BotonReservar, { AvisoReservado } from '@/components/ReservaProducto'
import BotonInspeccion from '@/components/BotonInspeccion'
import { FileText } from 'lucide-react'
import { esHomologacionVivienda, resumenExpediente } from '@/lib/verificacion-homologacion'
import ImageGallery from '@/components/ImageGallery'
import SellerReputation from '@/components/SellerReputation'
import { resolveContactMethods } from '@/lib/contact-methods'
import { enlaceWhatsApp } from '@/lib/telefono'
import { agruparFichaTecnica, camposFichaExtras } from '@/lib/categorias'
import { formatPrecio } from '@/lib/precio'
import { useTranslations } from 'next-intl'

// Error boundary to catch render errors
class ProductErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean}> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: Error) { console.error('ProductPage error:', error) }
  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Algo salió mal</h1>
          <p className="text-gray-500 mb-6">Error al cargar el producto. Intenta recargar la página.</p>
          <LocalLink href="/" className="inline-block bg-brand-primary text-white px-8 py-3 rounded-lg font-bold">Volver al inicio</LocalLink>
        </div>
      )
    }
    return this.props.children
  }
}

export interface VerificacionHomologacion {
  estado: string
  motivo?: string | null
  documentos: { tipo: string; estado?: string | null }[]
}

export interface EstadoReserva {
  reservado: boolean
  reservado_hasta?: string | null
  reserva_propia_estado?: string | null
}

interface ProductoPageClientProps {
  initialProduct: any
  favoritosCount?: number
  verificacion?: VerificacionHomologacion | null
  reserva?: EstadoReserva | null
  /** Anuncio de demostración: se avisa y no se ofrece contacto. */
  esDemo?: boolean
}

function ProductoPageClientInner({
  initialProduct,
  favoritosCount = 0,
  verificacion = null,
  reserva = null,
  esDemo = false,
}: ProductoPageClientProps) {
  const [reservaEstado, setReservaEstado] = useState<string | null>(reserva?.reserva_propia_estado || null)
  const t = useTranslations('productDetail')
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  // URL canónica para el redirect post-login: slug si existe, UUID si no
  const slug = initialProduct?.slug || initialProduct?.id || ''
  const esNuevaPublicacion = searchParams.get('nuevo') === '1'

  // Auto-remove ?nuevo=1 from URL after showing banner
  useEffect(() => {
    if (esNuevaPublicacion && window.location.search.includes('nuevo=1')) {
      if (window.history.replaceState) {
        setTimeout(() => {
          window.history.replaceState({}, '', window.location.pathname)
        }, 5000)
      }
    }
  }, [esNuevaPublicacion])

  const [producto] = useState(initialProduct)
  const [vendedor, setVendedor] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [totalResenas, setTotalResenas] = useState(0)
  const [esFavorito, setEsFavorito] = useState(false)
  const [toggleandoFav, setToggleandoFav] = useState(false)
  const [vendedorStats, setVendedorStats] = useState<any>(null)
  const [historial, setHistorial] = useState<any[]>([])
  const [copiado, setCopiado] = useState(false)
  // Invitados: en vez de redirigir a login de golpe, se explica el paso y
  // se ofrece la alternativa inmediata (WhatsApp) — el muro mata compradores.
  const [pedirCuenta, setPedirCuenta] = useState(false)

  useEffect(() => {
    if (!producto) return
    async function loadAll() {
      // Single RPC call: consolidates 6 queries into 1 round-trip
      const { data: detalle, error } = await supabase.rpc('obtener_detalle_producto', {
        p_producto_id: producto.id,
        p_user_id: user?.id || null,
      })

      if (!error && detalle) {
        if (detalle.vendedor) setVendedor(detalle.vendedor)
        if (detalle.stats) {
          const anti = producto.user_id
            ? Math.floor((Date.now() - new Date(producto.creado_en).getTime()) / (1000 * 60 * 60 * 24))
            : 0
          setVendedorStats({ ...detalle.stats, antiguedad: anti })
        }
        if (detalle.totalResenas != null) setTotalResenas(detalle.totalResenas)
        if (detalle.esFavorito != null) setEsFavorito(detalle.esFavorito)
        if (detalle.historial) setHistorial(detalle.historial)
      }

      // Fire and forget: el RPC incrementa solo visitas de forma atómica.
      // No se usa UPDATE directo porque los visitantes no son dueños del
      // producto y no deben poder modificar otras columnas.
      supabase.rpc('incrementar_visitas', { p_producto_id: producto.id }).then()

      setLoading(false)
    }
    loadAll()
  }, [producto, user])

  const handleContacto = () => {
    if (authLoading) return
    if (!user) { setPedirCuenta(true); return }
    router.push(`/chat?producto_id=${producto.id}&vendedor_id=${producto.user_id}`)
  }

  // Compartir (momento pico: banner de "publicado con éxito")
  const anuncioUrl = () => (typeof window !== 'undefined' ? window.location.href : '')

  const handleShareWhatsapp = () => {
    const texto = `${producto.titulo} — ${anuncioUrl()}`
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer')
  }

  const handleCopiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(anuncioUrl())
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      // clipboard no disponible (http, permiso denegado) — silencioso
    }
  }

  const toggleFavorito = async () => {
    if (authLoading) return
    if (!user) { router.push(`/login?redirect=/producto/${slug}`); return }
    if (toggleandoFav) return
    setToggleandoFav(true)
    try {
      const res = await fetch('/api/favorito/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          productId: producto.id,
          isFavorited: esFavorito, // true = remove, false = add
          productoTitle: producto.titulo,
        }),
      })
      const data = await res.json()
      if (data.action === 'removed') setEsFavorito(false)
      else if (data.action === 'added') setEsFavorito(true)
    } catch (e) {
      // Fallback to direct supabase if API fails
      if (esFavorito) {
        await supabase.from('favoritos').delete().eq('user_id', user.id).eq('producto_id', producto.id)
        setEsFavorito(false)
      } else {
        await supabase.from('favoritos').insert({ user_id: user.id, producto_id: producto.id })
        setEsFavorito(true)
      }
    }
    setToggleandoFav(false)
  }

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 py-12 animate-pulse space-y-4">
      <div className="h-6 bg-gray-200 rounded w-48" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4"><div className="aspect-square bg-gray-200 rounded-2xl" /><div className="h-8 bg-gray-200 rounded w-3/4" /><div className="h-32 bg-gray-200 rounded" /></div>
        <div className="bg-gray-200 rounded-2xl h-96" />
      </div>
    </div>
  )

  if (!producto) return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">{t('notFound')}</h1>
      <LocalLink href="/" className="inline-block bg-brand-primary text-white px-8 py-3 rounded-lg font-bold">{t('backHome')}</LocalLink>
    </div>
  )



  // En los anuncios de demostración no hay nadie al otro lado: ni teléfono,
  // ni WhatsApp, ni email. Los números de la semilla eran inventados (y en
  // España pertenecen a personas reales), así que no se muestran nunca.
  const contactos = esDemo
    ? { hasProductConfiguration: true, phone: '', whatsapp: '', email: '', messengerUrl: '' }
    : resolveContactMethods(producto.metodos_contacto, vendedor?.telefono || '')
  const contactPhone = contactos.phone
  // WhatsApp y teléfono pueden ser números distintos. No usar el teléfono
  // como preferencia cuando el anunciante configuró expresamente WhatsApp.
  const whatsappPhone = contactos.whatsapp || (!contactos.hasProductConfiguration ? contactPhone : '')
  const metodos = {
    chat: true,
    // Publicaciones antiguas sin contacto específico conservan el fallback
    // telefónico visible del perfil. Las nuevas solo muestran lo configurado.
    whatsapp: Boolean(whatsappPhone),
    telefono: contactos.hasProductConfiguration ? Boolean(contactos.phone) : false,
    email: Boolean(contactos.email),
    messenger: Boolean(contactos.messengerUrl),
  }
  const imagenes = producto.imagenes && producto.imagenes.length > 0 ? producto.imagenes : producto.imagen_url ? [producto.imagen_url] : []
  // Enlace construido con el helper compartido: antes anteponía el prefijo de
  // Venezuela ('58') y todos los móviles españoles quedaban en un número
  // inexistente, así que el botón de WhatsApp no funcionaba.
  const whatsappLink = enlaceWhatsApp(whatsappPhone, t('whatsappMsg', { title: producto.titulo }))

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {producto.vendido && (
        <div className="mb-6 bg-gray-100 border-2 border-gray-300 rounded-2xl p-5 animate-fadeIn">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 bg-gray-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 size={22} className="text-white" />
            </span>
            <div>
              <h3 className="font-bold text-gray-800 text-lg">{t('soldBannerTitle')}</h3>
              <p className="text-gray-600 text-sm mt-1">{t('soldBannerDesc')}</p>
            </div>
          </div>
        </div>
      )}
      {esDemo && (
        <div className="mb-6 bg-amber-50 border-2 border-amber-300 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none" aria-hidden="true">🧪</span>
            <div>
              <h2 className="font-bold text-amber-900 text-lg">{t('demoBannerTitle')}</h2>
              <p className="text-amber-800 text-sm mt-1">{t('demoBannerDesc')}</p>
            </div>
          </div>
        </div>
      )}
      {esNuevaPublicacion && (
        <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-2xl p-5 animate-fadeIn">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
            <div className="min-w-0">
              <h3 className="font-bold text-green-800 text-lg">{t('successTitle')}</h3>
              <p className="text-green-700 text-sm mt-1">{t('successDesc')}</p>
              <p className="text-green-600 text-xs mt-2 font-bold">{t('successFree')}</p>
              {/* Siguiente paso natural tras publicar: subir la documentación
                  del vehículo y conseguir el sello de homologación verificada. */}
              <LocalLink
                href={`/producto/editar/${producto.id}#expediente`}
                className="inline-flex items-center gap-2 mt-3 bg-brand-primary text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-brand-dark transition"
              >
                {t('expedienteCta')}
              </LocalLink>
              {/* Pico de dopamina del vendedor: compartir = tráfico gratis de SU red */}
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleShareWhatsapp}
                  className="inline-flex items-center gap-1.5 bg-[#25D366] text-white text-xs font-bold px-3 py-2 rounded-lg hover:brightness-95 transition"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  {t('shareWhatsapp')}
                </button>
                <button
                  type="button"
                  onClick={handleCopiarEnlace}
                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border transition ${
                    copiado
                      ? 'bg-green-100 border-green-400 text-green-800'
                      : 'bg-white border-green-300 text-green-800 hover:bg-green-50'
                  }`}
                >
                  <Share2 size={14} />
                  {copiado ? t('copied') : t('copyLink')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-6 overflow-x-auto hide-scrollbar">
        <LocalLink href="/" className="hover:text-brand-primary flex-shrink-0">{t('breadcrumbHome')}</LocalLink>
        <ChevronRight size={14} className="flex-shrink-0" />
        <LocalLink href="/catalogo" className="hover:text-brand-primary flex-shrink-0">{t('breadcrumbCatalog')}</LocalLink>
        {producto.subcategoria && (<><ChevronRight size={14} className="flex-shrink-0" /><span className="capitalize flex-shrink-0">{producto.subcategoria}</span></>)}
        <ChevronRight size={14} className="flex-shrink-0" />
        <span className="text-gray-800 font-medium truncate flex-shrink-0">{producto.titulo}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {imagenes.length > 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden"><ImageGallery images={imagenes} alt={producto.titulo} /></div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="aspect-square md:aspect-[16/10] bg-gray-100 flex items-center justify-center"><Tag size={48} className="text-gray-500" /></div>
            </div>
          )}
          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-3">{producto.titulo}</h1>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="badge-trust">{producto.estado}</span>
              {producto.marca && <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm">{producto.marca}</span>}
              {producto.subcategoria && <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm capitalize">{producto.subcategoria}</span>}
              {verificacion && verificacion.estado === 'verificada' && (
                <BadgeHomologacion estado={verificacion.estado} size="md" />
              )}
              {(reserva?.reservado || reservaEstado === 'activa') && (
                <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-sm font-semibold">
                  <CalendarClock size={14} aria-hidden="true" /> {t('reservadoBadge')}
                </span>
              )}
            </div>
            {producto.descripcion && <p className="text-gray-600 whitespace-pre-line leading-relaxed">{producto.descripcion}</p>}

            {/* Ficha técnica camper: bloques "Mecánica del Vehículo",
                "Habitabilidad" y "Equipamiento Camper y Autonomía" */}
            {(() => {
              const grupos = agruparFichaTecnica(producto.especificaciones)
              const extras = camposFichaExtras(producto.especificaciones)
              if (grupos.length === 0 && extras.length === 0) return null
              return (
                <div className="mt-6 space-y-6">
                  {grupos.map(grupo => (
                    <div key={grupo.titulo} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                      <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span aria-hidden="true">{grupo.icon}</span> {grupo.titulo}
                      </h3>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {grupo.filas.map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-3 text-sm py-1 border-b border-gray-100 last:border-0 sm:last:border-b">
                            <dt className="text-gray-500 shrink-0">{k}</dt>
                            <dd className="font-semibold text-gray-900 text-right break-words">{String(v)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                  {extras.length > 0 && (
                    <div className="rounded-xl border border-gray-100 p-4">
                      <h3 className="font-bold text-gray-900 mb-3">📋 {t('specsTitle')}</h3>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {extras.map(([k, v]) => (
                          <div key={k} className="flex justify-between gap-3 text-sm py-1">
                            <dt className="text-gray-500 shrink-0">{k}</dt>
                            <dd className="font-medium text-gray-900 text-right break-words">{String(v)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6">
            <h3 className="font-bold text-brand-primary mb-3 flex items-center gap-2"><Shield size={18} /> {t('buySafe')}</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800">
              <li>{t('safeTip1')}</li>
              <li>{t('safeTip2')}</li>
              <li>{t('safeTip3')}</li>
              <li>{t('safeTip4')}</li>
            </ul>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-2xl shadow-sm border p-6 sticky top-20">
            <p className="text-4xl font-black text-brand-primary">{formatPrecio(producto.precio_usd || 0)}</p>
            <div className="flex items-center gap-4 text-xs text-gray-500 my-4 pb-4 border-b flex-wrap">
              <span className="flex items-center gap-1"><Clock size={14} /> {t('published')}</span>
              <span className="flex items-center gap-1">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx={12} cy={12} r={3} /></svg>
                {producto.visitas || 0} {t('views')}
              </span>
              {favoritosCount > 0 && (
                <span className="flex items-center gap-1 text-brand-primary font-semibold">
                  <Heart size={14} /> {t('savedCount', { count: favoritosCount })}
                </span>
              )}
            </div>

            {historial.length > 0 && (
              <div className="mb-4 bg-gray-50 rounded-xl p-3">
                <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">📈 {t('priceHistory')}</p>
                <div className="space-y-1.5">
                  {historial.slice(0, 3).map((h: any) => {
                    const pct = ((h.precio_nuevo - h.precio_anterior) / h.precio_anterior * 100).toFixed(0)
                    const subio = Number(pct) > 0
                    return (
                      <div key={h.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{new Intl.DateTimeFormat('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(h.creado_en))}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500 line-through">{formatPrecio(h.precio_anterior)}</span>
                          <span className="font-bold text-brand-primary">{formatPrecio(h.precio_nuevo)}</span>
                          <span className={`px-1 rounded font-bold ${subio ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>↓${Math.abs(Number(pct))}%</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Expediente del vehículo: qué documentación ha revisado el
                equipo. Solo se muestra cuando hay algo que contar (verificada
                o en revisión); un anuncio sin expediente no se castiga. */}
            {verificacion && verificacion.estado !== 'sin_verificar' && verificacion.estado !== 'rechazada' && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
                <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <FileCheck2 size={18} className="text-brand-accent" aria-hidden="true" />
                  {t('expedienteTitle')}
                </h3>
                <BadgeHomologacion estado={verificacion.estado} size="md" />
                <p className="text-sm text-gray-600 mt-2">
                  {verificacion.estado === 'verificada' ? t('expedienteIntroVerificada') : t('expedienteIntroPendiente')}
                </p>
                {verificacion.estado === 'verificada' && verificacion.documentos.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {resumenExpediente(producto.especificaciones, verificacion.documentos)
                      .items.filter(item => item.presente)
                      .map(item => (
                        <li key={item.tipo} className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckCircle2 size={15} className="text-brand-accent flex-shrink-0" aria-hidden="true" />
                          {item.label}
                        </li>
                      ))}
                  </ul>
                )}
                {verificacion.estado === 'pendiente' && esHomologacionVivienda(producto.especificaciones) && (
                  <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {t('expedienteAvisoVivienda')}
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500">{t('expedienteNotaComprador')}</p>
              </div>
            )}

            {/* Reserva con señal: el comprador solicita, el vendedor confirma la
                señal al recibirla y entonces el anuncio queda reservado. */}
            {!producto.vendido && !esDemo && (
              <BotonReservar
                producto={producto}
                userId={user?.id || null}
                reservadoInicial={!!reserva?.reservado}
                reservadoHastaInicial={reserva?.reservado_hasta || null}
                onEstadoReserva={setReservaEstado}
              />
            )}

            {/* Inspección precompra (§4.1): el CTA existía pero no se
                renderizaba en ninguna parte, así que el comprador no podía
                pedirla. Va justo debajo de la reserva (no son excluyentes) y
                nunca en anuncios de demostración, donde no hay coche real. */}
            {!producto.vendido && !esDemo && (
              <BotonInspeccion
                producto={producto}
                userId={user?.id || null}
                reservado={!!reserva?.reservado || reservaEstado === 'confirmada'}
              />
            )}

            {/* Utilidad de compra: el ITP es el coste que más sorprende, y
                depende de la comunidad del comprador. Va con el precio puesto. */}
            {!producto.vendido && Number(producto.precio_usd) > 0 && (
              <LocalLink
                href={`/calcular-itp?precio=${Math.round(Number(producto.precio_usd))}`}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3.5 mb-5 hover:border-brand-accent transition group"
              >
                <span className="w-9 h-9 rounded-full bg-brand-accent/10 text-brand-accent-dark flex items-center justify-center flex-shrink-0">
                  <Calculator size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-gray-900 group-hover:text-brand-primary">
                    {t('itpCtaTitulo')}
                  </span>
                  <span className="block text-xs text-gray-500">{t('itpCtaDesc')}</span>
                </span>
                <ChevronRight size={16} className="ml-auto text-gray-400 flex-shrink-0" aria-hidden="true" />
              </LocalLink>
            )}

            {/* Contrato de compraventa: utilidad pública (también tras venderse),
                precargada con los datos del anuncio. El siguiente paso natural
                de cualquier operación cerrada desde la ficha. */}
            <LocalLink
              href={`/contrato-compraventa?producto=${slug}`}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3.5 mb-5 hover:border-brand-primary transition group"
            >
              <span className="w-9 h-9 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center flex-shrink-0">
                <FileText size={17} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-gray-900 group-hover:text-brand-primary">
                  {t('contratoCtaTitulo')}
                </span>
                <span className="block text-xs text-gray-500">{t('contratoCtaDesc')}</span>
              </span>
              <ChevronRight size={16} className="ml-auto text-gray-400 flex-shrink-0" aria-hidden="true" />
            </LocalLink>

            {vendedor && (
              <div className="bg-gray-50 rounded-xl p-4 mb-5">
                <LocalLink href={`/vendedor/${vendedor.id}`} className="flex items-center gap-3 hover:bg-gray-100 rounded-xl p-1 -m-1 transition">
                  <Avatar nombre={vendedor.nombre || 'Vendedor'} fotoUrl={vendedor.foto_perfil_url} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{vendedor.nombre || 'Vendedor'}</p>
                      {vendedor.verificado && <BadgeVerificado size="sm" />}
                    </div>
                    <span className="inline-block mt-1">
                      <BadgeTipoVendedor tipo={vendedor.tipo_vendedor} />
                    </span>
                    {vendedor.ciudad && <p className="text-xs text-gray-500 mt-1">{vendedor.ciudad}{vendedor.estado ? `, ${vendedor.estado}` : ''}</p>}
                  </div>
                </LocalLink>
                {vendedorStats && (
                  <div className="mt-2 ml-0">
                    <SellerReputation nivel={vendedor.nivel_confianza || 0} numResenas={vendedorStats.resenasCount} promedioResenas={vendedorStats.resenasAvg} numPubsActivas={vendedorStats.activas} numPubsVendidas={vendedorStats.vendidas} verificado={vendedor.verificado} badges={vendedor.badges_automaticos || []} antiguedadDias={vendedorStats.antiguedad || 0} ultimaActividad={vendedor.ultima_actividad || null} size="sm" />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              {!producto.vendido && (
              <>
              <div className="grid grid-cols-2 gap-2">
                {metodos.chat && (
                  <button onClick={handleContacto} className="bg-brand-primary text-white py-3 rounded-xl font-bold hover:bg-brand-dark transition flex items-center justify-center gap-2 text-sm">
                    <MessageCircle size={18} /> {t('chat')}
                  </button>
                )}
                {metodos.whatsapp && whatsappLink && (
                  <a href={whatsappLink} target="_blank" className="bg-[#25D366] text-white py-3 rounded-xl font-bold hover:brightness-90 transition flex items-center justify-center gap-2 text-sm">
                    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                    WhatsApp
                  </a>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {metodos.telefono && contactPhone && (
                  <a href={`tel:${contactPhone}`} className="border py-3 rounded-xl font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2 text-sm"><Phone size={16} /> {t('call')}</a>
                )}
                {metodos.email && (
                  <a href={`mailto:${contactos.email}`} className="border py-3 rounded-xl font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2 text-sm"><Mail size={16} /> Email</a>
                )}
                {metodos.messenger && (
                  <a href={contactos.messengerUrl} target="_blank" rel="noopener noreferrer" className="border py-3 rounded-xl font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2 text-sm"><MessageCircle size={16} /> Messenger</a>
                )}
              </div>
              </>
              )}
            </div>

            {pedirCuenta && !user && (
              <div className="mt-4 bg-brand-primary/5 border border-brand-primary/20 rounded-xl p-4 animate-fadeIn">
                <p className="text-sm font-semibold text-gray-900">{t('guestNudgeTitle')}</p>
                <p className="text-xs text-gray-600 mt-1 mb-3">{t('guestNudgeDesc')}</p>
                <div className="flex flex-wrap gap-2">
                  <LocalLink
                    href={`/register?redirect=/producto/${slug}`}
                    onClick={() => setPedirCuenta(false)}
                    className="bg-brand-primary text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-brand-dark transition"
                  >
                    {t('guestNudgeCreate')}
                  </LocalLink>
                  <LocalLink
                    href={`/login?redirect=/producto/${slug}`}
                    onClick={() => setPedirCuenta(false)}
                    className="border border-gray-300 text-gray-700 text-xs font-bold px-4 py-2 rounded-lg hover:bg-gray-50 transition"
                  >
                    {t('guestNudgeLogin')}
                  </LocalLink>
                  {metodos.whatsapp && whatsappLink && (
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setPedirCuenta(false)}
                      className="text-[#128C4A] text-xs font-bold px-2 py-2 hover:underline"
                    >
                      {t('guestNudgeWhatsapp')} →
                    </a>
                  )}
                </div>
              </div>
            )}

            {(producto.ubicacion_ciudad || producto.ubicacion_estado) && (
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-4 pt-4 border-t">
                <MapPin size={16} /> {producto.ubicacion_ciudad}{producto.ubicacion_ciudad && producto.ubicacion_estado ? ', ' : ''}{producto.ubicacion_estado}
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <button onClick={toggleFavorito} disabled={toggleandoFav} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-sm font-medium transition ${esFavorito ? 'border-red-200 bg-red-50 text-red-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <Heart size={16} className={esFavorito ? 'fill-red-600' : ''} />{esFavorito ? t('saved') : t('save')}
              </button>
              <button onClick={() => navigator.share?.({ title: producto.titulo, url: window.location.href })} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                <Share2 size={16} /> {t('shareBtn')}
              </button>
              <ReportarButton productoId={producto.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProductoPageClient(props: ProductoPageClientProps) {
  return (
    <ProductErrorBoundary>
      <ProductoPageClientInner {...props} />
    </ProductErrorBoundary>
  )
}
