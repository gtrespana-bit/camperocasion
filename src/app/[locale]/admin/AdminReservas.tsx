'use client'

/**
 * Revisión de reservas con señal (Fase 1.2).
 *
 * El dinero no pasa por la plataforma: el comprador paga la señal directamente
 * al vendedor (Bizum, transferencia o en mano) y sube el comprobante. Aquí el
 * admin comprueba que el comprobante es real (importe, destinatario, fecha) y
 * activa la reserva — o la rechaza con motivo, lo que libera el anuncio y pide
 * al comprador que suba otro comprobante.
 *
 * Por eso todas las acciones que mueven dinero (activar, rechazar, completar,
 * reembolsar, cancelar) exigen un motivo salvo activar y completar, y quedan
 * registradas en la fila de la reserva (`revisado_por`, `revisado_en`).
 */

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, BadgeEuro, CheckCircle2, ExternalLink, Loader2, RefreshCw, Undo2, X } from 'lucide-react'
import { ETIQUETAS_ESTADO_RESERVA, normalizarEstadoReserva, type EstadoReserva } from '@/lib/reservas'
import { apiJson } from './components/admin-utils'

interface Reserva {
  id: string
  producto_id: string
  importe: number
  estado: string
  metodo_pago: string
  comision: number | null
  mensaje: string | null
  motivo_cancelacion: string | null
  comprobante_signed_url: string | null
  expira_en: string
  created_at: string
  revisado_en: string | null
  vigente: boolean
  productos: { id: string; titulo: string | null; precio_usd: number | null; slug: string | null; user_id: string } | null
  comprador: { id: string; nombre: string | null; email: string | null; telefono: string | null } | null
  vendedor: { id: string; nombre: string | null; email: string | null; telefono: string | null } | null
}

interface Stats {
  pendientes: number
  en_revision: number
  activas: number
  completadas: number
  importe_activo: number
}

type Filtro = 'vivas' | 'en_revision' | 'activas' | 'todas'

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'vivas', label: 'Vivas' },
  { id: 'en_revision', label: 'Por verificar' },
  { id: 'activas', label: 'Activas' },
  { id: 'todas', label: 'Todas' },
]

const ACCIONES: { id: string; label: string; requiereMotivo: boolean; tono: string }[] = [
  { id: 'activar', label: 'Verificar y activar', requiereMotivo: false, tono: 'bg-green-600 hover:bg-green-700 text-white' },
  { id: 'rechazar', label: 'Rechazar comprobante', requiereMotivo: true, tono: 'bg-red-600 hover:bg-red-700 text-white' },
  { id: 'completar', label: 'Marcar entregada', requiereMotivo: false, tono: 'bg-brand-primary hover:bg-brand-dark text-white' },
  { id: 'reembolsar', label: 'Reembolsada', requiereMotivo: true, tono: 'bg-amber-600 hover:bg-amber-700 text-white' },
  { id: 'cancelar', label: 'Cancelar', requiereMotivo: true, tono: 'bg-gray-700 hover:bg-gray-800 text-white' },
]

const fecha = (valor?: string | null) => {
  if (!valor) return '—'
  try {
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor))
  } catch {
    return valor
  }
}

export default function AdminReservas({ notify }: { notify: (msg: string) => void }) {
  const [filtro, setFiltro] = useState<Filtro>('vivas')
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [cargando, setCargando] = useState(true)
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pendienteMigracion, setPendienteMigracion] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/reservas?estado=${filtro}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (json.pendienteMigracion) { setPendienteMigracion(true); return }
      if (!res.ok || !json.ok) { setError(json.error || 'No se pudieron cargar las reservas'); return }
      setReservas(json.reservas || [])
      setStats(json.stats || null)
    } catch {
      setError('No se pudieron cargar las reservas')
    } finally {
      setCargando(false)
    }
  }, [filtro])

  useEffect(() => { cargar() }, [cargar])

  async function accion(reserva: Reserva, id: string, requiereMotivo: boolean) {
    let motivo = ''
    if (requiereMotivo) {
      const entrada = window.prompt(
        id === 'rechazar'
          ? 'Motivo del rechazo (se lo enviaremos al comprador para que suba otro comprobante):'
          : id === 'reembolsar'
            ? 'Constancia de la devolución de la señal:'
            : 'Motivo de la cancelación:',
      )
      if (entrada === null) return
      motivo = entrada.trim()
      if (!motivo) { notify('El motivo es obligatorio'); return }
    }

    setTrabajando(reserva.id)
    try {
      await apiJson('/api/admin/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservaId: reserva.id, accion: id, motivo }),
      })
      notify('Reserva actualizada')
      await cargar()
    } catch (e: any) {
      notify(e?.message || 'No se pudo actualizar la reserva')
    } finally {
      setTrabajando(null)
    }
  }

  if (pendienteMigracion) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h3 className="font-bold text-amber-900 mb-1">Migración de reservas pendiente</h3>
        <p className="text-sm text-amber-800">
          Aplica <code className="rounded bg-amber-100 px-1">supabase/migrations/202609160001_reservas.sql</code> para
          activar la revisión de reservas.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Por verificar', valor: stats.pendientes + stats.en_revision, tono: 'text-amber-700' },
            { label: 'Activas', valor: stats.activas, tono: 'text-green-700' },
            { label: 'Completadas', valor: stats.completadas, tono: 'text-gray-700' },
            { label: 'Señales activas', valor: `${stats.importe_activo} €`, tono: 'text-brand-primary' },
          ].map(c => (
            <div key={c.label} className="rounded-xl border border-gray-100 bg-white p-3">
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className={`text-xl font-black ${c.tono}`}>{c.valor}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map(f => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              filtro === f.id ? 'border-brand-primary bg-brand-primary text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          onClick={cargar}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {cargando ? (
        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-gray-500">
          <Loader2 size={20} className="mx-auto animate-spin" />
        </div>
      ) : reservas.length === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-gray-500">
          No hay reservas en este filtro.
        </div>
      ) : (
        <div className="space-y-3">
          {reservas.map(r => {
            const estado = normalizarEstadoReserva(r.estado) as EstadoReserva
            const etiqueta = ETIQUETAS_ESTADO_RESERVA[estado]
            const acciones = accionesPara(estado)
            return (
              <div key={r.id} className="rounded-xl border border-gray-100 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{r.productos?.titulo || 'Anuncio'}</p>
                    <p className="text-xs text-gray-500">
                      {r.productos?.precio_usd ? `${r.productos.precio_usd} $ de precio · ` : ''}
                      Reserva del {fecha(r.created_at)} · expira {fecha(r.expira_en)}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-bold ${etiqueta?.tono || 'border-gray-200 bg-gray-50'}`}>
                    {etiqueta?.label || r.estado}
                    {r.estado !== 'expirada' && !r.vigente && estado !== 'completada' && estado !== 'cancelada' && estado !== 'rechazada' && estado !== 'reembolsada' ? ' · caducada' : ''}
                  </span>
                </div>

                <div className="mt-2 grid gap-1 text-xs text-gray-700 sm:grid-cols-2">
                  <p>
                    <strong>{r.importe} €</strong> de señal · {r.metodo_pago}
                    {r.comision ? ` · comisión ${r.comision} €` : ''}
                  </p>
                  <p>
                    Comprador: {r.comprador?.nombre || r.comprador?.email || r.comprador?.id || '—'}
                    {r.comprador?.telefono ? ` (${r.comprador.telefono})` : ''}
                  </p>
                  <p>
                    Vendedor: {r.vendedor?.nombre || r.vendedor?.email || r.vendedor?.id || '—'}
                    {r.vendedor?.telefono ? ` (${r.vendedor.telefono})` : ''}
                  </p>
                  {r.revisado_en && <p>Revisada: {fecha(r.revisado_en)}</p>}
                </div>

                {r.mensaje && <p className="mt-1 text-xs italic text-gray-600">“{r.mensaje}”</p>}
                {r.motivo_cancelacion && <p className="mt-1 text-xs text-red-700">Motivo: {r.motivo_cancelacion}</p>}

                <div className="mt-3 flex flex-wrap gap-2">
                  {r.comprobante_signed_url ? (
                    <a
                      href={r.comprobante_signed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <ExternalLink size={13} /> Ver comprobante
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                      <AlertTriangle size={13} /> Sin comprobante
                    </span>
                  )}

                  {r.productos?.id && (
                    <a
                      href={`/producto/${r.productos.slug || r.productos.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Ver anuncio
                    </a>
                  )}

                  {acciones.map(a => {
                    const meta = ACCIONES.find(x => x.id === a)!
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => accion(r, a, meta.requiereMotivo)}
                        disabled={trabajando === r.id}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50 ${meta.tono}`}
                      >
                        {trabajando === r.id ? <Loader2 size={13} className="animate-spin" /> : iconoAccion(a)}
                        {meta.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function iconoAccion(id: string) {
  if (id === 'activar') return <CheckCircle2 size={13} />
  if (id === 'rechazar' || id === 'cancelar') return <X size={13} />
  if (id === 'reembolsar') return <Undo2 size={13} />
  return <BadgeEuro size={13} />
}

/** Qué puede hacer el admin con una reserva en cada estado (espejo de TRANSICIONES_RESERVA). */
function accionesPara(estado: EstadoReserva): string[] {
  switch (estado) {
    case 'pendiente_pago': return ['cancelar']
    case 'en_revision': return ['activar', 'rechazar', 'cancelar']
    case 'activa': return ['completar', 'reembolsar', 'cancelar']
    case 'rechazada': return ['cancelar']
    default: return []
  }
}
