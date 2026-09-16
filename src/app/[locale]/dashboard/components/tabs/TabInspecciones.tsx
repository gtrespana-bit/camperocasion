'use client'

/**
 * Pestaña "Inspecciones" del dashboard (plan de confianza §4.1).
 *
 * El comprador ve el estado de sus solicitudes y puede cancelar las vivas
 * (mientras el equipo no las esté coordinando). El informe no se muestra aquí:
 * en el MVP concierge llega por email; cuando exista la red de inspectores,
 * el JSONB del informe se renderizará en esta pestaña.
 */

import { useCallback, useEffect, useState } from 'react'
import LocalLink from '@/components/LocalLink'
import { ClipboardCheck, Loader2, X } from 'lucide-react'
import {
  ETIQUETAS_ESTADO_INSPECCION,
  ESTADOS_INSPECCION_VIVOS,
  normalizarEstadoInspeccion,
  type EstadoInspeccion,
} from '@/lib/inspecciones'

interface Inspeccion {
  id: string
  producto_id: string
  estado: string
  precio?: number | null
  notas?: string | null
  creado_en: string
  producto?: { id: string; titulo: string; precio_usd?: number; imagen_url?: string | null; slug?: string | null } | null
}

function fecha(iso?: string | null) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}

export default function TabInspecciones() {
  const [inspecciones, setInspecciones] = useState<Inspeccion[]>([])
  const [cargando, setCargando] = useState(true)
  const [pendienteMigracion, setPendienteMigracion] = useState(false)
  const [aviso, setAviso] = useState('')
  const [cancelando, setCancelando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/inspecciones', { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (json.pendienteMigracion) setPendienteMigracion(true)
      setInspecciones(json.inspecciones || [])
    } catch {
      setInspecciones([])
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function cancelar(id: string) {
    setCancelando(id)
    setAviso('')
    try {
      const res = await fetch('/api/inspecciones/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitudId: id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setAviso(json.error || 'No se pudo cancelar')
      } else {
        setInspecciones((prev) => prev.map((i) => (i.id === id ? { ...i, estado: 'cancelada' } : i)))
      }
    } catch {
      setAviso('No se pudo cancelar')
    } finally {
      setCancelando(null)
    }
  }

  if (pendienteMigracion) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-sm text-gray-500">
        La inspección precompra estará disponible en breve.
      </div>
    )
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-brand-primary" size={28} aria-hidden="true" />
      </div>
    )
  }

  if (inspecciones.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
        <ClipboardCheck className="mx-auto text-gray-300 mb-3" size={36} aria-hidden="true" />
        <p className="text-sm text-gray-600 font-medium">No has solicitado ninguna inspección</p>
        <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
          Desde la ficha de cualquier anuncio puedes pedir una inspección precompra: un taller
          colaborador revisa el vehículo y te entrega el informe antes de que viajes a verlo.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {aviso && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{aviso}</p>}
      {inspecciones.map((insp) => {
        const estado = normalizarEstadoInspeccion(insp.estado)
        const etiqueta = ETIQUETAS_ESTADO_INSPECCION[estado]
        const viva = ESTADOS_INSPECCION_VIVOS.includes(estado)
        const href = insp.producto?.slug ? `/producto/${insp.producto.slug}` : `/producto/${insp.producto_id}`
        return (
          <div key={insp.id} className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <LocalLink href={href} className="block text-sm font-bold text-gray-900 hover:text-brand-primary truncate">
                  {insp.producto?.titulo || 'Anuncio'}
                </LocalLink>
                <p className="text-xs text-gray-400 mt-0.5">
                  Solicitada el {fecha(insp.creado_en)}
                  {typeof insp.precio === 'number' && insp.precio > 0 ? ` · Presupuesto: ${insp.precio} €` : ''}
                </p>
              </div>
              <span className={`flex-shrink-0 text-[11px] font-semibold border rounded-full px-2.5 py-1 ${etiqueta.tono}`}>
                {etiqueta.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">{etiqueta.descripcion}</p>
            {viva && (
              <button
                type="button"
                onClick={() => cancelar(insp.id)}
                disabled={cancelando === insp.id}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-red-600 disabled:opacity-50"
              >
                {cancelando === insp.id ? (
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                ) : (
                  <X size={13} aria-hidden="true" />
                )}
                Cancelar solicitud
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
