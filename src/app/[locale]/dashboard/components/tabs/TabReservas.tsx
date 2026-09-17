'use client'

/**
 * Pestaña "Reservas" del dashboard (Fase 1.2 — reserva con señal, confirmación
 * del vendedor).
 *
 * Dos vistas en la misma pestaña porque el interesado casi siempre es el mismo:
 *  - "Como comprador": solicitudes que yo he enviado; sigo el estado
 *    (solicitada → activa cuando el vendedor confirma la señal).
 *  - "Como vendedor": solicitudes de mis anuncios; aquí confirmo cuando recibo
 *    la señal (la reserva pasa a activa y bloquea el anuncio) o la rechazo.
 */

import { useCallback, useEffect, useState } from 'react'
import LocalLink from '@/components/LocalLink'
import Image from 'next/image'
import { CalendarClock, CheckCircle2, Loader2, X } from 'lucide-react'
import { ETIQUETAS_ESTADO_RESERVA, normalizarEstadoReserva, type EstadoReserva } from '@/lib/reservas'
import { formatPrecio } from '@/lib/precio'

interface Reserva {
  id: string
  producto_id: string
  comprador_id: string
  vendedor_id: string
  importe: number
  estado: string
  metodo_pago: string
  mensaje?: string | null
  motivo_cancelacion?: string | null
  expira_en: string
  created_at: string
  productos?: { id: string; titulo: string; precio_usd: number; imagen_url?: string | null; slug?: string | null } | null
  perfiles?: { nombre?: string | null; email?: string | null; telefono?: string | null } | null
}

function fecha(iso?: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

export default function TabReservas({ userId }: { userId: string }) {
  const [vista, setVista] = useState<'comprador' | 'vendedor'>('comprador')
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [cargando, setCargando] = useState(true)
  const [pendienteMigracion, setPendienteMigracion] = useState(false)
  const [aviso, setAviso] = useState('')
  const [trabajando, setTrabajando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch(`/api/reservas?scope=${vista}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (json.pendienteMigracion) setPendienteMigracion(true)
      setReservas(json.reservas || [])
    } catch {
      setAviso('No se pudieron cargar las reservas')
    } finally {
      setCargando(false)
    }
  }, [vista])

  useEffect(() => { cargar() }, [cargar])

  async function confirmar(reserva: Reserva, accion: 'confirmar' | 'rechazar') {
    setAviso('')
    setTrabajando(reserva.id)
    try {
      let motivo: string | null = null
      if (accion === 'rechazar') {
        const entrada = window.prompt('Motivo del rechazo (se lo mostramos al comprador):')
        if (entrada === null) return
        motivo = entrada.trim()
        if (!motivo) { setAviso('El motivo es obligatorio'); return }
      }
      const res = await fetch('/api/reservas/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservaId: reserva.id, accion, motivo }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) setAviso(json.error || 'No se pudo actualizar la reserva')
      else await cargar()
    } catch {
      setAviso('No se pudo actualizar la reserva')
    } finally {
      setTrabajando(null)
    }
  }

  async function cancelar(reserva: Reserva) {
    const texto = normalizarEstadoReserva(reserva.estado) === 'activa'
      ? 'La señal ya está confirmada: al cancelar quedará constancia de que debes devolverla. ¿Continuar?'
      : '¿Cancelar la solicitud de reserva?'
    if (!window.confirm(texto)) return
    await fetch('/api/reservas/cancelar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservaId: reserva.id, motivo: vista === 'vendedor' ? 'Cancelada por el vendedor' : 'Cancelada por el comprador' }),
    })
    await cargar()
  }

  if (pendienteMigracion) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h3 className="font-bold text-amber-900 mb-1">Reservas aún no disponibles</h3>
        <p className="text-sm text-amber-800">
          Falta aplicar la migración de base de datos de reservas. En cuanto esté aplicada, aparecerán aquí tus reservas.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        {(['comprador', 'vendedor'] as const).map(v => (
          <button
            key={v}
            type="button"
            onClick={() => setVista(v)}
            className={`text-sm font-semibold px-4 py-2 rounded-lg transition ${
              vista === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {v === 'comprador' ? 'Mis reservas' : 'En mis anuncios'}
          </button>
        ))}
      </div>

      {aviso && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{aviso}</p>}

      {cargando ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">
          <Loader2 size={20} className="animate-spin mx-auto" />
        </div>
      ) : reservas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
          <CalendarClock size={44} className="text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-800 mb-1">
            {vista === 'comprador' ? 'Todavía no has reservado nada' : 'Nadie ha reservado tus anuncios'}
          </h3>
          <p className="text-sm text-gray-500">
            {vista === 'comprador'
              ? 'Cuando solicites una reserva con señal, el vendedor la confirmará al recibir el pago y la verás aquí.'
              : 'Cuando un comprador solicite reservar uno de tus anuncios, lo verás aquí para confirmar la señal cuando te llegue el pago.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reservas.map(r => {
            const estado = normalizarEstadoReserva(r.estado) as EstadoReserva
            const etiqueta = ETIQUETAS_ESTADO_RESERVA[estado]
            const p = r.productos
            return (
              <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex gap-4">
                  <div className="w-20 h-20 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden relative">
                    {p?.imagen_url ? (
                      <Image src={p.imagen_url} alt={p.titulo || ''} fill sizes="80px" className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">Sin foto</div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <LocalLink href={`/producto/${p?.id || r.producto_id}`} className="font-semibold text-gray-900 hover:text-brand-primary line-clamp-2">
                        {p?.titulo || 'Anuncio'}
                      </LocalLink>
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full border whitespace-nowrap ${etiqueta?.tono || 'bg-gray-50 border-gray-200'}`}>
                        {etiqueta?.label || r.estado}
                      </span>
                    </div>

                    <p className="text-sm text-gray-700 mt-1">
                      <strong>{formatPrecio(r.importe)}</strong> de señal · {r.metodo_pago}
                      {p?.precio_usd ? <span className="text-gray-500"> · precio {formatPrecio(p.precio_usd)}</span> : null}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {vista === 'vendedor' && r.perfiles ? `${r.perfiles.nombre || r.perfiles.email || 'Comprador'} · ` : ''}
                      Del {fecha(r.created_at)} · {estado === 'activa' ? `válida hasta ${fecha(r.expira_en)}` : 'a la espera de confirmación'}
                    </p>
                    {etiqueta?.descripcion && <p className="text-xs text-gray-600 mt-1">{etiqueta.descripcion}</p>}
                    {r.motivo_cancelacion && <p className="text-xs text-red-700 mt-1">Motivo: {r.motivo_cancelacion}</p>}
                    {r.mensaje && <p className="text-xs text-gray-600 mt-1 italic">“{r.mensaje}”</p>}

                    <div className="flex flex-wrap gap-2 mt-3">
                      {estado === 'solicitada' && vista === 'vendedor' && (
                        <>
                          <button
                            type="button"
                            onClick={() => confirmar(r, 'confirmar')}
                            disabled={trabajando === r.id}
                            className="inline-flex items-center gap-1.5 bg-brand-accent text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-brand-accent-dark disabled:opacity-50"
                          >
                            {trabajando === r.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                            Confirmar señal
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmar(r, 'rechazar')}
                            disabled={trabajando === r.id}
                            className="inline-flex items-center gap-1.5 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-red-50 disabled:opacity-50"
                          >
                            <X size={13} /> Rechazar
                          </button>
                        </>
                      )}

                      {['solicitada', 'activa'].includes(estado) && (
                        <button
                          type="button"
                          onClick={() => cancelar(r)}
                          className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-gray-50"
                        >
                          <X size={13} /> Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
