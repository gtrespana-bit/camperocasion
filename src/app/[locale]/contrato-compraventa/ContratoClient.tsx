'use client'

/**
 * Generador del contrato (isla cliente de /contrato-compraventa).
 *
 * - Prefill desde `?producto=<slug>` leyendo el anuncio público con el cliente
 *   anon (solo columnas públicas; la matrícula y el bastidor NO son públicas y
 *   las escribe el vendedor a mano).
 * - Vista previa del documento en vivo y `window.print()` para guardarlo como
 *   PDF. Los datos NUNCA salen del navegador.
 * - El texto del contrato siempre en español (documento legal); los rótulos de
 *   la interfaz también: esta página no se traduce (igual que la calculadora
 *   de ITP).
 */

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileDown, Loader2, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  FORMAS_PAGO,
  contratoCompleto,
  datosContratoPorDefecto,
  normalizarDatosContrato,
  parrafosContrato,
  prefillDesdeProducto,
  type DatosContrato,
  type ParteContrato,
} from '@/lib/contrato'

function CampoParte({
  titulo,
  parte,
  onChange,
}: {
  titulo: string
  parte: ParteContrato
  onChange: (p: ParteContrato) => void
}) {
  return (
    <fieldset className="bg-white border border-gray-100 rounded-2xl p-4">
      <legend className="text-sm font-black text-gray-900 px-1">{titulo}</legend>
      <div className="grid sm:grid-cols-2 gap-3 mt-2">
        <input
          value={parte.nombre}
          onChange={(e) => onChange({ ...parte, nombre: e.target.value })}
          placeholder="Nombre y apellidos"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
          autoComplete="off"
        />
        <input
          value={parte.dni}
          onChange={(e) => onChange({ ...parte, dni: e.target.value })}
          placeholder="DNI / NIE"
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
          autoComplete="off"
        />
      </div>
      <input
        value={parte.domicilio}
        onChange={(e) => onChange({ ...parte, domicilio: e.target.value })}
        placeholder="Domicilio completo"
        className="mt-3 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
        autoComplete="off"
      />
    </fieldset>
  )
}

export default function ContratoClient() {
  const searchParams = useSearchParams()
  const productoParam = searchParams?.get('producto') || ''
  const [datos, setDatos] = useState<DatosContrato>(datosContratoPorDefecto())
  const [cargandoProducto, setCargandoProducto] = useState(false)
  const [avisoProducto, setAvisoProducto] = useState('')

  // Prefill desde el anuncio (si el parámetro llega): una sola lectura pública.
  useEffect(() => {
    if (!productoParam) return
    let cancelado = false
    ;(async () => {
      setCargandoProducto(true)
      setAvisoProducto('')
      try {
        const columna = /^[0-9a-f-]{36}$/i.test(productoParam) ? 'id' : 'slug'
        const { data, error } = await supabase
          .from('productos')
          .select('titulo, marca, modelo, precio_usd, especificaciones')
          .eq(columna, productoParam)
          .maybeSingle()
        if (cancelado) return
        if (error || !data) {
          setAvisoProducto('No hemos podido precargar los datos del anuncio: rellénalos a mano.')
        } else {
          setDatos((prev) => ({ ...prev, ...prefillDesdeProducto(data as any) }))
        }
      } catch {
        if (!cancelado) {
          setAvisoProducto('No hemos podido precargar los datos del anuncio: rellénalos a mano.')
        }
      } finally {
        if (!cancelado) setCargandoProducto(false)
      }
    })()
    return () => {
      cancelado = true
    }
  }, [productoParam])

  const normalizados = useMemo(() => normalizarDatosContrato(datos), [datos])
  const parrafos = useMemo(() => parrafosContrato(normalizados), [normalizados])
  const listo = contratoCompleto(datos)

  function set<K extends keyof DatosContrato>(k: K, v: DatosContrato[K]) {
    setDatos((prev) => ({ ...prev, [k]: v }))
  }

  return (
    <div>
      {cargandoProducto && (
        <p className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Precargando datos del anuncio…
        </p>
      )}
      {avisoProducto && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">{avisoProducto}</p>}

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Formulario */}
        <div className="space-y-4">
          <CampoParte titulo="El vendedor" parte={datos.vendedor} onChange={(p) => set('vendedor', p)} />
          <CampoParte titulo="El comprador" parte={datos.comprador} onChange={(p) => set('comprador', p)} />

          <fieldset className="bg-white border border-gray-100 rounded-2xl p-4">
            <legend className="text-sm font-black text-gray-900 px-1">El vehículo</legend>
            <div className="grid sm:grid-cols-2 gap-3 mt-2">
              <input
                value={datos.vehiculo.marca}
                onChange={(e) => set('vehiculo', { ...datos.vehiculo, marca: e.target.value })}
                placeholder="Marca (Fiat, VW…)"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              />
              <input
                value={datos.vehiculo.modelo}
                onChange={(e) => set('vehiculo', { ...datos.vehiculo, modelo: e.target.value })}
                placeholder="Modelo (Ducato, California…)"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              />
              <input
                value={datos.vehiculo.matricula}
                onChange={(e) => set('vehiculo', { ...datos.vehiculo, matricula: e.target.value })}
                placeholder="Matrícula (1234 ABC)"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              />
              <input
                value={datos.vehiculo.bastidor}
                onChange={(e) => set('vehiculo', { ...datos.vehiculo, bastidor: e.target.value })}
                placeholder="Bastidor / VIN (opcional)"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              />
              <input
                value={datos.vehiculo.anio}
                onChange={(e) => set('vehiculo', { ...datos.vehiculo, anio: e.target.value })}
                placeholder="Año de matriculación"
                inputMode="numeric"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              />
              <input
                value={datos.vehiculo.kilometros}
                onChange={(e) => set('vehiculo', { ...datos.vehiculo, kilometros: e.target.value })}
                placeholder="Kilómetros"
                inputMode="numeric"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              />
            </div>
            <label className="flex items-center gap-2 mt-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={datos.vehiculo.itvVigente}
                onChange={(e) => set('vehiculo', { ...datos.vehiculo, itvVigente: e.target.checked })}
                className="accent-[#14532d]"
              />
              La ITV está vigente
            </label>
          </fieldset>

          <fieldset className="bg-white border border-gray-100 rounded-2xl p-4">
            <legend className="text-sm font-black text-gray-900 px-1">La operación</legend>
            <div className="grid sm:grid-cols-2 gap-3 mt-2">
              <input
                value={datos.precio}
                onChange={(e) => set('precio', e.target.value.replace(/[^\d.,\s]/g, ''))}
                placeholder="Precio (€)"
                inputMode="decimal"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              />
              <select
                value={datos.formaPago}
                onChange={(e) => set('formaPago', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              >
                {FORMAS_PAGO.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <input
                value={datos.lugar}
                onChange={(e) => set('lugar', e.target.value)}
                placeholder="Lugar de la firma"
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              />
              <input
                type="date"
                value={datos.fecha}
                onChange={(e) => set('fecha', e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
              />
            </div>
            <textarea
              value={datos.observaciones}
              onChange={(e) => set('observaciones', e.target.value.slice(0, 400))}
              rows={2}
              placeholder="Observaciones (opcional): entregas de llaves de casa, accesorios, reserva de matrícula…"
              className="mt-3 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
            />
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!listo}
              className="inline-flex items-center gap-2 bg-brand-primary text-white font-bold rounded-xl px-5 py-3 text-sm hover:bg-brand-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown size={16} aria-hidden="true" /> Imprimir / Guardar PDF
            </button>
            <button
              type="button"
              onClick={() => setDatos(datosContratoPorDefecto())}
              className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-600 font-semibold rounded-xl px-4 py-3 text-sm hover:bg-gray-50 transition"
            >
              <RotateCcw size={15} aria-hidden="true" /> Vaciar todo
            </button>
          </div>
          {!listo && (
            <p className="text-xs text-gray-400">
              Falta lo esencial (nombre de las partes, marca, matrícula y precio) para poder imprimir.
              El resto de huecos quedará como líneas «____» para completar a mano.
            </p>
          )}
        </div>

        {/* Vista previa del documento (también es lo que se imprime) */}
        <div className="lg:sticky lg:top-4">
          <ContratoHoja datos={normalizados} parrafos={parrafos} />
        </div>
      </div>
    </div>
  )
}

/** El documento en sí: tipografía serif, fondo blanco, como saldrá en papel. */
export function ContratoHoja({
  datos,
  parrafos,
}: {
  datos: ReturnType<typeof normalizarDatosContrato>
  parrafos: string[]
}) {
  return (
    <div
      className="contrato-hoja bg-white text-gray-900 rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 text-[13px] leading-relaxed"
      style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
    >
      <h2 className="text-center font-black uppercase tracking-wide text-base mb-1">
        Contrato de compraventa de vehículo
      </h2>
      <p className="text-center text-[11px] text-gray-500 mb-4">
        Furgoneta camper / autocaravana de ocasión · dos ejemplares
      </p>
      {parrafos.map((p, i) => (
        <p key={i} className="whitespace-pre-line text-justify mb-3">
          {p}
        </p>
      ))}

      <div className="grid grid-cols-2 gap-8 mt-10 mb-2">
        <div className="text-center text-[12px]">
          <div className="border-t border-gray-400 pt-1">EL VENDEDOR</div>
          <div className="text-gray-400 text-[11px] mt-0.5">
            {datos.vendedor.nombre || 'Firma'}
          </div>
        </div>
        <div className="text-center text-[12px]">
          <div className="border-t border-gray-400 pt-1">EL COMPRADOR</div>
          <div className="text-gray-400 text-[11px] mt-0.5">
            {datos.comprador.nombre || 'Firma'}
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * { visibility: hidden !important; }
              .contrato-hoja, .contrato-hoja * { visibility: visible !important; }
              .contrato-hoja {
                position: absolute !important;
                inset: 0 auto auto 0;
                width: 100%;
                border: none !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                padding: 0 !important;
                font-size: 12px;
              }
              @page { margin: 18mm 16mm; }
            }
          `,
        }}
      />
    </div>
  )
}
