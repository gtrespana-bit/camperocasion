'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { XCircle } from 'lucide-react';
import { categoriasData, FAMILIAS } from '@/lib/categorias';
import {
  GRUPOS_FILTROS_TECNICOS,
  type FiltrosTecnicos,
} from '@/lib/filtros-tecnicos'
import { hayFiltrosRango } from '@/lib/filtros-tecnicos'
import { FILTRO_VERIFICADA_PARAM } from '@/lib/catalog-consulta';
import { FiltrosTecnicosPanel } from './FiltrosTecnicosPanel';
import { SelectorMarca } from './SelectorMarca';

interface CatalogFiltersProps {
  subcategoria: string;
  marca: string;
  precioMin: string;
  precioMax: string;
  ubicacionEstado: string;
  ubicacionCiudad: string;
  /**
   * Filtros técnicos activos (param → valor), leídos con
   * `leerFiltrosTecnicos(searchParams)`. El listado de filtros disponibles lo
   * define el registro `@/lib/filtros-tecnicos`.
   */
  filtrosTecnicos: FiltrosTecnicos;
  /** Rangos numéricos activos tal como están en la URL (param → "150000"). */
  rangos: Record<string, string>;
  /** '1' cuando solo se muestran anuncios con homologación verificada. */
  verificada: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const selectClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent';
const labelClass = 'block text-sm font-bold text-gray-900 mb-1.5';

export const CatalogFilters = ({
  subcategoria,
  marca,
  precioMin,
  precioMax,
  ubicacionEstado,
  ubicacionCiudad,
  filtrosTecnicos,
  rangos,
  verificada,
  t,
}: CatalogFiltersProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Marketplace 100% camper: no hay selector de categoría (solo existe
  // `camper` y ya se aplica implícitamente). La navegación la organizan las
  // familias → tipos → marca/modelo.
  const subs = categoriasData.camper.subs;
  // Con subcategoría elegida solo se ofrecen los modelos aptos para ella:
  // una Benimar no tiene sentido filtrando furgones de Gran Volumen.
  const subActiva = subcategoria ? subs.find(s => s.label === subcategoria) : undefined;
  const modelosMarca = subActiva ? subActiva.marcas : subs.flatMap(s => s.marcas || []);

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };

  const hasActiveFilters = !!(
    subcategoria || marca || precioMin || precioMax ||
    ubicacionEstado || ubicacionCiudad || verificada ||
    GRUPOS_FILTROS_TECNICOS.some(g => g.filtros.some(f => filtrosTecnicos[f.param])) ||
    hayFiltrosRango(rangos)
  );

  return (
    // En escritorio la columna de filtros es sticky: al crecer con los bloques
    // técnicos se le da scroll propio para que el pie (limpiar filtros) siga
    // siendo alcanzable sin perder la posición en el listado.
    <div className="bg-white rounded-xl p-5 shadow-sm sticky top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
      <h3 className="font-bold text-lg text-gray-900 mb-4">🔍 {t('catalog.filtersTitle')}</h3>

      {/* Tipo de vehículo: los 7 tipos agrupados por familia (Campers /
          Autocaravanas / Overland), siempre visible. */}
      <div className="mb-4">
        <label htmlFor="filter-subcategoria" className={labelClass}>
          {t('catalog.typeLabel')}
        </label>
        <select
          id="filter-subcategoria"
          value={subcategoria}
          onChange={e => setParam('subcategoria', e.target.value)}
          className={selectClass}
        >
          <option value="">{t('catalog.allTypes')}</option>
          {FAMILIAS.map(f => (
            <optgroup key={f.key} label={`${f.icon} ${t(`familias.${f.key}.label`)}`}>
              {f.subs.map(slug => {
                const s = subs.find(x => x.slug === slug);
                if (!s) return null;
                return (
                  <option key={s.label} value={s.label}>
                    {s.icon} {s.label}
                  </option>
                );
              })}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between">
          <label htmlFor="filter-marca" className={labelClass}>
            {t('catalog.brandLabel')}
          </label>
          {marca && (
            <button
              onClick={() => setParam('marca', '')}
              className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
            >
              <XCircle size={12} /> {t('catalog.remove')}
            </button>
          )}
        </div>
        <SelectorMarca
          id="filter-marca"
          value={marca}
          modelos={modelosMarca}
          allLabel={t('catalog.allBrands')}
          onChange={v => setParam('marca', v)}
          className={selectClass}
        />
      </div>

      <div className="mb-4">
        <label htmlFor="filter-precio-min" className={labelClass}>
          {t('catalog.priceEur')}
        </label>
        <div className="flex gap-2">
          <input
            id="filter-precio-min"
            type="number"
            value={precioMin}
            onChange={e => setParam('precioMin', e.target.value)}
            placeholder={t('catalog.min')}
            min="0"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
          />
          <input
            type="number"
            value={precioMax}
            onChange={e => setParam('precioMax', e.target.value)}
            placeholder={t('catalog.max')}
            min="0"
            aria-label={t('catalog.max')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
          />
        </div>
      </div>

      {/* Filtro de confianza: solo anuncios con el expediente del vehículo ya
          revisado. Es el único que no vive en el JSONB `especificaciones`. */}
      <label
        htmlFor="filter-verificada"
        className="flex items-center gap-2 mb-5 text-sm font-medium text-gray-800 cursor-pointer"
      >
        <input
          id="filter-verificada"
          type="checkbox"
          checked={!!verificada}
          onChange={e => setParam(FILTRO_VERIFICADA_PARAM, e.target.checked ? '1' : '')}
          className="h-4 w-4 rounded border-gray-300 text-brand-accent focus:ring-brand-accent"
        />
        {t('catalog.filters.verified')}
      </label>

      {/* Bloques técnicos de la ficha camper + rangos numéricos: la lista de
          filtros, sus opciones y los rangos salen del registro único
          @/lib/filtros-tecnicos, el mismo dato que captura /publicar (captura
          y filtro no pueden divergir). El panel es el mismo componente que usa
          /buscar. */}
      <FiltrosTecnicosPanel
        filtrosTecnicos={filtrosTecnicos}
        rangos={rangos}
        t={t}
        onSetParam={setParam}
      />

      {hasActiveFilters && (
        <button
          onClick={() => router.push(pathname)}
          className="w-full text-sm text-red-500 hover:text-red-700 py-2 border border-red-200 rounded-lg hover:bg-red-50 transition flex items-center justify-center gap-1"
        >
          <XCircle size={14} /> {t('catalog.clearFilters')}
        </button>
      )}
    </div>
  );
};
