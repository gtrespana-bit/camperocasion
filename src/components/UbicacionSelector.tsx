'use client'

import { ESTADOS, getMunicipiosNombres, getMunicipios, Municipio } from '@/lib/ubicaciones'

interface UbicacionSelectorProps {
  estado: string
  ciudad: string  // se mantiene como "ciudad" para compatibilidad, pero ahora es el municipio
  onChange: (estado: string, ciudad: string) => void
  showCapital?: boolean  // mostrar la capital del municipio como hint
}

export default function UbicacionSelector({ estado, ciudad, onChange, showCapital = false }: UbicacionSelectorProps) {
  const municipios = estado ? getMunicipiosNombres(estado) : []
  const todosProvincias = estado ? getMunicipios(estado) : []

  // Encontrar la capital del municipio seleccionado para mostrar como hint
  const capitalSeleccionada = showCapital && estado && ciudad 
    ? todosProvincias.find(m => m.nombre === ciudad)?.capital 
    : null

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      {/* ✅ ACCESIBILIDAD: h3 → h2 para orden secuencial */}
      <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
        📍 Ubicación en España
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* ✅ ACCESIBILIDAD: htmlFor + id para vincular label con select */}
        <div>
          <label htmlFor="ubicacion-estado" className="block text-xs font-medium text-gray-700 mb-1">Comunidad Autónoma</label>
          <select
            id="ubicacion-estado"
            value={estado}
            onChange={(e) => { onChange(e.target.value, '') }}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
          >
            <option value="">Toda España</option>
            {ESTADOS.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>

        {/* ✅ ACCESIBILIDAD: htmlFor + id para vincular label con select */}
        <div>
          <label htmlFor="ubicacion-municipio" className="block text-xs font-medium text-gray-700 mb-1">
            Provincia
          </label>
          <select
            id="ubicacion-municipio"
            value={ciudad}
            onChange={(e) => { onChange(estado, e.target.value) }}
            disabled={!estado}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent disabled:bg-gray-100 disabled:text-gray-500"
          >
            <option value="">Todas las provincias</option>
            {municipios.map((m) => (
              <option key={m} value={m}>
                {m}
                {capitalSeleccionada === m && showCapital ? ` (${getMunicipios(estado).find(x => x.nombre === m)?.capital || ''})` : ''}
              </option>
            ))}
          </select>
          {capitalSeleccionada && (
            <p className="text-xs text-gray-500 mt-1">Capital: {capitalSeleccionada}</p>
          )}
        </div>

        {/* Limpiar */}
        {(estado || ciudad) && (
          <button
            onClick={() => onChange('', '')}
            aria-label="Limpiar filtro de ubicación"
            className="col-span-1 sm:col-span-2 text-xs text-red-500 hover:text-red-700 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 transition text-center"
          >
            ✕ Limpiar ubicación
          </button>
        )}
      </div>
    </div>
  )
}