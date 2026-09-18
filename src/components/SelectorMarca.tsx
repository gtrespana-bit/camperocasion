'use client';

/**
 * Selector de marca/modelo agrupado por fabricante.
 *
 * Antes el filtro de marca era una lista plana donde "Fiat Ducato",
 * "Fiat Ducato Autocaravana" y "Volkswagen California" aparecían todos
 * mezclados. Ahora cada fabricante es un <optgroup> y dentro van sus
 * modelos: Fiat → Ducato · Doblò · Scudo…
 *
 * El valor del select sigue siendo el CANÓNICO (`m.valor`, el que está en
 * `productos.marca`), así que los `?marca=…` existentes siguen funcionando.
 */

import {
  agruparPorFabricante,
  etiquetaModelo,
  valoresUnicos,
  type MarcaModelo,
} from '@/lib/marcas';

interface SelectorMarcaProps {
  id?: string;
  /** Valor canónico activo (`productos.marca`); '' = sin filtro. */
  value: string;
  /** Modelos a ofrecer (ya filtrados por subcategoría, o todos). */
  modelos: MarcaModelo[];
  /** Texto de la opción vacía: "Todas las marcas". */
  allLabel: string;
  onChange: (valor: string) => void;
  className?: string;
  ariaLabel?: string;
}

export function SelectorMarca({
  id,
  value,
  modelos,
  allLabel,
  onChange,
  className,
  ariaLabel,
}: SelectorMarcaProps) {
  // flatMap de varias subcategorías puede repetir la misma entrada; el valor
  // canónico es único en el catálogo maestro, así que deduplicamos por él.
  const unicos = valoresUnicos(modelos).map(v => modelos.find(m => m.valor === v)!)
  const grupos = agruparPorFabricante(unicos)

  return (
    <select
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={className}
      aria-label={ariaLabel}
    >
      <option value="">{allLabel}</option>
      {grupos.map(g => {
        // Un fabricante con una única entrada sin modelo propio ('Benimar')
        // se muestra como opción directa: el optgroup no aportaría nada.
        if (g.modelos.length === 1 && !g.modelos[0].modelo) {
          const m = g.modelos[0]
          return (
            <option key={m.valor} value={m.valor}>
              {m.valor}
            </option>
          )
        }
        return (
          <optgroup key={g.fabricante} label={g.fabricante}>
            {g.modelos.map(m => (
              <option key={m.valor} value={m.valor}>
                {etiquetaModelo(m)}
              </option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )
}
