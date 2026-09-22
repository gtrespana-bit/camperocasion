'use client'

/**
 * Expediente del vehículo — cara del vendedor (100% opcional).
 *
 * Permite subir (y reemplazar) los documentos que acreditan lo que declara el
 * anuncio: ficha técnica, proyecto de homologación, ITV… El equipo de
 * CamperOcasión lo revisa y entonces el anuncio muestra el sello de
 * "Homologación verificada".
 *
 * Es una funcionalidad completamente opcional: el anuncio se publica y edita
 * sin necesidad de subir ningún documento.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FileText, Loader2, ShieldCheck, Trash2, Upload } from 'lucide-react'
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
  verificada: 'bg-emerald-50 border-emerald-300 text-emerald-800',
  pendiente: 'bg-amber-50 border-amber-200 text-amber-800',
  rechazada: 'bg-red-50 border-red-200 text-red-700',
  sin_verificar: 'bg-slate-50 border-slate-200 text-slate-700',
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
  const [desplegado, setDesplegado] = useState(false)
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
      const docs = json.documentos || []
      setDocumentos(docs)
      if (json.estadoVerificacion) {
        const est = normalizarEstadoVerificacion(json.estadoVerificacion)
        setEstado(est)
        if (est !== 'sin_verificar' || docs.length > 0) {
          setDesplegado(true)
        }
      }
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

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#expediente') {
      setDesplegado(true)
    }
  }, [])

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
      setDesplegado(true)
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
    <div className="bg-slate-50/70 rounded-2xl border border-slate-200 p-5 space-y-4 transition" id="expediente">
      {/* Cabecera explicativa con indicador claro de Opcional */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <ShieldCheck size={20} className="text-brand-primary shrink-0" aria-hidden="true" />
            <h3 className="font-bold text-gray-900 text-base">
              {t('expedienteTitle')}
            </h3>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              100% Opcional
            </span>
            {documentos.length > 0 && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                {documentos.length} {documentos.length === 1 ? 'doc subido' : 'docs subidos'}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
            Subir la documentación es <strong>totalmente voluntario</strong>: tu anuncio se guarda y publica normalmente sin ningún documento.
            Súbelos únicamente si deseas obtener el sello oficial de <strong>«Homologación verificada»</strong> para certificar la ficha técnica y transmitir mayor confianza a los compradores.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setDesplegado(prev => !prev)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition shrink-0 self-start sm:self-auto shadow-sm"
        >
          {desplegado ? (
            <>Ocultar <ChevronUp size={14} /></>
          ) : (
            <>{documentos.length > 0 ? 'Gestionar documentos' : 'Añadir documentos para verificar'} <ChevronDown size={14} /></>
          )}
        </button>
      </div>

      {desplegado && (
        <div className="space-y-4 pt-3 border-t border-slate-200 animate-fadeIn">
          {/* Estado del expediente */}
          <div className={`rounded-lg border px-4 py-3 text-xs sm:text-sm ${TONOS_ESTADO[estado] || TONOS_ESTADO.sin_verificar}`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                Estado de verificación: {t(`expedienteEstado.${estado}`)}
              </span>
              {estado === 'sin_verificar' && (
                <span className="text-[11px] text-gray-500 font-normal">
                  (Anuncio estándar sin certificar)
                </span>
              )}
            </div>
            {estado === 'rechazada' && motivo && (
              <p className="mt-1 text-xs">{t('expedienteMotivo')}: {motivo}</p>
            )}
            {estado === 'verificada' && (
              <p className="mt-1 text-xs text-emerald-700">
                ✅ Sello concedido. {t('expedienteEstadoVerificadaNota')}
              </p>
            )}
          </div>

          {/* Avisos solo si el usuario YA ha empezado a subir documentos para solicitar el sello */}
          {documentos.length > 0 && resumen.avisos.length > 0 && (
            <ul className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
              {resumen.avisos.map(aviso => (
                <li key={aviso} className="flex items-start gap-2">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                  <span>Para completar la verificación del sello: {aviso}</span>
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
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
              {resumen.items.map(item => {
                const doc = documentos.find(d => d.tipo === item.tipo)
                const ocupado = subiendo === item.tipo
                return (
                  <div key={item.tipo} className="p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900">{item.label}</span>
                        {item.exigido ? (
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                            Necesario para el sello
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                            Opcional
                          </span>
                        )}
                        {doc && (
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                            doc.estado === 'verificado'
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-300'
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
                        className="inline-flex items-center gap-1.5 text-xs font-semibold border border-gray-300 rounded-lg px-3 py-2 hover:bg-gray-50 disabled:opacity-50 transition bg-white shadow-sm"
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
                          className="inline-flex items-center justify-center text-red-600 border border-red-200 rounded-lg p-2 hover:bg-red-50 disabled:opacity-50 transition"
                        >
                          {eliminando === doc.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-xs text-gray-500 flex items-start gap-2 pt-1">
            <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-emerald-600" aria-hidden="true" />
            {t('expedientePrivacidad')}
          </p>
        </div>
      )}
    </div>
  )
}
