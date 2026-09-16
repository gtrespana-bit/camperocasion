'use client'

/**
 * Expediente del vehículo — cara del vendedor.
 *
 * Permite subir (y reemplazar) los documentos que acreditan lo que declara el
 * anuncio: ficha técnica, proyecto de homologación, ITV… El equipo de
 * CamperOcasión lo revisa y entonces el anuncio muestra el sello de
 * "Homologación verificada".
 *
 * Reglas que respeta la UI:
 *  - Subir de nuevo un documento invalida la verificación anterior (el sello
 *    acredita unos documentos concretos). Lo decide el servidor, no el cliente.
 *  - Los documentos viven en un bucket privado: se abren con URL firmada de 5
 *    minutos que devuelve la API, nunca con una URL pública.
 *  - El vendedor no puede marcarse nada como verificado.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, CheckCircle2, FileText, Loader2, Trash2, Upload } from 'lucide-react'
import {
  TAMANO_MAXIMO_DOCUMENTO,
  TIPOS_ARCHIVO_DOCUMENTO,
  normalizarEstadoVerificacion,
  resumenExpediente,
  type DocumentoVehiculo,
  type TipoDocumentoVehiculo,
} from '@/lib/verificacion-homologacion'

interface DocumentoConUrl extends DocumentoVehiculo {
  id: string
  archivo_url: string
  signedUrl?: string | null
}

interface ExpedienteVehiculoProps {
  productoId: string
  especificaciones?: Record<string, unknown> | null
  estadoInicial?: string | null
  motivoInicial?: string | null
}

const TONOS_ESTADO: Record<string, string> = {
  verificada: 'bg-brand-accent/10 border-brand-accent/40 text-brand-accent-dark',
  pendiente: 'bg-amber-50 border-amber-200 text-amber-800',
  rechazada: 'bg-red-50 border-red-200 text-red-700',
  sin_verificar: 'bg-gray-50 border-gray-200 text-gray-700',
}

export default function ExpedienteVehiculo({
  productoId,
  especificaciones,
  estadoInicial,
  motivoInicial,
}: ExpedienteVehiculoProps) {
  const t = useTranslations('editProduct')
  const [documentos, setDocumentos] = useState<DocumentoConUrl[]>([])
  const [estado, setEstado] = useState(normalizarEstadoVerificacion(estadoInicial))
  const [motivo, setMotivo] = useState(motivoInicial || '')
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [error, setError] = useState('')
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})

  const resumen = resumenExpediente(especificaciones, documentos, estado)

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/documentos-vehiculo?productoId=${productoId}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setError(json.error || t('expedienteErrorCarga'))
        return
      }
      setDocumentos(json.documentos || [])
      if (json.estadoVerificacion) setEstado(normalizarEstadoVerificacion(json.estadoVerificacion))
      if (typeof json.motivo === 'string') setMotivo(json.motivo || '')
    } catch {
      setError(t('expedienteErrorCarga'))
    } finally {
      setCargando(false)
    }
  }, [productoId, t])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function subir(tipo: TipoDocumentoVehiculo, file: File) {
    setError('')
    if (!TIPOS_ARCHIVO_DOCUMENTO.includes(file.type)) {
      setError(t('expedienteFormato'))
      return
    }
    if (file.size > TAMANO_MAXIMO_DOCUMENTO) {
      setError(t('expedienteTamano'))
      return
    }

    setSubiendo(tipo)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('productoId', productoId)
      fd.append('tipo', tipo)

      const res = await fetch('/api/documentos-vehiculo', { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setError(json.error || t('expedienteErrorSubida'))
        return
      }
      setEstado(normalizarEstadoVerificacion(json.estadoVerificacion))
      setMotivo('')
      await cargar()
    } catch {
      setError(t('expedienteErrorSubida'))
    } finally {
      setSubiendo(null)
    }
  }

  async function eliminar(id: string) {
    if (!window.confirm(t('expedienteConfirmarBorrado'))) return
    setError('')
    setEliminando(id)
    try {
      const res = await fetch(`/api/documentos-vehiculo?id=${id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setError(json.error || t('expedienteErrorBorrado'))
        return
      }
      await cargar()
      setEstado(normalizarEstadoVerificacion(json.restantes > 0 ? 'pendiente' : 'sin_verificar'))
    } catch {
      setError(t('expedienteErrorBorrado'))
    } finally {
      setEliminando(null)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4" id="expediente">
      <div>
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <FileText size={18} className="text-brand-accent" aria-hidden="true" />
          {t('expedienteTitle')}
        </h3>
        <p className="text-sm text-gray-600 mt-1">{t('expedienteIntro')}</p>
      </div>

      <div className={`rounded-lg border px-4 py-3 text-sm ${TONOS_ESTADO[estado] || TONOS_ESTADO.sin_verificar}`}>
        <p className="font-semibold">{t(`expedienteEstado.${estado}`)}</p>
        {estado === 'rechazada' && motivo && (
          <p className="mt-1 text-xs">{t('expedienteMotivo')}: {motivo}</p>
        )}
        {estado === 'verificada' && <p className="mt-1 text-xs">{t('expedienteEstadoVerificadaNota')}</p>}
      </div>

      {resumen.avisos.length > 0 && (
        <ul className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
          {resumen.avisos.map(aviso => (
            <li key={aviso} className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span>{aviso}</span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      {cargando ? (
        <p className="text-sm text-gray-500 flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> {t('expedienteCargando')}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {resumen.items.map(item => {
            const doc = documentos.find(d => d.tipo === item.tipo)
            const ocupado = subiendo === item.tipo
            return (
              <li key={item.tipo} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900">{item.label}</span>
                    {item.exigido ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">
                        {t('expedienteRequerido')}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded-full">
                        {t('expedienteOpcional')}
                      </span>
                    )}
                    {doc && (
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${
                        doc.estado === 'verificado'
                          ? 'text-brand-accent-dark bg-brand-accent/10 border-brand-accent/40'
                          : doc.estado === 'rechazado'
                            ? 'text-red-700 bg-red-50 border-red-200'
                            : 'text-amber-700 bg-amber-50 border-amber-200'
                      }`}>
                        {t(`expedienteDocumentoEstado.${doc.estado || 'pendiente'}`)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{item.ayuda}</p>
                  {doc && (
                    <p className="text-xs text-gray-600 mt-1 truncate">
                      {doc.signedUrl ? (
                        <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-primary">
                          {doc.nombre_archivo || t('expedienteVerDocumento')}
                        </a>
                      ) : (
                        doc.nombre_archivo || ''
                      )}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    ref={el => { inputs.current[item.tipo] = el }}
                    type="file"
                    accept={TIPOS_ARCHIVO_DOCUMENTO.join(',')}
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) subir(item.tipo, file)
                      e.target.value = ''
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => inputs.current[item.tipo]?.click()}
                    disabled={ocupado}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {ocupado ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
                    {ocupado ? t('expedienteSubiendo') : doc ? t('expedienteReemplazar') : t('expedienteSubir')}
                  </button>
                  {doc && (
                    <button
                      type="button"
                      onClick={() => eliminar(doc.id)}
                      disabled={eliminando === doc.id}
                      title={t('expedienteEliminar')}
                      aria-label={t('expedienteEliminar')}
                      className="inline-flex items-center justify-center text-red-600 border border-red-200 rounded-lg p-2 hover:bg-red-50 disabled:opacity-50"
                    >
                      {eliminando === doc.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-xs text-gray-500 flex items-start gap-2">
        <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-brand-accent" aria-hidden="true" />
        {t('expedientePrivacidad')}
      </p>
    </div>
  )
}
