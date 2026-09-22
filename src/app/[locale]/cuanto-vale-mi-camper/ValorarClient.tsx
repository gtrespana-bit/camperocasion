'use client'

import { useState } from 'react'
import LocalLink from '@/components/LocalLink'
import { formatPrecio } from '@/lib/precio'
import { ESTADOS_VEHICULO, validarEntrada, type EstadoVehiculo } from '@/lib/valoracion'
import {
  Calculator, Loader2, Info, TrendingUp, ArrowRight, RotateCcw, ShieldCheck,
} from 'lucide-react'

const ANIO = new Date().getFullYear()

interface Grupo {
  fabricante: string
  modelos: { valor: string; etiqueta: string }[]
}

export default function ValorarClient({
  grupos,
  faq,
}: {
  grupos: Grupo[]
  faq: { q: string; a: string }[]
}) {
  const [form, setForm] = useState({
    modelo: '',
    anio: '',
    km: '',
    estado: 'bueno' as EstadoVehiculo,
    precioNuevo: '',
  })
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')

  const set = (campo: string, valor: any) => {
    setForm(f => ({ ...f, [campo]: valor }))
    setErrores(e => ({ ...e, [campo]: '' }))
  }

  const calcular = async () => {
    const entrada = {
      modelo: form.modelo,
      anio: Number(form.anio),
      km: Number(form.km),
      precioNuevo: form.precioNuevo ? Number(form.precioNuevo) : null,
    }
    const errs = validarEntrada(entrada)
    setErrores(errs)
    if (Object.keys(errs).length > 0) return

    setCargando(true)
    setError('')
    setMotivo('')
    setResultado(null)
    try {
      const res = await fetch('/api/valorar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...entrada, estado: form.estado }),
      })
      const data = await res.json()
      if (!data?.ok) {
        setError(data?.error || 'No se pudo calcular.')
      } else if (!data.resultado) {
        setMotivo(data.motivo)
      } else {
        setResultado(data.resultado)
      }
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    }
    setCargando(false)
  }

  const reiniciar = () => {
    setResultado(null)
    setMotivo('')
    setError('')
  }

  const confianzaTexto: Record<string, { etiqueta: string; clase: string }> = {
    alta: { etiqueta: 'Estimación fiable', clase: 'bg-green-50 text-green-800 border-green-200' },
    media: { etiqueta: 'Estimación orientativa', clase: 'bg-blue-50 text-blue-800 border-blue-200' },
    baja: { etiqueta: 'Estimación aproximada', clase: 'bg-amber-50 text-amber-900 border-amber-200' },
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
          ¿Cuánto vale <span className="text-brand-accent">mi camper</span>?
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Calcúlalo gratis con los precios reales de los anuncios publicados en España.
          Sin registro y en menos de un minuto.
        </p>
      </div>

      {!resultado && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label htmlFor="modelo" className="block text-sm font-semibold text-gray-800 mb-1.5">
                Modelo de tu vehículo
              </label>
              <select
                id="modelo"
                value={form.modelo}
                onChange={e => set('modelo', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-accent/40 bg-white"
              >
                <option value="">Selecciona el modelo…</option>
                {grupos.map(g => (
                  <optgroup key={g.fabricante} label={g.fabricante}>
                    {g.modelos.map(m => (
                      <option key={m.valor} value={m.valor}>
                        {m.etiqueta}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {errores.modelo && <p className="text-xs text-red-600 mt-1">{errores.modelo}</p>}
            </div>

            <div>
              <label htmlFor="anio" className="block text-sm font-semibold text-gray-800 mb-1.5">
                Año de matriculación
              </label>
              <input
                id="anio"
                type="number"
                inputMode="numeric"
                min={1970}
                max={ANIO + 1}
                value={form.anio}
                onChange={e => set('anio', e.target.value)}
                placeholder="2018"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
              />
              {errores.anio && <p className="text-xs text-red-600 mt-1">{errores.anio}</p>}
            </div>

            <div>
              <label htmlFor="km" className="block text-sm font-semibold text-gray-800 mb-1.5">
                Kilómetros
              </label>
              <input
                id="km"
                type="number"
                inputMode="numeric"
                min={0}
                value={form.km}
                onChange={e => set('km', e.target.value)}
                placeholder="120000"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
              />
              {errores.km && <p className="text-xs text-red-600 mt-1">{errores.km}</p>}
            </div>

            <div className="md:col-span-2">
              <span className="block text-sm font-semibold text-gray-800 mb-1.5">Estado general</span>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {ESTADOS_VEHICULO.map(e => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => set('estado', e.id)}
                    aria-pressed={form.estado === e.id}
                    className={`text-left p-3 rounded-xl border-2 transition ${
                      form.estado === e.id
                        ? 'border-brand-accent bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-gray-900">{e.etiqueta}</span>
                    <span className="block text-[11px] text-gray-500 mt-0.5 leading-snug">
                      {e.descripcion}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="precioNuevo" className="block text-sm font-semibold text-gray-800 mb-1.5">
                ¿Cuánto costó nueva? <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <input
                id="precioNuevo"
                type="number"
                inputMode="numeric"
                value={form.precioNuevo}
                onChange={e => set('precioNuevo', e.target.value)}
                placeholder="65000"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-accent/40"
              />
              <p className="text-xs text-gray-500 mt-1">
                Solo se usa si aún no hay anuncios suficientes de tu modelo para estimar por mercado.
              </p>
              {errores.precioNuevo && (
                <p className="text-xs text-red-600 mt-1">{errores.precioNuevo}</p>
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 mt-5">
              {error}
            </p>
          )}

          {motivo && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-5 flex gap-2.5">
              <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900">{motivo}</p>
            </div>
          )}

          <button
            onClick={calcular}
            disabled={cargando}
            className="w-full mt-6 bg-brand-primary text-white py-3.5 rounded-xl font-bold hover:bg-brand-dark transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {cargando ? (
              <><Loader2 size={18} className="animate-spin" /> Calculando…</>
            ) : (
              <><Calculator size={18} /> Calcular el valor de mi camper</>
            )}
          </button>
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div className="mb-8">
          <div className="bg-gradient-to-br from-brand-primary to-brand-dark text-white rounded-2xl p-8 text-center mb-5">
            <p className="text-sm uppercase tracking-wide opacity-80 mb-2">Valor estimado</p>
            <p className="text-5xl font-black mb-2">{formatPrecio(resultado.estimado)}</p>
            <p className="opacity-90">
              Horquilla realista: {formatPrecio(resultado.minimo)} – {formatPrecio(resultado.maximo)}
            </p>
          </div>

          <div
            className={`rounded-xl border p-4 mb-5 text-sm flex gap-2.5 ${
              confianzaTexto[resultado.confianza].clase
            }`}
          >
            <ShieldCheck size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{confianzaTexto[resultado.confianza].etiqueta}</p>
              <p>
                {resultado.fuente === 'mercado' ? (
                  <>
                    Calculada con <strong>{resultado.muestra} anuncios reales</strong> de este
                    modelo publicados en CamperOcasión.
                  </>
                ) : (
                  <>
                    Calculada con la tabla oficial de depreciación de Hacienda, porque todavía no
                    hay anuncios suficientes de este modelo. Es menos precisa que una estimación
                    de mercado.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Desglose auditable */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-5">
            <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <TrendingUp size={18} className="text-brand-accent" />
              Cómo hemos llegado a esta cifra
            </h2>
            <ul className="space-y-3">
              {resultado.ajustes.map((a: any, i: number) => (
                <li key={i} className="flex items-start justify-between gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-gray-800">{a.concepto}</p>
                    <p className="text-gray-500">{a.detalle}</p>
                  </div>
                  {a.factor !== 1 && (
                    <span
                      className={`shrink-0 font-bold ${
                        a.factor > 1 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {a.factor > 1 ? '+' : ''}
                      {Math.round((a.factor - 1) * 100)} %
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 text-sm text-gray-600 flex gap-2.5">
            <Info size={17} className="shrink-0 mt-0.5 text-gray-400" />
            <p>
              Es una <strong>estimación orientativa</strong>, no una tasación oficial. El precio
              final depende del equipamiento, la homologación y el estado real del vehículo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LocalLink
              href="/publicar"
              className="bg-brand-accent text-white px-6 py-3.5 rounded-xl font-bold hover:brightness-95 transition text-center inline-flex items-center justify-center gap-2"
            >
              Publicar mi anuncio gratis <ArrowRight size={17} />
            </LocalLink>
            <button
              onClick={reiniciar}
              className="border border-gray-200 bg-white px-6 py-3.5 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition inline-flex items-center justify-center gap-2"
            >
              <RotateCcw size={16} /> Calcular otro vehículo
            </button>
          </div>
        </div>
      )}

      {/* FAQ */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8">
        <h2 className="text-xl font-bold text-gray-900 mb-5">Preguntas frecuentes</h2>
        <div className="space-y-5">
          {faq.map(f => (
            <div key={f.q}>
              <h3 className="font-semibold text-gray-900 mb-1">{f.q}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
