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
import { useLocale, useTranslations } from 'next-intl'
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
  normalizarEtiquetaDGT,
} from '@/lib/itp'
import { formatPrecioObligatorio } from '@/lib/precio'
import { CHECKLIST_CAMPER_EN } from './checklist-en'
import { mensajesITPEn } from './mensajes-en'

// Mismas formas que el select del catálogo (OPCIONES_DGT), para que el usuario
// vea siempre el mismo vocabulario. `normalizarEtiquetaDGT` las reduce a
// '0' | 'ECO' | 'C' | 'B' antes de calcular.
const ETIQUETAS_DGT = [
  'Cero Emisiones',
  'ECO',
  'C (Verde)',
  'B (Amarillo)',
  'Sin distintivo',
] as const

interface Props {
  /** Comunidad preseleccionada (en las landings por CCAA). */
  ccaaInicial?: string
  /** Precio inicial (por ejemplo, el de un anuncio concreto). */
  precioInicial?: number
  /** Si es una landing autonómica, mostramos solo su comparativa resumida. */
  compacta?: boolean
}

export default function CalculadoraITP({ ccaaInicial, precioInicial, compacta = false }: Props) {
  const t = useTranslations('itpCalc')
  const english = useLocale() === 'en'
  const checklist = english ? CHECKLIST_CAMPER_EN : CHECKLIST_CAMPER
  const etiquetaLabel: Record<string, string> = {
    'Cero Emisiones': t('zeroLabel'), 'ECO': 'ECO', 'C (Verde)': t('cLabel'), 'B (Amarillo)': t('bLabel'), 'Sin distintivo': t('noBadge'),
  }
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
  const textos = useMemo(() => english ? mensajesITPEn(resultado, entrada) : {
    reglas: resultado.reglas.map(regla => regla.descripcion), avisos: resultado.avisos,
  }, [english, resultado, entrada])

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
            {t('dataTitle')}
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="itp-precio" className={claseLabel}>{t('salePrice')}</label>
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
              <label htmlFor="itp-ccaa" className={claseLabel}>{t('region')}</label>
              <select id="itp-ccaa" value={ccaa} onChange={e => setCcaa(e.target.value)} className={claseInput}>
                {TIPOS_ITP.map(c => (
                  <option key={c.slug} value={c.slug}>{c.nombre} — {c.tipo} %</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {t('regionHint')}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="itp-anio" className={claseLabel}>{t('registrationYear')}</label>
                <select id="itp-anio" value={anioMatriculacion} onChange={e => setAnioMatriculacion(e.target.value)} className={claseInput}>
                  {anios.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="itp-dgt" className={claseLabel}>{t('dgtLabel')}</label>
                <select id="itp-dgt" value={etiquetaDGT} onChange={e => setEtiquetaDGT(e.target.value)} className={claseInput}>
                  <option value="">{t('noDgtLabel')}</option>
                  {ETIQUETAS_DGT.map(e => (
                    <option key={e} value={e}>{etiquetaLabel[e]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="itp-cv" className={claseLabel}>{t('fiscalHp')}</label>
                <input
                  id="itp-cv"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={99}
                  placeholder={t('exampleHp')}
                  value={cvFiscales}
                  onChange={e => setCvFiscales(e.target.value)}
                  className={claseInput}
                />
                <p className="text-[11px] text-gray-500 mt-1">{t('hpHint')}</p>
              </div>
              <div>
                <label htmlFor="itp-cc" className={claseLabel}>{t('engineSize')}</label>
                <input
                  id="itp-cc"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={100}
                  placeholder={t('exampleCc')}
                  value={cilindrada}
                  onChange={e => setCilindrada(e.target.value)}
                  className={claseInput}
                />
                <p className="text-[11px] text-gray-500 mt-1">{t('engineHint')}</p>
              </div>
            </div>

            <div>
              <label htmlFor="itp-tablas" className={claseLabel}>
                {t('officialValue')} <span className="font-normal text-gray-500">{t('optional')}</span>
              </label>
              <div className="relative">
                <input
                  id="itp-tablas"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1000}
                  placeholder={t('officialPlaceholder')}
                  value={valorTablas}
                  onChange={e => setValorTablas(e.target.value)}
                  className={`${claseInput} pr-10`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">€</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {t('officialHint')}
              </p>
            </div>
          </div>
        </div>

        {/* ── Resultado ────────────────────────────────────────────── */}
        <div className="p-5 sm:p-6 bg-gray-50/60">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{t('estimated')}</p>
          <p className="text-4xl font-black text-brand-primary mt-1">{formatPrecioObligatorio(resultado.cuota)}</p>

          <dl className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-gray-600">{t('age')}</dt>
              <dd className="font-semibold text-gray-900">{t('ageDetail', { years: resultado.edadAnios, percent: Math.round(resultado.coeficiente * 100) })}</dd>
            </div>
            {resultado.valorFiscal != null && (
              <div className="flex justify-between gap-3">
                <dt className="text-gray-600">{t('fiscalValue')}</dt>
                <dd className="font-semibold text-gray-900">{formatPrecioObligatorio(resultado.valorFiscal)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-gray-600">{t('taxableBase')}</dt>
              <dd className="font-semibold text-gray-900">{formatPrecioObligatorio(resultado.baseImponible)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-gray-600">{t('rate')}</dt>
              <dd className="font-semibold text-gray-900">
                {resultado.cuotaFija ? t('flatFee') : `${resultado.tipoAplicado} %`}
                {resultado.sinAutoliquidar && ` ${t('noFiling')}`}
              </dd>
            </div>
            <div className="flex justify-between gap-3 pt-2 border-t border-gray-200">
              <dt className="text-gray-600">{t('dgtFee')}</dt>
              <dd className="font-semibold text-gray-900">{formatPrecioObligatorio(TASA_DGT)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-bold text-gray-900">{t('total')}</dt>
              <dd className="font-black text-brand-primary">{formatPrecioObligatorio(totalOperacion)}</dd>
            </div>
          </dl>

          <div className="mt-4 space-y-2">
            {textos.avisos.map(aviso => (
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
            {t(verDetalle ? 'hideSteps' : 'showSteps')}
          </button>
          {verDetalle && (
            <ol className="mt-2 space-y-1.5 text-xs text-gray-700 list-decimal list-inside">
              {textos.reglas.map((regla, index) => <li key={resultado.reglas[index].clave + index}>{regla}</li>)}
            </ol>
          )}

          <p className="mt-4 text-[11px] text-gray-500 flex items-start gap-1.5">
            <Info size={12} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            {t('estimateNote', { reviewed: REVISADO_EN })}{' '}
            <a href={resultado.comunidad.fuente} target="_blank" rel="noopener noreferrer" className="underline hover:text-brand-primary inline-flex items-center gap-0.5">
              {t('regionalOffice', { region: resultado.comunidad.nombre })} <ExternalLink size={10} />
            </a>
          </p>
        </div>
      </div>

      {/* ── Comparativa entre comunidades ─────────────────────────── */}
      {!compacta && (
        <div className="border-t border-gray-100 p-5 sm:p-6">
          <h3 className="font-bold text-gray-900 mb-1">{t('comparisonTitle')}</h3>
          <p className="text-sm text-gray-600 mb-4">
            {t('comparisonDesc', { min: formatPrecioObligatorio(comparativa[0]?.cuota || 0), minRegion: comparativa[0]?.comunidad.nombre || '', max: formatPrecioObligatorio(comparativa[comparativa.length - 1]?.cuota || 0), maxRegion: comparativa[comparativa.length - 1]?.comunidad.nombre || '', difference: ahorroMaximo > 0 ? t('difference', { amount: formatPrecioObligatorio(ahorroMaximo) }) : '' })}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">{t('tableCaption')}</caption>
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                  <th scope="col" className="py-2 pr-3">{t('community')}</th>
                  <th scope="col" className="py-2 pr-3">{t('generalRate')}</th>
                  <th scope="col" className="py-2 pr-3 text-right">{t('estimated')}</th>
                  <th scope="col" className="py-2 text-right">{t('detail')}</th>
                </tr>
              </thead>
              <tbody>
                {comparativa.map(fila => (
                  <tr key={fila.comunidad.slug} className={`border-b border-gray-50 ${fila.comunidad.slug === ccaa ? 'bg-brand-accent/5 font-semibold' : ''}`}>
                    <td className="py-2 pr-3 text-gray-800">{fila.comunidad.nombre}</td>
                    <td className="py-2 pr-3 text-gray-500">{fila.comunidad.tipo} %</td>
                    <td className="py-2 pr-3 text-right text-gray-900">
                      {fila.sinAutoliquidar ? t('noFilingShort') : fila.cuotaFija ? t('flatFeeShort', { amount: formatPrecioObligatorio(fila.cuota) }) : formatPrecioObligatorio(fila.cuota)}
                    </td>
                    <td className="py-2 text-right">
                      <LocalLink href={`/calcular-itp/${fila.comunidad.slug}`} className="text-xs font-semibold text-brand-primary hover:underline">
                        {t('view')}
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
              {t('verified')}
            </LocalLink>
            <LocalLink
              href="/publicar"
              className="inline-flex items-center gap-2 bg-white border border-gray-300 text-gray-800 text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-gray-50 transition"
            >
              {t('sell')}
            </LocalLink>
          </div>
        </div>
      )}

      {/* ── Checklist camper ──────────────────────────────────────── */}
      {!compacta && (
        <div className="border-t border-gray-100 p-5 sm:p-6">
          <h3 className="font-bold text-gray-900 mb-3">{t('checklistTitle')}</h3>
          <ul className="grid sm:grid-cols-2 gap-3">
            {checklist.map(item => (
              <li key={item.titulo} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                <p className="text-sm font-semibold text-gray-900">{item.titulo}</p>
                <p className="text-xs text-gray-600 mt-1">{item.detalle}</p>
                <p className="text-[11px] text-gray-500 mt-1.5">📄 {item.donde}</p>
              </li>
            ))}
          </ul>
          <LocalLink href="/compra-segura-camper" className="mt-3 inline-block text-xs font-bold text-brand-primary hover:underline">
            {t('checklistLink')}
          </LocalLink>
        </div>
      )}
    </div>
  )
}
