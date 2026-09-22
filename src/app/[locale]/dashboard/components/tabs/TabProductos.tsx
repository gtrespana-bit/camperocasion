"use client"
import { formatPrecio } from '@/lib/precio'

import { useEffect, useRef, useState } from 'react'
import LocalLink from '@/components/LocalLink'
import { Package, X, Pause, Play, Edit, Zap, Star, CheckCircle2, ArrowLeft, Send, RefreshCw, Plus, MoreHorizontal, Eye } from 'lucide-react'
import { productUrl } from '@/lib/product-url'
import { boostVigente } from '@/lib/catalog-consulta'
import Image from 'next/image'

type Filtro = 'activos' | 'pausados' | 'vendidos' | 'todos'

function BadgeEstado({ vendido, activo }: { vendido: boolean; activo: boolean }) {
  if (vendido) {
    return <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold">Vendido</span>
  }
  if (activo) {
    return <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 text-[11px] font-semibold">Activo</span>
  }
  return <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold">Pausado</span>
}

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
  const mediaVisitas = (() => {
    const vivos = (productos || []).filter((p: any) => p.activo && !p.vendido)
    if (vivos.length < 2) return null
    const total = vivos.reduce((s: number, p: any) => s + (p.visitas || 0), 0)
    return total / vivos.length
  })()

  const [filtro, setFiltro] = useState<Filtro>('activos')
  const [vendidoModal, setVendidoModal] = useState<string | null>(null)
  const [vendidoPaso, setVendidoPaso] = useState<'tipo' | 'comprador' | 'reseña' | 'confirmado'>('tipo')
  const [interesados, setInteresados] = useState<any[]>([])
  const [compradorInfo, setCompradorInfo] = useState<{ id: string; nombre: string } | null>(null)
  const [cargandoVendidos, setCargandoVendidos] = useState(false)
  const [enviandoResena, setEnviandoResena] = useState(false)
  const [rating, setRating] = useState(5)
  const [comentarioResena, setComentarioResena] = useState('')
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(null)
      }
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [])

  const nActivos = productos.filter((p: any) => p.activo && !p.vendido).length
  const nPausados = productos.filter((p: any) => !p.activo && !p.vendido).length
  const nVendidos = productos.filter((p: any) => p.vendido).length

  const lista = productos.filter((p: any) => {
    if (filtro === 'activos') return p.activo && !p.vendido
    if (filtro === 'pausados') return !p.activo && !p.vendido
    if (filtro === 'vendidos') return p.vendido
    return true
  })

  const cerrarMenus = () => setMenuAbierto(null)

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

  const seleccionarComprador = (comprador: { userId: string; nombre: string }) => {
    setCompradorInfo({ id: comprador.userId, nombre: comprador.nombre })
    setVendidoPaso('reseña')
  }

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

    await enviarMensajeComprador(compradorInfo.id)
    setVendidoPaso('confirmado')
  }

  const enviarResena = async () => {
    if (!vendidoModal || !compradorInfo) return
    setEnviandoResena(true)
    cerrarMenus()

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

    await enviarMensajeComprador(compradorInfo.id)
    setVendidoPaso('confirmado')
  }

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
    window.location.reload()
  }

  if (productos.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
        <div className="w-12 h-12 rounded-xl bg-brand-accent/10 flex items-center justify-center mx-auto mb-4">
          <Package size={22} className="text-brand-accent" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Aún no tienes anuncios</h3>
        <p className="text-sm text-slate-500 mb-6">Publica el primero en un par de minutos. Es gratis.</p>
        <LocalLink href="/publicar" className="inline-flex items-center gap-2 bg-brand-accent text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-accent-dark">
          <Plus size={16} aria-hidden="true" /> Publicar ahora
        </LocalLink>
      </div>
    )
  }

  const now = new Date().toISOString()
  const nowTs = Date.now()
  const chips: { id: Filtro; label: string; n: number }[] = [
    { id: 'activos', label: 'Activos', n: nActivos },
    { id: 'pausados', label: 'Pausados', n: nPausados },
    { id: 'vendidos', label: 'Vendidos', n: nVendidos },
    { id: 'todos', label: 'Todos', n: productos.length },
  ]

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Anuncios</h3>
          <p className="text-sm text-slate-500">{nActivos} activos · {nVendidos} vendidos</p>
        </div>
        <LocalLink
          href="/publicar"
          className="inline-flex items-center justify-center gap-2 bg-brand-accent hover:bg-brand-accent-dark text-white text-sm font-semibold px-4 py-2.5 rounded-xl"
        >
          <Plus size={16} aria-hidden="true" /> Nuevo anuncio
        </LocalLink>
      </div>

      <div className="flex gap-1.5 overflow-x-auto hide-scrollbar mb-4" role="tablist" aria-label="Filtrar anuncios">
        {chips.map(c => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={filtro === c.id}
            onClick={() => setFiltro(c.id)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition ${
              filtro === c.id
                ? 'bg-brand-primary text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {c.label} <span className="opacity-70">{c.n}</span>
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          No hay anuncios en este filtro.
        </div>
      ) : (
        <ul className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
          {lista.map((p) => {
            const isBoosted = boostVigente(p.boosteado_en)
            const isFeatured = p.destacado && p.destacado_hasta && p.destacado_hasta > now
            const isVendido = p.vendido === true
            const abierto = menuAbierto === p.id
            const puedeRenovar = !isVendido && p.activo && p.creado_en && (nowTs - new Date(p.creado_en).getTime()) >= 7 * 864e5
            const difVisitas = (() => {
              if (mediaVisitas == null || mediaVisitas <= 0 || isVendido || !p.activo) return null
              const dif = Math.round((((p.visitas || 0) - mediaVisitas) / mediaVisitas) * 100)
              if (Math.abs(dif) < 25) return null
              return dif
            })()

            return (
              <li key={p.id} className="p-3 sm:p-4 hover:bg-slate-50/80 transition">
                <div className="flex items-center gap-3 sm:gap-4">
                  <LocalLink href={productUrl(p)} className="relative w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-xl bg-slate-100 overflow-hidden shrink-0">
                    {p.imagen_url ? (
                      <Image src={p.imagen_url} alt="" className="object-cover" fill sizes="72px" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[10px] text-slate-400">Sin foto</span>
                    )}
                    {isVendido && (
                      <span className="absolute inset-0 bg-emerald-800/70 flex items-center justify-center text-white text-[10px] font-bold tracking-wide">VENDIDO</span>
                    )}
                  </LocalLink>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <LocalLink href={productUrl(p)} className="block font-medium text-slate-900 truncate hover:text-brand-accent">
                          {p.titulo}
                        </LocalLink>
                        <p className="text-sm font-semibold text-slate-800 mt-0.5">{formatPrecio(p.precio_usd || 0)}</p>
                      </div>
                      <BadgeEstado vendido={isVendido} activo={!!p.activo} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><Eye size={12} aria-hidden="true" /> {p.visitas || 0}</span>
                      {difVisitas != null && (
                        <span className={difVisitas < 0 ? 'text-amber-700 font-medium' : 'text-emerald-700 font-medium'}>
                          {difVisitas < 0 ? `${Math.abs(difVisitas)} % menos que tu media` : `${difVisitas} % más que tu media`}
                        </span>
                      )}
                      {isBoosted && <span className="text-amber-700 font-medium">En el nº 1</span>}
                      {isFeatured && (
                        <span className="text-slate-600">Destacado hasta {new Date(p.destacado_hasta).toLocaleDateString('es-ES')}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                  <LocalLink
                    href={`/producto/editar/${p.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-700 hover:bg-white"
                  >
                    <Edit size={13} aria-hidden="true" /> Editar
                  </LocalLink>
                  {!isVendido && p.activo && (
                    <button
                      type="button"
                      onClick={() => onDestacar({ productId: p.id, titulo: p.titulo })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-primary text-white hover:bg-brand-dark"
                    >
                      <Star size={13} aria-hidden="true" /> Destacar
                    </button>
                  )}
                  {isVendido && (
                    <button
                      type="button"
                      onClick={() => reactivarVendido(p.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-700 hover:bg-white"
                    >
                      <Play size={13} aria-hidden="true" /> Reactivar
                    </button>
                  )}

                  <div className="relative" ref={abierto ? menuRef : undefined}>
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={abierto}
                      aria-label="Más acciones"
                      onClick={() => setMenuAbierto(abierto ? null : p.id)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {abierto && (
                      <div role="menu" className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 w-52 z-20">
                        {!isVendido && p.activo && (
                          <>
                            <button type="button" role="menuitem" onClick={() => { onBoost({ productId: p.id, titulo: p.titulo }); cerrarMenus() }} className="flex items-center gap-2 px-3 py-2 text-sm w-full text-left hover:bg-slate-50">
                              <Zap size={14} className="text-amber-500" /> Subir al nº 1
                            </button>
                            <button type="button" role="menuitem" onClick={() => abrirVendido(p.id)} className="flex items-center gap-2 px-3 py-2 text-sm w-full text-left hover:bg-slate-50">
                              <CheckCircle2 size={14} className="text-emerald-600" /> Marcar vendido
                            </button>
                            {puedeRenovar && (
                              <button type="button" role="menuitem" onClick={() => renovarProducto(p.id)} className="flex items-center gap-2 px-3 py-2 text-sm w-full text-left hover:bg-slate-50">
                                <RefreshCw size={14} /> Renovar
                              </button>
                            )}
                          </>
                        )}
                        {!isVendido && (
                          <button type="button" role="menuitem" onClick={() => pausarActivar(p.id, p.activo)} className="flex items-center gap-2 px-3 py-2 text-sm w-full text-left hover:bg-slate-50">
                            {p.activo ? <Pause size={14} /> : <Play size={14} />} {p.activo ? 'Pausar' : 'Activar'}
                          </button>
                        )}
                        {!isVendido && (
                          <button type="button" role="menuitem" onClick={() => eliminarProducto(p.id)} className="flex items-center gap-2 px-3 py-2 text-sm w-full text-left text-red-600 hover:bg-red-50">
                            <X size={14} /> Eliminar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {vendidoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vendido-titulo"
          tabIndex={-1}
          onKeyDown={(e) => { if (e.key === 'Escape') setVendidoModal(null) }}
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
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
                    <p className="font-bold text-green-800">Vendido en esta plataforma</p>
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
                    <p className="font-bold text-blue-800">Vendido en otro lugar</p>
                    <p className="text-xs text-blue-600 mt-1">Facebook, WhatsApp, en persona, etc.</p>
                  </button>
                  <button
                    onClick={() => marcarVendidoSimple(vendidoModal, 'no_especificado')}
                    className="w-full text-left p-4 border-2 border-gray-200 bg-gray-50 rounded-xl hover:bg-gray-100 transition"
                  >
                    <p className="font-bold text-gray-700">Prefiero no decir</p>
                    <p className="text-xs text-gray-500 mt-1">Solo marca el anuncio como vendido</p>
                  </button>
                </div>
              </>
            )}

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
                            <p className="text-xs text-gray-500 mt-0.5 truncate">&ldquo;{inter.ultimoMensaje}&rdquo;</p>
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
