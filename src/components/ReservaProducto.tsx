'use client'

/**
 * Reserva con señal — interfaz del comprador en la ficha del anuncio.
 *
 * Dos piezas:
 *  - `BotonReservar`: el CTA + el modal con importe, método de pago y
 *    condiciones. Crear una reserva manda una SOLICITUD al vendedor: él la
 *    confirma cuando recibe el pago (no hay comprobantes ni espera al equipo).
 *  - `AvisoReservado`: el cartel "Reservado" cuando hay una reserva ACTIVA
 *    (señal ya confirmada por el vendedor).
 *
 * Decisiones de UX:
 *  - El importe se sugiere (2 % del precio, entre 300 y 1.000 €) pero se puede
 *    ajustar: hay vendedores que prefieren pedir menos.
 *  - Las condiciones se muestran ANTES de pagar, con el dinero explícito (paga
 *    directamente al vendedor, se descuenta del precio, cuándo se devuelve).
 *  - El estado se refresca contra la API: si aparece una reserva activa de
 *    otro comprador, el botón se apaga y se explica por qué.
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { CalendarClock, CheckCircle2, Info, Loader2, Lock, X } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import {
  CONDICIONES_SEÑAL,
  ETIQUETAS_ESTADO_RESERVA,
  importeSeñalValido,
  normalizarEstadoReserva,
  reservaVigente,
  sugerirImporteSeñal,
  type EstadoReserva,
} from '@/lib/reservas'

const METODOS = [
  { id: 'bizum', label: 'Bizum' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'efectivo', label: 'En mano' },
  { id: 'otro', label: 'Otro' },
] as const

interface Reserva {
  id: string
  estado: string
  importe: number
  expira_en: string
  comprador_id?: string | null
  motivo_cancelacion?: string | null
}

interface Props {
  producto: { id: string; titulo: string; precio_usd: number; user_id: string; activo?: boolean; vendido?: boolean; reservado?: boolean; estado_moderacion?: string | null }
  userId: string | null
  /** Estado inicial del servidor (evita un parpadeo en la ficha). */
  reservadoInicial?: boolean
  reservadoHastaInicial?: string | null
  onEstadoReserva?: (estado: string | null) => void
}

/** Cartel para quien no puede reservar: el anuncio ya está comprometido. */
export function AvisoReservado({ hasta }: { hasta?: string | null }) {
  const fecha = hasta
    ? new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(new Date(hasta))
    : null

  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-5">
      <CalendarClock size={18} className="text-amber-700 mt-0.5 flex-shrink-0" aria-hidden="true" />
      <div className="text-sm text-amber-900">
        <p className="font-bold">Reservado con señal</p>
        <p className="text-xs mt-0.5">
          Otro comprador ha pagado una señal por este vehículo{fecha ? ` y lo tiene reservado hasta el ${fecha}` : ''}.
          Si la operación no se cierra, el anuncio volverá a estar disponible.
        </p>
      </div>
    </div>
  )
}

export default function BotonReservar({
  producto,
  userId,
  reservadoInicial = false,
  reservadoHastaInicial = null,
  onEstadoReserva,
}: Props) {
  const t = useTranslations('productDetail')
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [miReserva, setMiReserva] = useState<Reserva | null>(null)
  const [ajenaVigente, setAjenaVigente] = useState(reservadoInicial)
  const [hastaAjeno, setHastaAjeno] = useState<string | null>(reservadoHastaInicial)
  const [importe, setImporte] = useState(sugerirImporteSeñal(producto.precio_usd))
  const [metodo, setMetodo] = useState<string>('bizum')
  const [mensaje, setMensaje] = useState('')

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservas?productoId=${producto.id}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!json.ok) return
      const todas: Reserva[] = json.reservas || []
      const mia = todas.find(r => r.comprador_id === userId
        && (r.estado === 'solicitada' || (r.estado === 'activa' && reservaVigente(r.estado, r.expira_en))))
      const otra = todas.find(r => r.comprador_id !== userId && reservaVigente(r.estado, r.expira_en))
      setMiReserva(mia || null)
      setAjenaVigente(!!otra)
      setHastaAjeno(otra?.expira_en || null)
      onEstadoReserva?.(otra?.estado || mia?.estado || null)
    } catch {
      // Sin red: el CTA se queda como está; la API volverá a decidir al pulsar.
    } finally {
      setCargando(false)
    }
  }, [producto.id, userId, onEstadoReserva])

  useEffect(() => { cargar() }, [cargar])

  async function reservar() {
    setError('')
    if (!importeSeñalValido(importe)) {
      setError(`El importe debe estar entre 100 y 1.000 €`)
      return
    }
    setEnviando(true)
    try {
      const res = await fetch('/api/reservas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productoId: producto.id, importe, metodoPago: metodo, mensaje }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setError(json.error || 'No se pudo crear la solicitud')
        return
      }
      setAbierto(false)
      setError('')
      await cargar()
    } catch {
      setError('No se pudo crear la solicitud')
    } finally {
      setEnviando(false)
    }
  }

  async function cancelar() {
    if (!miReserva) return
    if (!window.confirm('¿Cancelar la solicitud de reserva?')) return
    setEnviando(true)
    try {
      const res = await fetch('/api/reservas/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservaId: miReserva.id, motivo: 'Cancelada por el comprador' }),
      })
      if (res.ok) { setMiReserva(null); setAbierto(false); setAjenaVigente(false) }
    } finally {
      setEnviando(false)
    }
  }

  if (cargando) return null

  // Un anuncio reservado por otro no se puede reservar: se explica, no se esconde.
  if (!miReserva && ajenaVigente) {
    return <AvisoReservado hasta={hastaAjeno} />
  }

  const estado = miReserva ? normalizarEstadoReserva(miReserva.estado) : null
  const etiqueta = estado ? ETIQUETAS_ESTADO_RESERVA[estado as EstadoReserva] : null

  if (miReserva && estado && estado !== 'rechazada') {
    return (
      <div className={`rounded-xl border p-3.5 mb-5 ${etiqueta?.tono || 'bg-gray-50 border-gray-200'}`}>
        <p className="text-sm font-bold flex items-center gap-2">
          <CalendarClock size={16} aria-hidden="true" /> {etiqueta?.label} · {miReserva.importe} € de señal
        </p>
        <p className="text-xs mt-1">{etiqueta?.descripcion}</p>

        {estado === 'solicitada' && (
          <p className="text-xs mt-2 flex items-center gap-1.5">
            <Info size={13} aria-hidden="true" /> Paga la señal al vendedor ({METODOS.find(m => m.id === metodo)?.label} u otro método) y
            confirma que lo has hecho en el chat. Cuando reciba el pago, validará la reserva.
          </p>
        )}

        {estado === 'activa' && (
          <p className="text-xs mt-2 flex items-center gap-1.5">
            <CheckCircle2 size={13} aria-hidden="true" /> Señal confirmada por el vendedor. Contacta con él para la entrega y
            descuenta el importe del precio final.
          </p>
        )}

        {error && <p className="text-xs text-red-700 mt-2">{error}</p>}

        <button
          type="button"
          onClick={cancelar}
          disabled={enviando}
          className="mt-2 text-xs font-semibold underline text-gray-600 hover:text-red-600 disabled:opacity-50"
        >
          Cancelar la reserva
        </button>
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!userId) { window.location.href = `/login?redirect=/producto/${producto.id}`; return }
          setAbierto(true)
        }}
        className="w-full flex items-center justify-center gap-2 border-2 border-brand-accent text-brand-accent-dark bg-brand-accent/5 text-sm font-bold px-4 py-3 rounded-xl hover:bg-brand-accent/10 transition mb-5"
      >
        <Lock size={16} aria-hidden="true" />
        {estado === 'rechazada' ? 'Volver a solicitar la reserva' : t('reservarCta')}
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => setAbierto(false)}>
          <div
            className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="text-lg font-black text-gray-900">Reservar con señal</h3>
              <button type="button" onClick={() => setAbierto(false)} className="p-1 hover:bg-gray-100 rounded-lg" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-gray-600 mb-4">{producto.titulo}</p>

            <label htmlFor="reserva-importe" className="block text-sm font-semibold text-gray-800 mb-1.5">
              Importe de la señal
            </label>
            <div className="relative mb-3">
              <input
                id="reserva-importe"
                type="number"
                inputMode="numeric"
                min={100}
                max={1000}
                step={50}
                value={importe}
                onChange={e => setImporte(Number(e.target.value))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm pr-10"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">€</span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Es una señal, no un pago grande: se descuenta del precio el día de la entrega. Te sugerimos{' '}
              {sugerirImporteSeñal(producto.precio_usd)} € para este anuncio.
            </p>

            <p className="block text-sm font-semibold text-gray-800 mb-1.5">Cómo vas a pagar</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {METODOS.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetodo(m.id)}
                  className={`text-xs font-semibold px-3 py-2 rounded-lg border transition ${
                    metodo === m.id ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <label htmlFor="reserva-mensaje" className="block text-sm font-semibold text-gray-800 mb-1.5">
              Mensaje para el vendedor <span className="font-normal text-gray-500">(opcional)</span>
            </label>
            <textarea
              id="reserva-mensaje"
              rows={2}
              maxLength={500}
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              placeholder="Cuándo podrías ver el vehículo, dudas sobre la documentación…"
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm mb-4"
            />

            <ul className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1.5 mb-4">
              {CONDICIONES_SEÑAL.map(c => (
                <li key={c} className="flex items-start gap-2">
                  <span className="text-brand-accent mt-0.5" aria-hidden="true">•</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>

            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}

            <button
              type="button"
              onClick={reservar}
              disabled={enviando}
              className="w-full inline-flex items-center justify-center gap-2 bg-brand-accent text-white text-sm font-bold px-4 py-3 rounded-xl hover:bg-brand-accent-dark disabled:opacity-50"
            >
              {enviando ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
              {enviando ? 'Enviando…' : `Solicitar reserva por ${importe} €`}
            </button>

            <p className="text-[11px] text-gray-500 mt-3 flex items-start gap-1.5">
              <Info size={12} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              Al solicitar la reserva aceptas las condiciones de la señal. Este servicio no es una custodia de fondos:{' '}
              <LocalLink href="/compra-segura-camper" className="underline hover:text-brand-primary">cómo comprar de forma segura</LocalLink>.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
