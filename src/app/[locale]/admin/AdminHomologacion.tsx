'use client'

/**
 * Revisión de expedientes de homologación (Fase 0.2).
 *
 * Cola FIFO: primero el anuncio cuya documentación lleva más tiempo esperando.
 * El admin abre cada documento con URL firmada (el bucket es privado), comprueba
 * que lo declarado coincide con la ficha técnica / el proyecto de homologación y
 * marca el expediente como verificado o lo rechaza con motivo.
 *
 * El sello es del ANUNCIO, no del vendedor: el mismo vendedor puede tener un
 * camper homologado y otro sin homologar.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ExternalLink, FileText, Loader2, RefreshCw, ShieldCheck, X } from 'lucide-react'
import {
  esHomologacionVivienda,
  etiquetaTipoDocumento,
  normalizarEstadoVerificacion,
  tiposExigidos,
} from '@/lib/verificacion-homologacion'

interface Documento {
  id: string
  tipo: string
  archivo_url: string
  nombre_archivo: string | null
  estado: string
  creado_en: string
}

interface Revision {
  id: string
  titulo: string
  slug: string | null
  subcategoria: string | null
  marca: string | null
  precio_usd: number | null
  user_id: string
  verificacion_homologacion: string
  verificacion_homologacion_motivo: string | null
  verificacion_homologacion_revisada_en: string | null
  especificaciones: Record<string, string> | null
  documentos: Documento[]
  vendedor: { id: string; nombre: string | null; verificado: boolean | null } | null
  primer_documento: string | null
}

type Filtro = 'pendiente' | 'todas' | 'verificada' | 'rechazada'

const formatearFecha = (valor: string | null) => {
  if (!valor) return '—'
  try {
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor))
  } catch {
    return valor
  }
}

export default function AdminHomologacion({ notify }: { notify: (msg: string) => void }) {
  const [revisiones, setRevisiones] = useState<Revision[]>([])
  const [stats, setStats] = useState({ pendientes: 0, verificadas: 0, rechazadas: 0, total: 0 })
  const [filtro, setFiltro] = useState<Filtro>('pendiente')
  const [cargando, setCargando] = useState(false)
  const [abriendo, setAbriendo] = useState<string | null>(null)
  const [rechazando, setRechazando] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [procesando, setProcesando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch(`/api/admin/documentos-vehiculo?estado=${filtro}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        notify('Error: ' + (json.error || 'No se pudieron cargar los expedientes'))
        return
      }
      setRevisiones(json.revisiones || [])
      if (json.stats) setStats(json.stats)
      if (json.pendienteMigracion) {
        notify('Aplica la migración 202609150001_verificacion_homologacion.sql para activar la revisión')
      }
    } finally {
      setCargando(false)
    }
  }, [filtro, notify])

  useEffect(() => { cargar() }, [cargar])

  async function abrirDocumento(doc: Documento) {
    // Abrir la ventana de forma síncrona conserva el gesto del usuario mientras
    // se pide la URL firmada (mismo patrón que la revisión de cédulas).
    const preview = window.open('', '_blank')
    if (!preview) {
      notify('El navegador bloqueó la ventana del documento')
      return
    }
    preview.opener = null
    setAbriendo(doc.id)
    try {
      const res = await fetch(`/api/admin/documentos-vehiculo/firmar?path=${encodeURIComponent(doc.archivo_url)}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.signedUrl) {
        preview.close()
        notify('No se pudo abrir el documento')
        return
      }
      preview.location.href = json.signedUrl
    } finally {
      setAbriendo(null)
    }
  }

  async function resolver(productoId: string, action: 'verificar' | 'rechazar', motivoTexto?: string) {
    setProcesando(productoId)
    try {
      const res = await fetch('/api/admin/documentos-vehiculo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, productoId, motivo: motivoTexto }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        notify('Error: ' + (json.error || 'No se pudo guardar la revisión'))
        return
      }
      notify(action === 'verificar' ? 'Expediente verificado ✔' : 'Expediente rechazado')
      setRechazando(null)
      setMotivo('')
      await cargar()
    } finally {
      setProcesando(null)
    }
  }

  const filtros: { id: Filtro; label: string; contador?: number }[] = useMemo(() => ([
    { id: 'pendiente', label: 'Pendientes', contador: stats.pendientes },
    { id: 'todas', label: 'Todas', contador: stats.total },
    { id: 'verificada', label: 'Verificadas', contador: stats.verificadas },
    { id: 'rechazada', label: 'Rechazadas', contador: stats.rechazadas },
  ]), [stats])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filtros.map(f => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
              filtro === f.id ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
            {typeof f.contador === 'number' && (
              <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${filtro === f.id ? 'bg-white/20' : 'bg-white'}`}>
                {f.contador}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={cargar}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw size={13} className={cargando ? 'animate-spin' : ''} /> Refrescar
        </button>
      </div>

      {cargando && revisiones.length === 0 && (
        <p className="flex items-center gap-2 p-6 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> Cargando expedientes…
        </p>
      )}

      {!cargando && revisiones.length === 0 && (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
          No hay expedientes en este estado.
        </p>
      )}

      <div className="space-y-3">
        {revisiones.map(rev => {
          const exigidos = tiposExigidos(rev.especificaciones)
          const subidos = new Set(rev.documentos.map(d => d.tipo))
          const faltan = exigidos.filter(t => !subidos.has(t))
          const homologacion = rev.especificaciones?.['Homologación'] || '—'
          const vivienda = esHomologacionVivienda(rev.especificaciones)
          const estado = normalizarEstadoVerificacion(rev.verificacion_homologacion)

          return (
            <div key={rev.id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <a
                    href={`/producto/${rev.slug || rev.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-gray-900 hover:text-brand-primary inline-flex items-center gap-1.5"
                  >
                    {rev.titulo} <ExternalLink size={13} />
                  </a>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {[rev.subcategoria, rev.marca].filter(Boolean).join(' · ')} · Vendedor:{' '}
                    {rev.vendedor?.nombre || rev.user_id.slice(0, 8)}
                    {rev.vendedor?.verificado ? ' (verificado)' : ''}
                  </p>
                  <p className="mt-1 text-xs text-gray-700">
                    Declara: <span className="font-semibold">{homologacion}</span>
                    {vivienda && <span className="ml-2 text-amber-700">Vehículo vivienda</span>}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    Primer documento: {formatearFecha(rev.primer_documento)}
                    {rev.verificacion_homologacion_revisada_en && ` · Revisado: ${formatearFecha(rev.verificacion_homologacion_revisada_en)}`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    estado === 'verificada'
                      ? 'border-brand-accent/40 bg-brand-accent/10 text-brand-accent-dark'
                      : estado === 'rechazada'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                  }`}>
                    {estado.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <ul className="mt-3 space-y-1">
                {rev.documentos.map(doc => (
                  <li key={doc.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <FileText size={14} className="text-gray-400" />
                    <span className="text-gray-800">{etiquetaTipoDocumento(doc.tipo)}</span>
                    <span className="text-[11px] text-gray-400">{formatearFecha(doc.creado_en)}</span>
                    <button
                      onClick={() => abrirDocumento(doc)}
                      disabled={abriendo === doc.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {abriendo === doc.id ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
                      Abrir
                    </button>
                  </li>
                ))}
              </ul>

              {faltan.length > 0 && (
                <p className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  Faltan documentos exigidos para lo que declara el anuncio: {faltan.map(etiquetaTipoDocumento).join(', ')}.
                </p>
              )}

              {estado === 'rechazada' && rev.verificacion_homologacion_motivo && (
                <p className="mt-2 text-xs text-red-700">Motivo del rechazo: {rev.verificacion_homologacion_motivo}</p>
              )}

              {rechazando === rev.id ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={motivo}
                    onChange={e => setMotivo(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    placeholder="Motivo del rechazo (lo verá el vendedor)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => resolver(rev.id, 'rechazar', motivo)}
                      disabled={procesando === rev.id || !motivo.trim()}
                      className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {procesando === rev.id ? 'Guardando…' : 'Confirmar rechazo'}
                    </button>
                    <button
                      onClick={() => { setRechazando(null); setMotivo('') }}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      <X size={13} /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => resolver(rev.id, 'verificar')}
                    disabled={procesando === rev.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-accent px-3 py-2 text-xs font-bold text-white hover:bg-brand-accent-dark disabled:opacity-50"
                  >
                    {procesando === rev.id ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                    Verificar homologación
                  </button>
                  <button
                    onClick={() => { setRechazando(rev.id); setMotivo('') }}
                    className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Rechazar
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
