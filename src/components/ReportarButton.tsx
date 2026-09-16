'use client'

import { useState, useEffect, useRef } from 'react'
import { Flag, X, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const MOTIVOS = [
  { value: 'fraude', label: 'Fraude o estafa' },
  { value: 'ilegal', label: 'Contenido ilegal' },
  { value: 'inapropiado', label: 'Contenido inapropiado' },
  { value: 'spam', label: 'Spam' },
  { value: 'duplicado', label: 'Publicacion duplicada' },
  { value: 'categoria_incorrecta', label: 'Categoria incorrecta' },
  { value: 'otro', label: 'Otro' },
]

export default function ReportarButton({ productoId }: { productoId: string }) {
  const [mostrar, setMostrar] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)
  const [yaReportado, setYaReportado] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mostrar) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMostrar(false)
        setYaReportado(false)
        setExito(false)
      }
    }
    document.addEventListener('keydown', handleEsc)
    dialogRef.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [mostrar])

  if (!productoId) return null

  const handleSubmit = async () => {
    if (!motivo) return
    setEnviando(true)
    try {
      const { data: sesion } = await supabase.auth.getSession()
      if (!sesion?.session) {
        alert('Debes iniciar sesion para reportar')
        setEnviando(false)
        return
      }
      const userId = sesion.session.user.id

      const { count } = await supabase
        .from('denuncias')
        .select('id', { count: 'exact', head: true })
        .eq('producto_id', productoId)
        .eq('reportante_id', userId)
        .eq('estado', 'activa')

      if (count && count > 0) {
        alert('Ya reportaste esta publicacion anteriormente')
        setYaReportado(true)
        setEnviando(false)
        return
      }

      const { error } = await supabase.from('denuncias').insert({
        producto_id: productoId,
        reportante_id: userId,
        motivo,
        descripcion: descripcion.trim() || null,
      })

      if (error?.message?.includes('duplicate')) {
        setYaReportado(true)
      } else if (error) {
        throw error
      } else {
        setExito(true)
        setTimeout(() => {
          setMostrar(false)
          setExito(false)
        }, 2000)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      alert('Error al enviar la denuncia: ' + msg)
    }
    setEnviando(false)
  }

  const MOTIVO_ICONS: Record<string, string> = {
    fraude: '\u{1F6AB}',
    ilegal: '\u{1F512}',
    inapropiado: '\u26A0\uFE0F',
    spam: '\u{1F4E2}',
    duplicado: '\u{1F501}',
    categoria_incorrecta: '\u{1F4C2}',
    otro: '\u{1F4DD}',
  }

  return (
    <>
      <button
        onClick={() => setMostrar(true)}
        className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition focus:outline-none focus:ring-2 focus:ring-brand-accent"
        title="Reportar publicacion"
        aria-label="Reportar publicación"
      >
        <Flag size={16} aria-hidden="true" /> Reportar
      </button>

      {mostrar && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="presentation"
          onClick={() => {
            setMostrar(false)
            setYaReportado(false)
            setExito(false)
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reportar-titulo"
            tabIndex={-1}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-fadeIn outline-none"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="reportar-titulo" className="text-lg font-bold">
                Reportar publicacion
              </h3>
              <button
                onClick={() => {
                  setMostrar(false)
                  setYaReportado(false)
                  setExito(false)
                }}
                aria-label="Cerrar modal"
                className="p-2 hover:bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-accent"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {exito ? (
              <div className="text-center py-6" role="status" aria-live="polite">
                <div className="text-4xl mb-3" aria-hidden="true">
                  {'\u2705'}
                </div>
                <p className="font-bold text-green-700">Denuncia enviada</p>
                <p className="text-sm text-gray-600 mt-1">Revisaremos la publicacion lo antes posible.</p>
              </div>
            ) : yaReportado ? (
              <div className="text-center py-6" role="status" aria-live="polite">
                <div className="text-4xl mb-3" aria-hidden="true">
                  {'\u2139\uFE0F'}
                </div>
                <p className="font-bold text-gray-700">Ya reportaste esta publicacion</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <fieldset>
                    <legend className="text-sm font-semibold text-gray-600 mb-2 block">Motivo</legend>
                    <div className="space-y-1" role="radiogroup" aria-label="Motivo de denuncia">
                      {MOTIVOS.map(m => (
                        <label
                          key={m.value}
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition text-sm focus-within:ring-2 focus-within:ring-brand-accent ${
                            motivo === m.value ? 'bg-yellow-200/30 border border-yellow-400' : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <input
                            type="radio"
                            name="motivo"
                            value={m.value}
                            checked={motivo === m.value}
                            onChange={() => setMotivo(m.value)}
                            className="accent-blue-800"
                            aria-label={m.label}
                          />
                          <span aria-hidden="true">{MOTIVO_ICONS[m.value]}</span> {m.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div>
                    <label htmlFor="reporte-desc" className="text-sm font-semibold text-gray-600 mb-1 block">
                      Descripcion (opcional)
                    </label>
                    <textarea
                      id="reporte-desc"
                      value={descripcion}
                      onChange={e => setDescripcion(e.target.value)}
                      placeholder="Explica brevemente el problema..."
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-accent"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!motivo || enviando}
                  className="w-full mt-4 bg-blue-950 text-white py-2.5 rounded-lg font-bold hover:bg-brand-dark transition flex items-center justify-center gap-2 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2"
                >
                  <Send size={16} aria-hidden="true" /> {enviando ? 'Enviando...' : 'Enviar denuncia'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
