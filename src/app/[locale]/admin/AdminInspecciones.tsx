'use client'

/**
 * Inspecciones precompra — cola de coordinación del panel (plan §4.1).
 *
 * Flujo concierge: entra una solicitud → el equipo presupuesta (150-250 €,
 * precio acordado con el taller colaborador) → el comprador paga DIRECTO al
 * taller y se confirma → en curso → completada (el informe llega por email
 * hasta que exista la red de inspectores). Cancelación posible en cualquier
 * punto vivo: queda como "cancelada" y el comprador puede volver a pedir.
 */

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import {
  ETIQUETAS_ESTADO_INSPECCION,
  INSPECCION_PRECIO_ORIENTATIVO_MAX,
  INSPECCION_PRECIO_ORIENTATIVO_MIN,
  normalizarEstadoInspeccion,
  type EstadoInspeccion,
} from '@/lib/inspecciones'
import { apiJson } from './components/admin-utils'

interface Inspeccion {
  id: string
  estado: string
  precio: number | null
  notas: string | null
  creado_en: string
  completada_en: string | null
  producto: { id: string; titulo: string | null; precio_usd: number | null; slug: string | null } | null
  comprador: { email?: string; nombre?: string; telefono?: string } | null
}

type Filtro = 'vivas' | 'solicitada' | 'todas'

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'vivas', label: 'Vivas' },
  { id: 'solicitada', label: 'Por presupuestar' },
  { id: 'todas', label: 'Todas' },
]

/** Acciones visibles por estado (el destino lo calcula la API desde ACCIONES_ADMIN_INSPECCION). */
const ACCIONES_POR_ESTADO: Record<EstadoInspeccion, { id: string; label: string; tono: string; pidePrecio?: boolean }[]> = {
  solicitada: [
    { id: 'presupuestar', label: 'Presupuestar', tono: 'bg-brand-primary hover:bg-brand-dark text-white', pidePrecio: true },
    { id: 'cancelar', label: 'Cancelar', tono: 'bg-gray-600 hover:bg-gray-700 text-white' },
  ],
  presupuestada: [
    { id: 'marcar_pagada', label: 'Pago confirmado', tono: 'bg-green-600 hover:bg-green-700 text-white' },
    { id: 'cancelar', label: 'Cancelar', tono: 'bg-gray-600 hover:bg-gray-700 text-white' },
  ],
  pagada: [
    { id: 'marcar_en_curso', label: 'Inspección en curso', tono: 'bg-brand-primary hover:bg-brand-dark text-white' },
    { id: 'cancelar', label: 'Cancelar', tono: 'bg-gray-600 hover:bg-gray-700 text-white' },
  ],
  en_curso: [
    { id: 'completar', label: 'Completar informe', tono: 'bg-green-600 hover:bg-green-700 text-white' },
    { id: 'cancelar', label: 'Cancelar', tono: 'bg-gray-600 hover:bg-gray-700 text-white' },
  ],
  completada: [],
  cancelada: [],
}

const fecha = (valor?: string | null) => {
  if (!valor) return '—'
  try {
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor))
  } catch {
    return valor
  }
}

export default function AdminInspecciones({ notify }: { notify: (msg: string) => void }) {
  const [filtro, setFiltro] = useState<Filtro>('vivas')
  const [inspecciones, setInspecciones] = useState<Inspeccion[]>([])
  const [cargando, setCargando] = useState(true)
  const [trabajando, setTrabajando] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pendienteMigracion, setPendienteMigracion] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/inspecciones?estado=${filtro}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (json.pendienteMigracion) {
        setPendienteMigracion(true)
        return
      }
      if (!res.ok || !json.ok) {
        setError(json.error || 'No se pudieron cargar las inspecciones')
        return
      }
      setInspecciones(json.inspecciones || [])
    } catch {
      setError('No se pudieron cargar las inspecciones')
    } finally {
      setCargando(false)
    }
  }, [filtro])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function accion(insp: Inspeccion, id: string, pidePrecio?: boolean) {
    let precio: number | undefined
    if (pidePrecio) {
      const entrada = window.prompt(
        `Presupuesto acordado con el taller (€, orientativo ${INSPECCION_PRECIO_ORIENTATIVO_MIN}-${INSPECCION_PRECIO_ORIENTATIVO_MAX}):`,
        String(INSPECCION_PRECIO_ORIENTATIVO_MIN),
      )
      if (entrada === null) return
      precio = Number(entrada)
      if (!Number.isFinite(precio) || precio <= 0) {
        notify('Precio no válido')
        return
      }
    }

    setTrabajando(insp.id)
    try {
      await apiJson('/api/admin/inspecciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: id, solicitudId: insp.id, precio }),
      })
      notify('Inspección actualizada')
      await cargar()
    } catch (e: any) {
      notify(e?.message || 'No se pudo actualizar la inspección')
    } finally {
      setTrabajando(null)
    }
  }

  if (pendienteMigracion) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h3 className="font-bold text-amber-900 mb-1">Migración de inspecciones pendiente</h3>
        <p className="text-sm text-amber-800">
          Aplica{' '}
          <code className="rounded bg-amber-100 px-1">supabase/migrations/202609170002_inspecciones_gestoria.sql</code>{' '}
          para activar la inspección precompra.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filtro === f.id ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={cargar}
          className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
          aria-label="Recargar"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>}

      {cargando ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-brand-primary" size={24} aria-hidden="true" />
        </div>
      ) : inspecciones.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white rounded-xl border border-gray-100 p-6 text-center">
          No hay inspecciones en esta vista.
        </p>
      ) : (
        <div className="space-y-3">
          {inspecciones.map((insp) => {
            const estado = normalizarEstadoInspeccion(insp.estado)
            const etiqueta = ETIQUETAS_ESTADO_INSPECCION[estado]
            const href = `/producto/${insp.producto?.slug || insp.producto?.id || ''}`
            return (
              <div key={insp.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <LocalLink
                      href={href}
                      className="inline-flex items-center gap-1 text-sm font-bold text-gray-900 hover:text-brand-primary"
                    >
                      {insp.producto?.titulo || 'Anuncio'} <ExternalLink size={12} aria-hidden="true" />
                    </LocalLink>
                    <p className="text-xs text-gray-500 mt-1">
                      {insp.comprador?.nombre || 'Comprador'} · {insp.comprador?.email || '—'} · {insp.comprador?.telefono || 'sin teléfono'}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Solicitada {fecha(insp.creado_en)}
                      {typeof insp.precio === 'number' && insp.precio > 0 ? ` · Presupuesto: ${insp.precio} €` : ''}
                      {insp.notas ? ` · Nota: ${insp.notas}` : ''}
                      {insp.completada_en ? ` · Completada ${fecha(insp.completada_en)}` : ''}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 text-[11px] font-semibold border rounded-full px-2.5 py-1 ${etiqueta.tono}`}>
                    {etiqueta.label}
                  </span>
                </div>
                {ACCIONES_POR_ESTADO[estado].length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-3">
                    {ACCIONES_POR_ESTADO[estado].map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => accion(insp, a.id, a.pidePrecio)}
                        disabled={trabajando === insp.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50 ${a.tono}`}
                      >
                        {trabajando === insp.id ? <Loader2 size={12} className="animate-spin inline mr-1" aria-hidden="true" /> : null}
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
