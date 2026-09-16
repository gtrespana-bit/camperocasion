'use client'

/**
 * Inspección precompra — interfaz del comprador en la ficha del anuncio (§4.1).
 *
 * Un CTA discreto bajo la reserva con señal: la inspección no compite con la
 * reserva (no bloquea el anuncio), es el paso previo para el que quiere
 * comprobar "esto está como dicen" antes de desplazarse. El modal explica el
 * flujo concierge ANTES de pedir nada: precio orientativo, quién paga a quién
 * (el taller, no la plataforma) y qué pasa después.
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ClipboardCheck, Loader2, X } from 'lucide-react'
import {
  ETIQUETAS_ESTADO_INSPECCION,
  INSPECCION_PRECIO_ORIENTATIVO_MAX,
  INSPECCION_PRECIO_ORIENTATIVO_MIN,
  puedeSolicitarInspeccion,
  type EstadoInspeccion,
} from '@/lib/inspecciones'

interface Solicitud {
  id: string
  estado: string
  precio?: number | null
  creado_en: string
}

interface Props {
  producto: {
    id: string
    user_id: string
    activo?: boolean
    vendido?: boolean
    estado_moderacion?: string | null
  }
  userId: string | null
  /** El anuncio reservado admite inspección igualmente (no son excluyentes). */
  reservado?: boolean
}

export default function BotonInspeccion({ producto, userId, reservado = false }: Props) {
  const t = useTranslations('inspeccion')
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null)
  const [notas, setNotas] = useState('')

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/inspecciones?productoId=${producto.id}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!json.ok) return
      const vivas: Solicitud[] = (json.inspecciones || []).filter((s: Solicitud) =>
        ['solicitada', 'presupuestada', 'pagada', 'en_curso'].includes(s.estado),
      )
      setSolicitud(vivas[0] || null)
    } catch {
      // Sin red: el CTA se queda como está; la API volverá a decidir al pulsar.
    } finally {
      setCargando(false)
    }
  }, [producto.id])

  useEffect(() => {
    cargar()
  }, [cargar])

  const veredicto = puedeSolicitarInspeccion(producto as any, solicitud, userId)

  // Sin sesión, el CTA lleva a login con redirect de vuelta (igual que reservar).
  if (!userId) {
    return (
      <a
        href={`/login?redirect=/producto/${producto.id}`}
        className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3.5 mb-5 hover:border-brand-primary transition group"
      >
        <span className="w-9 h-9 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center flex-shrink-0">
          <ClipboardCheck size={17} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-gray-900 group-hover:text-brand-primary">
            {t('ctaTitulo')}
          </span>
          <span className="block text-xs text-gray-500">{t('ctaLogin')}</span>
        </span>
      </a>
    )
  }

  async function solicitar() {
    setEnviando(true)
    setError('')
    try {
      const res = await fetch('/api/inspecciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productoId: producto.id, notas: notas.trim() || undefined }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setError(json.error || t('errorGenerico'))
        return
      }
      await cargar()
      setAbierto(false)
      setNotas('')
    } catch {
      setError(t('errorGenerico'))
    } finally {
      setEnviando(false)
    }
  }

  const etiquetaViva = solicitud
    ? ETIQUETAS_ESTADO_INSPECCION[solicitud.estado as EstadoInspeccion] || null
    : null

  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={() => setAbierto(true)}
        disabled={!veredicto.ok}
        className={`w-full flex items-center gap-3 bg-white border rounded-xl p-3.5 text-left transition group ${
          veredicto.ok
            ? 'border-gray-200 hover:border-brand-primary cursor-pointer'
            : 'border-gray-100 opacity-60 cursor-not-allowed'
        }`}
      >
        <span className="w-9 h-9 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center flex-shrink-0">
          <ClipboardCheck size={17} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-gray-900 group-hover:text-brand-primary">
            {solicitud && etiquetaViva
              ? `${t('estadoTitulo')}: ${etiquetaViva.label}`
              : t('ctaTitulo')}
          </span>
          <span className="block text-xs text-gray-500">
            {solicitud && etiquetaViva
              ? etiquetaViva.descripcion
              : t('ctaDesc', { min: INSPECCION_PRECIO_ORIENTATIVO_MIN, max: INSPECCION_PRECIO_ORIENTATIVO_MAX })}
          </span>
        </span>
        {cargando ? <Loader2 size={16} className="animate-spin text-gray-300" aria-hidden="true" /> : null}
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('modalTitulo')}
          onClick={(e) => {
            if (e.target === e.currentTarget && !enviando) setAbierto(false)
          }}
        >
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h3 className="text-base font-bold text-gray-900">{t('modalTitulo')}</h3>
              <button
                type="button"
                onClick={() => !enviando && setAbierto(false)}
                className="p-1 text-gray-400 hover:text-gray-700"
                aria-label={t('cerrar')}
              >
                <X size={18} />
              </button>
            </div>

            <ul className="text-sm text-gray-600 space-y-2 mb-4">
              <li>• {t('modalPaso1', { min: INSPECCION_PRECIO_ORIENTATIVO_MIN, max: INSPECCION_PRECIO_ORIENTATIVO_MAX })}</li>
              <li>• {t('modalPaso2')}</li>
              <li>• {t('modalPaso3')}</li>
              <li>• {t('modalPaso4')}</li>
            </ul>

            {reservado && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">{t('notaReservado')}</p>}

            <label htmlFor="inspeccion-notas" className="block text-xs font-semibold text-gray-700 mb-1">
              {t('notasLabel')}
            </label>
            <textarea
              id="inspeccion-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value.slice(0, 500))}
              rows={2}
              maxLength={500}
              placeholder={t('notasPlaceholder')}
              className="w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            />

            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

            <button
              type="button"
              onClick={solicitar}
              disabled={enviando}
              className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-brand-primary text-white font-bold rounded-xl py-3 hover:bg-brand-primary-dark transition disabled:opacity-60"
            >
              {enviando ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <ClipboardCheck size={16} aria-hidden="true" />}
              {t('confirmar')}
            </button>
            <p className="mt-2 text-[11px] text-gray-400 text-center">{t('avisoSinPago')}</p>
          </div>
        </div>
      )}
    </div>
  )
}
