'use client'

/**
 * Calculadora de ITP para comprar una camper de segunda mano.
 *
 * Decisión de producto: NO se limita a dar una cifra. Devuelve el desglose
 * (coeficiente, base imponible, tipo aplicado) y la lista de reglas que han
 * decidido el resultado, porque en este impuesto casi todo el mundo se lleva la
 * sorpresa de que la base no es el precio pactado sino el valor de tablas de
 * Hacienda. Los avisos son parte del producto, no letra pequeña.
 */

import { useMemo, useState } from 'react'
import { AlertTriangle, Calculator, ChevronDown, ExternalLink, Info, ShieldCheck } from 'lucide-react'
import LocalLink from '@/components/LocalLink'
import {
  CHECKLIST_CAMPER,
  EJERCICIO_FISCAL,
  REVISADO_EN,
  TASA_DGT,
  TIPOS_ITP,
  calcularITP,
  compararComunidades,
} from '@/lib/itp'
import { formatPrecioObligatorio } from '@/lib/precio'

const ETIQUETAS_DGT = ['C', 'B', 'ECO', '0'] as const

interface Props {
  /** Comunidad preseleccionada (en las landings por CCAA). */
  ccaaInicial?: string
  /** Precio inicial (por ejemplo, el de un anuncio concreto). */
  precioInicial?: number
  /** Si es una landing autonómica, mostramos solo su comparativa resumida. */
  compacta?: boolean
}

export default function CalculadoraITP({ ccaaInicial, precioInicial, compacta = false }: Props) {
  const [ccaa, setCcaa] = useState(ccaaInicial && TIPOS_ITP.some(c => c.slug === ccaaInicial) ? ccaaInicial : 'madrid')
  const [precio, setPrecio] = useState(String(precioInicial || 30000))
  const [anioMatriculacion, setAnioMatriculacion] = useState('2019')
  const [valorTablas, setValorTablas] = useState('')
  const [cvFiscales, setCvFiscales] = useState('')
  const [cilindrada, setCilindrada] = useState('')
  const [etiquetaDGT, setEtiquetaDGT] = useState('')
  const [verDetalle, setVerDetalle] = useState(false)

  const anios = useMemo(() => {
    const lista: number[] = []
    for (let a = EJERCICIO_FISCAL; a >= EJERCICIO_FISCAL - 30; a--) lista.push(a)
    return lista
  }, [])

  const entrada = useMemo(() => ({
    ccaa,
    precio: Number(precio) || 0,
    anioMatriculacion: Number(anioMatriculacion) || EJERCICIO_FISCAL,
    valorTablas: Number(valorTablas) || undefined,
    cvFiscales: Number(cvFiscales) || undefined,
    cilindrada: Number(cilindrada) || undefined,
    etiquetaDGT: etiquetaDGT || undefined,
  }), [ccaa, precio, anioMatriculacion, valorTablas, cvFiscales, cilindrada, etiquetaDGT])

  const resultado = useMemo(() => calcularITP(entrada), [entrada])

  const comparativa = useMemo(() => compararComunidades({
    precio: Number(precio) || 0,
    anioMatriculacion: Number(anioMatriculacion) || EJERCICIO_FISCAL,
    valorTablas: Number(valorTablas) || undefined,
    cvFiscales: Number(cvFiscales) || undefined,
    cilindrada: Number(cilindrada) || undefined,
    etiquetaDGT: etiquetaDGT || undefined,
  }), [precio, anioMatriculacion, valorTablas, cvFiscales, cilindrada, etiquetaDGT])

  const ahorroMaximo = comparativa.length > 0
    ? comparativa[comparativa.length - 1].cuota - comparativa[0].cuota
    : 0
  const totalOperacion = (Number(precio) || 0) + resultado.cuota + TASA_DGT

  const claseInput = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-brand-primary focus:outline-none'
  const claseLabel = 'block text-sm font-semibold text-gray-800 mb-1.5'

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="grid lg:grid-cols-2">
        {/* ── Entradas ─────────────────────────────────────────────── */}
        <div className="p-5 sm:p-6 border-b lg:border-b-0 lg:border-r border-gray-100">
          <h2 className="font-black text-gray-900 flex items-center gap-2 mb-4">
            <Calculator size={18} className="text-brand-accent" aria-hidden="true" />
            Datos de la operación
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="itp-precio" className={claseLabel}>Precio de compraventa</label>
              <div className="relative">
                <input
                  id="itp-precio"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={500}
                  value={precio}
                  onChange={e => setPrecio(e.target.value)}
                  className={`${claseInput} pr-10`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">€</span>
              </div>
            </div>

            <div>
              <label htmlFor="itp-ccaa" className={claseLabel}>Comunidad autónoma donde autoliquidas</label>
              <select id="itp-ccaa" value={ccaa} onChange={e => setCcaa(e.target.value)} className={claseInput}>
                {TIPOS_ITP.map(c => (
                  <option key={c.slug} value={c.slug}>{c.nombre} — {c.tipo} %</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Es la comunidad del <strong>comprador</strong> (el que paga el impuesto), no la del vendedor.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="itp-anio" className={claseLabel}>Año de matriculación</label>
                <select id="itp-anio" value={anioMatriculacion} onChange={e => setAnioMatriculacion(e.target.value)} className={claseInput}>
                  {anios.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="itp-dgt" className={claseLabel}>Etiqueta DGT</label>
                <select id="itp-dgt" value={etiquetaDGT} onChange={e => setEtiquetaDGT(e.target.value)} className={claseInput}>
                  <option value="">Sin distintivo / no lo sé</option>
                  {ETIQUETAS_DGT.map(e => (
                    <option key={e} value={e}>{e === '0' ? 'Cero emisiones (0)' : e === 'ECO' ? 'ECO' : e}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="itp-cv" className={claseLabel}>CV fiscales</label>
                <input
                  id="itp-cv"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  placeholder="Ej. 12"
                  value={cvFiscales}
                  onChange={e => setCvFiscales(e.target.value)}
                  className={claseInput}
                />
                <p className="text-[11px] text-gray-500 mt-1">Permiso de circulación (P.2).</p>
              </div>
              <div>
                <label htmlFor="itp-cc" className={claseLabel}>Cilindrada (cc)</label>
                <input
                  id="itp-cc"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={100}
                  placeholder="Ej. 2300"
                  value={cilindrada}
                  onChange={e => setCilindrada(e.target.value)}
                  className={claseInput}
                />
                <p className="text-[11px] text-gray-500 mt-1">Ficha técnica (C.1).</p>
              </div>
            </div>

            <div>
              <label htmlFor="itp-tablas" className={claseLabel}>
                Precio de tablas de Hacienda del vehículo nuevo <span className="font-normal text-gray-500">(opcional)</span>
              </label>
              <div className="relative">
                <input
                  id="itp-tablas"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1000}
                  placeholder="El precio medio de venta de 2026 según la Orden HAC/1501/2025"
                  value={valorTablas}
                  onChange={e => setValorTablas(e.target.value)}
                  className={`${claseInput} pr-10`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">€</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Si lo dejas vacío, estimamos solo con el precio. La ley obliga a liquidar sobre el <strong>mayor</strong> de
                los dos, así que si el valor oficial depreciado supera el precio pactado, pagarás más.
              </p>
            </div>
          </div>
        </div>

        {/* ── Resultado ────────────────────────────────────────────── */}
        <div className="p-5 sm:p-6 bg-gray-50/60">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">ITP estimado</p>
          <p className="text-4xl font-black text-brand-primary mt-1">{formatPrecioObligatorio(resultado.cuota)}</p>

          <dl className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-gray-600">Antigüedad</dt>
              <dd className="font-semibold text-gray-900">{resultado.edadAnios} {resultado.edadAnios === 1 ? 'año' : 'años'} → {Math.round(resultado.coeficiente * 100)} % de depreciación</dd>
            </div>
            {resultado.valorFiscal != null && (
              <div className="flex justify-between gap-3">
                <dt className="text-gray-600">Valor fiscal (tablas)</dt>
                <dd className="font-semibold text-gray-900">{formatPrecioObligatorio(resultado.valorFiscal)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-gray-600">Base imponible</dt>
              <dd className="font-semibold text-gray-900">{formatPrecioObligatorio(resultado.baseImponible)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-600">Tipo aplicado</dt>
              <dd className="font-semibold text-gray-900">
                {resultado.cuotaFija ? 'Cuota fija' : `${resultado.tipoAplicado} %`}
                {resultado.sinAutoliquidar && ' (no se autoliquida)'}
              </dd>
            </div>
            <div className="flex justify-between gap-3 pt-2 border-t border-gray-200">
              <dt className="text-gray-600">Tasa DGT cambio de nombre</dt>
              <dd className="font-semibold text-gray-900">{formatPrecioObligatorio(TASA_DGT)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-bold text-gray-900">Coste total estimado</dt>
              <dd className="font-black text-brand-primary">{formatPrecioObligatorio(totalOperacion)}</dd>
            </div>
          </dl>

          <div className="mt-4 space-y-2">
            {resultado.avisos.map(aviso => (
              <p key={aviso} className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>{aviso}</span>
              </p>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setVerDetalle(v => !v)}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:underline"
            aria-expanded={verDetalle}
          >
            <ChevronDown size={14} className={`transition-transform ${verDetalle ? 'rotate-180' : ''}`} aria-hidden="true" />
            {verDetalle ? 'Ocultar el cálculo paso a paso' : 'Ver el cálculo paso a paso'}
          </button>
          {verDetalle && (
            <ol className="mt-2 space-y-1.5 text-xs text-gray-700 list-decimal list-inside">
              {resultado.reglas.map(regla => <li key={regla.clave}>{regla.descripcion}</li>)}
            </ol>
          )}

          <p className="mt-4 text-[11px] text-gray-500 flex items-start gap-1.5">
            <Info size={12} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            Estimación orientativa con los tipos revisados en {REVISADO_EN}. No sustituye a la
            autoliquidación oficial:{' '}
            <a href={resultado.comunidad.fuente} target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-primary inline-flex items-center gap-0.5">
              sede de {resultado.comunidad.nombre} <ExternalLink size={10} />
            </a>
          </p>
        </div>
      </div>

      {/* ── Comparativa entre comunidades ─────────────────────────── */}
      {!compacta && (
        <div className="border-t border-gray-100 p-5 sm:p-6">
          <h3 className="font-bold text-gray-900 mb-1">Cuánto costaría el mismo ITP en cada comunidad</h3>
          <p className="text-sm text-gray-600 mb-4">
            Con estos datos, el impuesto va de {formatPrecioObligatorio(comparativa[0]?.cuota || 0)} en {comparativa[0]?.comunidad.nombre} a{' '}
            {formatPrecioObligatorio(comparativa[comparativa.length - 1]?.cuota || 0)} en {comparativa[comparativa.length - 1]?.comunidad.nombre}
            {ahorroMaximo > 0 && <> — hasta <strong>{formatPrecioObligatorio(ahorroMaximo)}</strong> de diferencia</>}.
            El impuesto se paga donde reside el comprador, así que esto sirve para entender la diferencia, no para elegir dónde tributar.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">ITP estimado por comunidad autónoma para esta operación</caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                  <th scope="col" className="py-2 pr-3">Comunidad</th>
                  <th scope="col" className="py-2 pr-3">Tipo general</th>
                  <th scope="col" className="py-2 pr-3 text-right">ITP estimado</th>
                  <th scope="col" className="py-2 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {comparativa.map(fila => (
                  <tr key={fila.comunidad.slug} className={`border-b border-gray-50 ${fila.comunidad.slug === ccaa ? 'bg-brand-accent/5 font-semibold' : ''}`}>
                    <td className="py-2 pr-3 text-gray-800">{fila.comunidad.nombre}</td>
                    <td className="py-2 pr-3 text-gray-500">{fila.comunidad.tipo} %</td>
                    <td className="py-2 pr-3 text-right text-gray-900">
                      {fila.sinAutoliquidar ? 'No se autoliquida' : fila.cuotaFija ? `${formatPrecioObligatorio(fila.cuota)} (cuota fija)` : formatPrecioObligatorio(fila.cuota)}
                    </td>
                    <td className="py-2 text-right">
                      <LocalLink href={`/calcular-itp/${fila.comunidad.slug}`} className="text-xs font-semibold text-brand-primary hover:underline">
                        Ver
                      </LocalLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <LocalLink
              href="/catalogo?verificada=1"
              className="inline-flex items-center gap-2 bg-brand-accent text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-brand-accent-dark transition"
            >
              <ShieldCheck size={16} aria-hidden="true" />
              Ver campers con homologación verificada
            </LocalLink>
            <LocalLink
              href="/publicar"
              className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-800 text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-gray-50 transition"
            >
              Vender mi camper
            </LocalLink>
          </div>
        </div>
      )}

      {/* ── Checklist camper ──────────────────────────────────────── */}
      {!compacta && (
        <div className="border-t border-gray-100 p-5 sm:p-6">
          <h3 className="font-bold text-gray-900 mb-3">Antes de firmar: lo que se revisa en una camper</h3>
          <ul className="grid sm:grid-cols-2 gap-3">
            {CHECKLIST_CAMPER.map(item => (
              <li key={item.titulo} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                <p className="text-sm font-semibold text-gray-900">{item.titulo}</p>
                <p className="text-xs text-gray-600 mt-1">{item.detalle}</p>
                <p className="text-[11px] text-gray-500 mt-1.5">📄 {item.donde}</p>
              </li>
            ))}
          </ul>
          <LocalLink href="/compra-segura-camper" className="mt-3 inline-block text-xs font-bold text-brand-primary hover:underline">
            Ver el checklist completo de compra segura →
          </LocalLink>
        </div>
      )}
    </div>
  )
}
