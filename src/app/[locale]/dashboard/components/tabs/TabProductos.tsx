"use client"
import { formatPrecio } from '@/lib/precio'

import { useState } from 'react'
import LocalLink from '@/components/LocalLink'
import { Package, X, Pause, Play, Edit, Zap, Star, CheckCircle2, ChevronDown, ArrowLeft, Send, RefreshCw } from 'lucide-react'
import { productUrl } from '@/lib/product-url'
import { boostVigente } from '@/lib/catalog-consulta'
import Image from 'next/image'

export default function TabProductos({
  productos,
  onBoost,
  onDestacar,
  userId,
}: {
  productos: any[]
  onBoost: (m: { productId: string; titulo: string }) => void
  onDestacar: (m: { productId: string; titulo: string }) => void
  userId: string
}) {
  // Media de visitas de los anuncios vivos del vendedor. Es la referencia que
  // convierte «12 vistas» (un dato sin sentido) en «un 60 % menos que tus
  // otros anuncios» (un motivo para actuar).
  const mediaVisitas = (() => {
    const vivos = (productos || []).filter((p: any) => p.activo && !p.vendido)
    if (vivos.length < 2) return null
    const total = vivos.reduce((s: number, p: any) => s + (p.visitas || 0), 0)
    return total / vivos.length
  })()

  const [vendidoModal, setVendidoModal] = useState<string | null>(null)
  const [vendidoPaso, setVendidoPaso] = useState<'tipo' | 'comprador' | 'reseña' | 'confirmado'>('tipo')
  const [interesados, setInteresados] = useState<any[]>([])
  const [compradorInfo, setCompradorInfo] = useState<{ id: string; nombre: string } | null>(null)
  const [cargandoVendidos, setCargandoVendidos] = useState(false)
  const [enviandoResena, setEnviandoResena] = useState(false)
  const [rating, setRating] = useState(5)
  const [comentarioResena, setComentarioResena] = useState('')

  // Gestión de menús desplegables
  const [menuGestion, setMenuGestion] = useState<string | null>(null)
  const [menuPromocionar, setMenuPromocionar] = useState<string | null>(null)

  const cerrarMenus = () => { setMenuGestion(null); setMenuPromocionar(null) }

  // Abrir modal de vendido
  const abrirVendido = async (productoId: string) => {
    cerrarMenus()
    setVendidoModal(productoId)
    setVendidoPaso('tipo')
    setCompradorInfo(null)
    setInteresados([])
    setRating(5)
    setComentarioResena('')

    if (!userId) return
    setCargandoVendidos(true)
    try {
      const res = await fetch(`/api/admin/marcar-vendido?productoId=${productoId}&userId=${userId}`)
      const data = await res.json()
      if (data.ok && data.interesados) setInteresados(data.interesados)
    } catch {
      // fail silently
    }
    setCargandoVendidos(false)
  }

  // Reactivar vendido
  const reactivarVendido = async (productoId: string) => {
    cerrarMenus()
    if (!confirm('¿Reactivar esta publicacion como no vendida?')) return
    const res = await fetch('/api/productos/reactivar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productoId }),
    })
    if (!res.ok) {
      const result = await res.json().catch(() => ({}))
      alert('Error: ' + (result.error || 'no se pudo reactivar'))
      return
    }
    window.location.reload()
  }

  // Marcar como vendido (simple — sin comprador, sin reseña)
  const marcarVendidoSimple = async (productoId: string, vendidoEn: string) => {
    const res = await fetch('/api/admin/marcar-vendido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productoId, userId, vendidoEn }),
    })
    if (!res.ok) {
      const d = await res.json()
      alert('Error: ' + d.error)
      return
    }
    setVendidoPaso('confirmado')
  }

  // Seleccionar comprador → ir a "¿quieres dejar reseña?"
  const seleccionarComprador = (comprador: { userId: string; nombre: string }) => {
    setCompradorInfo({ id: comprador.userId, nombre: comprador.nombre })
    setVendidoPaso('reseña')
  }

  // Marcar vendido con comprador pero SIN reseña
  const venderSinResena = async () => {
    if (!vendidoModal || !compradorInfo) return
    cerrarMenus()

    const res = await fetch('/api/admin/marcar-vendido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productoId: vendidoModal,
        userId,
        vendidoEn: 'plataforma',
        compradorId: compradorInfo.id,
      }),
    })

    if (!res.ok) {
      const d = await res.json()
      alert('Error: ' + d.error)
      return
    }

    // Enviar mensaje de chat al comprador notificando y invitando a reseñar
    await enviarMensajeComprador(compradorInfo.id)

    setVendidoPaso('confirmado')
  }

  // Enviar reseña al comprador (primero marca vendido, luego notifica)
  const enviarResena = async () => {
    if (!vendidoModal || !compradorInfo) return
    setEnviandoResena(true)
    cerrarMenus()

    // Primero marcar como vendido con comprador
    const res1 = await fetch('/api/admin/marcar-vendido', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productoId: vendidoModal,
        userId,
        vendidoEn: 'plataforma',
        compradorId: compradorInfo.id,
      }),
    })

    if (!res1.ok) {
      const d = await res1.json()
      setEnviandoResena(false)
      alert('Error al marcar vendido: ' + d.error)
      return
    }

    // Ahora enviar la reseña
    const res2 = await fetch('/api/admin/enviar-resena', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        producto_id: vendidoModal,
        evaluador_id: userId,
        evaluado_id: compradorInfo.id,
        puntuacion: rating,
        comentario: comentarioResena.trim() || null,
      }),
    })

    setEnviandoResena(false)

    const data2 = await res2.json()
    if (!res2.ok) {
      console.warn('Reseña falló:', data2.error)
    }

    // Enviar mensaje de chat al comprador
    await enviarMensajeComprador(compradorInfo.id)

    setVendidoPaso('confirmado')
  }

  // Enviar mensaje directo al comprador del chat de este producto
  const enviarMensajeComprador = async (compradorId: string) => {
    if (!vendidoModal) return
    try {
      const convResponse = await fetch('/api/crear-conversacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendedorId: userId, otroUsuarioId: compradorId, productoId: vendidoModal }),
      })
      const conv = await convResponse.json().catch(() => ({}))
      if (!convResponse.ok || !conv.id) return

      await fetch('/api/enviar-mensaje', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversacion_id: conv.id,
          destinatario_id: compradorId,
          contenido: '✅ ¡Tu compra fue exitosa! El vendedor ha confirmado la venta. ¿Cómo fue tu experiencia? Déjale una reseña para ayudar a la comunidad. ⭐',
        }),
      })
    } catch {
      // La venta ya está guardada; la notificación es secundaria.
    }
  }

  const pausarActivar = async (id: string, activoActual: boolean) => {
    cerrarMenus()
    const res = await fetch('/api/productos/editar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: id, activo: !activoActual }),
    })

    if (!res.ok) {
      const result = await res.json().catch(() => ({}))
      alert('Error: ' + (result.error || 'No se pudo actualizar la publicación'))
      return
    }

    window.location.reload()
  }

  // Renovar (gratis, cada 7 días): el anuncio reaparece como "recién publicado"
  const renovarProducto = async (id: string) => {
    cerrarMenus()
    const res = await fetch('/api/productos/renovar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: id }),
    })
    const result = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert('Error: ' + (result.error || 'No se pudo renovar la publicación'))
      return
    }
    window.location.reload()
  }

  const eliminarProducto = async (id: string) => {
    cerrarMenus()
    if (!confirm('¿Eliminar esta publicación permanentemente? Esta acción no se puede deshacer y se borrarán también las fotos.')) return
    const res = await fetch('/api/admin/eliminar-producto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: id }),
    })
    const result = await res.json()
    if (!res.ok) {
      alert('Error: ' + (result.error || 'no se pudo eliminar'))
      return
    }
    // Recargar la página
    window.location.reload()
  }

  if (productos.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <Package size={48} className="text-gray-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-800 mb-2">Aún no tienes publicaciones</h3>
        <p className="text-gray-500 mb-6">Publica tu primer producto en segundos. ¡Es gratis!</p>
        <LocalLink href="/publicar" className="inline-block bg-brand-accent text-white px-8 py-3 rounded-lg font-bold hover:bg-accent/90 transition">Publicar ahora</LocalLink>
      </div>
    )
  }

  const now = new Date().toISOString()
  const nowTs = Date.now()

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-bold text-lg mb-4">Mis publicaciones</h3>
      </div>
      <div className="space-y-3">
        {productos.map((p) => {
          const isBoosted = boostVigente(p.boosteado_en)
          const isFeatured = p.destacado && p.destacado_hasta && p.destacado_hasta > now
          const isVendido = p.vendido === true
          const gestionAbierto = menuGestion === p.id
          const promoAbierto = menuPromocionar === p.id
          return (
            <div key={p.id} className={`group flex items-start gap-4 p-3 rounded-lg border border-gray-100 transition ${isVendido ? 'bg-green-50/50 border-green-200' : 'hover:bg-gray-50'}`}>
              <LocalLink href={productUrl(p)} className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden relative">
                  {p.imagen_url ? (
                    <Image src={p.imagen_url} alt={p.titulo} className="w-full h-full object-cover" fill sizes="100px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">Sin foto</div>
                  )}
                  {isVendido && (
                    <div className="absolute inset-0 bg-green-600/70 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">VENDIDO</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-800 truncate group-hover:text-brand-primary transition">
                    {isBoosted && '⚡ '}{isFeatured && !isBoosted && '⭐ '}{p.titulo}
                  </h4>
                  <p className="text-sm text-brand-primary font-bold">{formatPrecio(p.precio_usd || 0)}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>👀 {p.visitas || 0} vistas</span>
                    {mediaVisitas != null && mediaVisitas > 0 && !isVendido && p.activo && (() => {
                      const dif = Math.round((((p.visitas || 0) - mediaVisitas) / mediaVisitas) * 100)
                      // Solo se comenta cuando la diferencia es relevante: un
                      // ±10 % es ruido y restaría credibilidad al aviso.
                      if (Math.abs(dif) < 25) return null
                      return (
                        <span className={dif < 0 ? 'text-amber-700 font-semibold' : 'text-green-700 font-semibold'}>
                          {dif < 0 ? `${Math.abs(dif)} % menos que tu media` : `${dif} % más que tu media`}
                        </span>
                      )
                    })()}
                    {isVendido
                      ? <span className="text-green-700 font-semibold">✅ Vendido</span>
                      : p.activo
                        ? '✅ Activo'
                        : '⏸️ Pausado'
                    }
                    {isFeatured && (
                      <span className="text-brand-primary">⭐ Hasta {new Date(p.destacado_hasta).toLocaleDateString('es-ES')}</span>
                    )}
                  </div>
                </div>
              </LocalLink>

              {/* Menús desplegables */}
              <div className="flex gap-2 flex-shrink-0 relative" onClick={e => e.stopPropagation()}>
                {/* GESTIONAR */}
                <div className="relative">
                  <button
                    onClick={() => { cerrarMenus(); setMenuGestion(gestionAbierto ? null : p.id) }}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 flex items-center gap-1"
                  >
                    Gestionar <ChevronDown size={12} />
                  </button>
                  {gestionAbierto && (
                    <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 w-48 z-20">
                      <LocalLink
                        href={`/producto/editar/${p.id}`}
                        onClick={cerrarMenus}
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        <Edit size={14} /> Editar
                      </LocalLink>
                      {!isVendido && p.activo && (
                        <button
                          onClick={() => abrirVendido(p.id)}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left"
                        >
                          <CheckCircle2 size={14} className="text-green-600" /> Marcar como vendido
                        </button>
                      )}
                      {!isVendido && p.activo && p.creado_en && (nowTs - new Date(p.creado_en).getTime()) >= 7 * 864e5 && (
                        <button
                          onClick={() => renovarProducto(p.id)}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left"
                        >
                          <RefreshCw size={14} className="text-blue-600" /> Renovar (subir como nuevo)
                        </button>
                      )}
                      {isVendido && (
                        <button
                          onClick={() => reactivarVendido(p.id)}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left"
                        >
                          <Play size={14} className="text-orange-500" /> Reactivar
                        </button>
                      )}
                      <button
                        onClick={() => pausarActivar(p.id, p.activo)}
                        disabled={isVendido}
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left disabled:opacity-40"
                      >
                        {p.activo ? <Pause size={14} /> : <Play size={14} />} {p.activo ? 'Pausar' : 'Activar'}
                      </button>
                      {!isVendido && (
                        <button
                          onClick={() => eliminarProducto(p.id)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                        >
                          <X size={14} className="text-red-500" /> Eliminar publicación
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* PROMOCIONAR */}
                {!isVendido && p.activo && (
                  <div className="relative">
                    <button
                      onClick={() => { cerrarMenus(); setMenuPromocionar(promoAbierto ? null : p.id) }}
                      className="px-3 py-1.5 bg-brand-accent/20 text-brand-primary rounded-lg text-xs font-bold hover:bg-brand-accent/30 flex items-center gap-1"
                    >
                      Promocionar <ChevronDown size={12} />
                    </button>
                    {promoAbierto && (
                      <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 w-52 z-20">
                        <button
                          onClick={() => {
                            onBoost({ productId: p.id, titulo: p.titulo })
                            cerrarMenus()
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left"
                        >
                          <Zap size={14} className="text-yellow-500" /> Subir al nº 1 (7 días)
                        </button>
                        <button
                          onClick={() => {
                            onDestacar({ productId: p.id, titulo: p.titulo })
                            cerrarMenus()
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 w-full text-left"
                        >
                          <Star size={14} className="text-brand-primary" /> Destacar (12h / 24h / 48h)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* MODAL MARCAR COMO VENDIDO */}
      {vendidoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vendido-titulo"
          tabIndex={-1}
          onKeyDown={(e) => { if (e.key === 'Escape') setVendidoModal(null) }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              {vendidoPaso !== 'tipo' ? (
                <button onClick={() => setVendidoPaso('tipo')} className="flex items-center gap-1 text-sm text-brand-primary hover:underline">
                  <ArrowLeft size={16} /> Atrás
                </button>
              ) : <div />}
              <button onClick={() => setVendidoModal(null)} aria-label="Cerrar modal" className="p-1 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>

            {/* PASO 1: ¿Cómo se vendió? */}
            {vendidoPaso === 'tipo' && (
              <>
                <h3 id="vendido-titulo" className="text-lg font-bold mb-2">¿Cómo se vendió?</h3>
                <p className="text-sm text-gray-500 mb-6">Esto marca tu anuncio como vendido y ya no aparecerá activo.</p>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      if (interesados.length > 0) {
                        setVendidoPaso('comprador')
                      } else {
                        marcarVendidoSimple(vendidoModal, 'plataforma')
                      }
                    }}
                    className="w-full text-left p-4 border-2 border-green-200 bg-green-50 rounded-xl hover:bg-green-100 transition"
                  >
                    <p className="font-bold text-green-800">🤝 Vendido en esta plataforma</p>
                    <p className="text-xs text-green-600 mt-1">
                      {interesados.length > 0
                        ? `${interesados.length} persona(s) te contactaron por este producto`
                        : 'No hubo mensajes por este producto'
                      }
                    </p>
                  </button>
                  <button
                    onClick={() => marcarVendidoSimple(vendidoModal, 'otra_pagina')}
                    className="w-full text-left p-4 border-2 border-blue-200 bg-blue-50 rounded-xl hover:bg-blue-100 transition"
                  >
                    <p className="font-bold text-blue-800">🌐 Vendido en otro lugar</p>
                    <p className="text-xs text-blue-600 mt-1">Facebook, WhatsApp, en persona, etc.</p>
                  </button>
                  <button
                    onClick={() => marcarVendidoSimple(vendidoModal, 'no_especificado')}
                    className="w-full text-left p-4 border-2 border-gray-200 bg-gray-50 rounded-xl hover:bg-gray-100 transition"
                  >
                    <p className="font-bold text-gray-700">🤫 Prefiero no decir</p>
                    <p className="text-xs text-gray-500 mt-1">Solo marca el anuncio como vendido</p>
                  </button>
                </div>
              </>
            )}

            {/* PASO 2: ¿A quién le vendiste? */}
            {vendidoPaso === 'comprador' && (
              <>
                <h3 className="text-lg font-bold mb-2">¿A quién le vendiste?</h3>
                <p className="text-sm text-gray-500 mb-4">Selecciona a la persona que te contactó por este producto.</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {cargandoVendidos ? (
                    <p className="text-center text-gray-500 py-8">Cargando...</p>
                  ) : interesados.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">Nadie te contactó por este producto</p>
                  ) : (
                    <>
                      {interesados.map((inter) => (
                        <button
                          key={inter.userId}
                          onClick={() => seleccionarComprador(inter)}
                          className="w-full text-left p-3 border rounded-xl hover:bg-green-50 hover:border-green-200 transition"
                        >
                          <p className="font-semibold text-gray-900">{inter.nombre}</p>
                          {inter.ultimoMensaje && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">"{inter.ultimoMensaje}"</p>
                          )}
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          setCompradorInfo({ id: '', nombre: '' })
                          setVendidoPaso('reseña')
                        }}
                        className="w-full text-center p-3 text-sm text-gray-500 hover:text-brand-primary hover:underline"
                      >
                        Omitir (no fue ninguno de estos)
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            {/* PASO 3: ¿Quieres dejar reseña al comprador? */}
            {vendidoPaso === 'reseña' && (
              <>
                <div className="text-center mb-4">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 size={28} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold">¡Venta registrada!</h3>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    ¿Quieres dejarle una reseña a{' '}
                    <span className="text-brand-primary">
                      {compradorInfo && compradorInfo.nombre ? compradorInfo.nombre : 'este comprador'}
                    </span>
                    ?
                  </p>
                  <div className="flex justify-center mb-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <button key={i} onClick={() => setRating(i)} className="hover:scale-110 transition">
                          <Star size={28} className={i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-500'} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="text-center text-xs text-gray-500">{['Muy mala', 'Mala', 'Regular', 'Buena', 'Excelente'][rating - 1]}</p>
                </div>
                <textarea
                  value={comentarioResena}
                  onChange={e => setComentarioResena(e.target.value)}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                  maxLength={300}
                  placeholder="¿Algo que quieras comentar? (opcional)"
                />
                <p className="text-xs text-gray-500 mt-1 text-right">{comentarioResena.length}/300</p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={venderSinResena}
                    className="flex-1 px-4 py-2.5 border rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Sin reseña
                  </button>
                  <button
                    onClick={enviarResena}
                    disabled={enviandoResena}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-lg text-sm font-bold hover:bg-brand-dark transition disabled:opacity-50"
                  >
                    <Send size={14} /> {enviandoResena ? 'Enviando...' : 'Enviar reseña'}
                  </button>
                </div>
              </>
            )}

            {/* PASO 4: Confirmación */}
            {vendidoPaso === 'confirmado' && (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-green-800 mb-2">¡Vendido!</h3>
                <p className="text-gray-500 mb-6">Tu anuncio ya está marcado como vendido. El comprador recibió un mensaje.</p>
                <button
                  onClick={() => { setVendidoModal(null); window.location.reload() }}
                  className="bg-brand-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-dark transition"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
