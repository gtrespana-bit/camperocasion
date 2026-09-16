'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { XCircle } from 'lucide-react';
import {
  categoriasData,
  OPCIONES_DGT,
  OPCIONES_HOMOLOGACION,
  OPCIONES_COMBUSTIBLE,
  OPCIONES_PLAZAS_VIAJE,
  OPCIONES_PLAZAS_DORMIR,
  OPCIONES_CALEFACCION,
} from '@/lib/categorias';
import LocalLink from './LocalLink';

interface CatalogFiltersProps {
  categoria: string;
  subcategoria: string;
  marca: string;
  precioMin: string;
  precioMax: string;
  ubicacionEstado: string;
  ubicacionCiudad: string;
  dgt: string;
  homologacion: string;
  combustible: string;
  plazasViaje: string;
  plazasDormir: string;
  calefaccion: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const selectClass =
  'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent';
const labelClass = 'block text-sm font-bold text-gray-900 mb-1.5';

export const CatalogFilters = ({
  categoria,
  subcategoria,
  marca,
  precioMin,
  precioMax,
  ubicacionEstado,
  ubicacionCiudad,
  dgt,
  homologacion,
  combustible,
  plazasViaje,
  plazasDormir,
  calefaccion,
  t,
}: CatalogFiltersProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const cat = categoriasData[categoria];
  const subs = cat ? cat.subs : [];
  const allMarcas = subs.flatMap(s => s.marcas || []).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a.localeCompare(b, 'es'));

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    if (key === 'categoria') params.delete('subcategoria');
    router.push(`${pathname}?${params.toString()}`);
  };

  const hasActiveFilters = !!(
    categoria || subcategoria || marca || precioMin || precioMax ||
    ubicacionEstado || ubicacionCiudad || dgt || homologacion ||
    combustible || plazasViaje || plazasDormir || calefaccion
  );

  const select = (
    id: string,
    label: string,
    value: string,
    param: string,
    options: readonly string[],
    allLabel: string
  ) => (
    <div className="mb-4">
      <label htmlFor={id} className={labelClass}>{label}</label>
      <select id={id} value={value} onChange={e => setParam(param, e.target.value)} className={selectClass}>
        <option value="">{allLabel}</option>
        {options.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm sticky top-20">
      <h3 className="font-bold text-lg text-gray-900 mb-4">🔍 {t('catalog.filters')}</h3>

      <div className="mb-4">
        <label htmlFor="filter-categoria" className={labelClass}>
          {t('catalog.category')}
        </label>
        <select
          id="filter-categoria"
          value={categoria}
          onChange={e => setParam('categoria', e.target.value)}
          className={selectClass}
        >
          <option value="">{t('catalog.all')}</option>
          {Object.entries(categoriasData).map(([key, c]) => (
            <option key={key} value={key}>
              {c.icon} {t('catalog.categories.' + key)}
            </option>
          ))}
        </select>
      </div>

      {subs.length > 0 && (
        <div className="mb-4">
          <label htmlFor="filter-subcategoria" className={labelClass}>
            {t('catalog.subcategory')}
          </label>
          <select
            id="filter-subcategoria"
            value={subcategoria}
            onChange={e => setParam('subcategoria', e.target.value)}
            className={selectClass}
          >
            <option value="">{t('catalog.allSubs')}</option>
            {subs.map(s => (
              <option key={s.label} value={s.label}>
                {s.icon} {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {allMarcas.length > 0 && (
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
          <select
            id="filter-marca"
            value={marca}
            onChange={e => setParam('marca', e.target.value)}
            className={selectClass}
          >
            <option value="">{t('catalog.allBrands')}</option>
            {allMarcas.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}

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
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
          />
        </div>
      </div>

      <h4 className="text-xs font-black uppercase tracking-wide text-gray-400 mt-6 mb-3">
        {t('catalog.techFilters')}
      </h4>

      {select('filter-dgt', t('catalog.dgt'), dgt, 'dgt', OPCIONES_DGT, t('catalog.all'))}
      {select('filter-homologacion', t('catalog.homologation'), homologacion, 'homologacion', OPCIONES_HOMOLOGACION, t('catalog.all'))}
      {select('filter-combustible', t('catalog.fuel'), combustible, 'combustible', OPCIONES_COMBUSTIBLE, t('catalog.all'))}
      {select('filter-plazas-viaje', t('catalog.travelSeats'), plazasViaje, 'plazasViaje', OPCIONES_PLAZAS_VIAJE, t('catalog.all'))}
      {select('filter-plazas-dormir', t('catalog.sleepSeats'), plazasDormir, 'plazasDormir', OPCIONES_PLAZAS_DORMIR, t('catalog.all'))}
      {select('filter-calefaccion', t('catalog.heating'), calefaccion, 'calefaccion', OPCIONES_CALEFACCION, t('catalog.all'))}

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
