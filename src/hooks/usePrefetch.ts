'use client';

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { clientCache } from '@/lib/clientCache';
import {
  CATALOG_PRODUCT_COLUMNS,
  CATALOG_FILTRO_MODERACION,
  aplicarFiltrosBase,
  aplicarOrdenCatalogo,
  ordenarProductosCatalogo,
  ProductoCatalogo,
  tieneRangosNumericos,
  quitarRangos,
  esErrorColumnasRango,
  type FiltrosCatalogo,
} from '@/lib/catalog-consulta';

/**
 * Precarga en segundo plano la página siguiente del catálogo.
 *
 * La caché del cliente indexa por conjunto de filtros + página, y quien
 * escribe la entrada es este hook: la consulta tiene que ser EXACTAMENTE la de
 * `useProductLoader` (mismas columnas, mismo filtro de moderación, mismo
 * orden), o el usuario vería datos distintos al cambiar de página. Por eso
 * ambos comparten `catalog-consulta.ts` y el registro `filtros-tecnicos.ts`.
 */
export const usePrefetch = () => {
  const prefetchPage = useCallback(async (
    page: number,
    itemsPerPage: number,
    filters: FiltrosCatalogo = {}
  ) => {
    // Verificar si ya está en caché
    const cacheKey = clientCache.generateKey({
      ...filters,
      pagina: page,
      limite: itemsPerPage
    });

    if (clientCache.has(cacheKey)) {
      return;
    }

    const ejecutar = async (filtros: FiltrosCatalogo) => {
      let query = supabase
        .from('productos')
        .select(CATALOG_PRODUCT_COLUMNS, { count: 'exact' })
        .eq('activo', true)
        .or(CATALOG_FILTRO_MODERACION);

      if (filtros.categoria) {
        // maybeSingle(): evita el 406 de single() con cero filas.
        const { data: catRow } = await supabase
          .from('categorias')
          .select('id')
          .eq('nombre', filtros.categoria)
          .maybeSingle();
        if (catRow) {
          query = query.eq('categoria_id', catRow.id);
        }
      }

      const { categoria: _categoria, ...resto } = filtros;
      query = aplicarFiltrosBase(query, resto) as typeof query;

      // Aplicar offset para la página específica
      const offset = (page - 1) * itemsPerPage;
      // Mismo ORDER BY que el SSR y el loader: si el prefetch ordenara
      // distinto, la caché serviría páginas incoherentes.
      query = aplicarOrdenCatalogo(query)
                   .range(offset, offset + itemsPerPage - 1) as typeof query;

      return await query;
    };

    try {
      let result = await ejecutar(filters);
      let filtrosAplicados: FiltrosCatalogo = filters;

      // Misma red de seguridad que el loader ante migración de rangos ausente.
      if (result.error && esErrorColumnasRango(result.error) && tieneRangosNumericos(filters)) {
        filtrosAplicados = quitarRangos(filters) as FiltrosCatalogo;
        result = await ejecutar(filtrosAplicados);
      }

      const { data, count, error } = result;

      if (error) {
        console.error('Error prefetching page:', error);
        return;
      }

      // Guardar en caché ya ordenado: un acierto de caché no vuelve a ordenar.
      const ordenados = ordenarProductosCatalogo((data || []) as ProductoCatalogo[]);

      // La clave tiene que describir la consulta REAL: si se reintentó sin
      // rangos, cachear bajo `cacheKey` devolvería datos sin filtrar a quien
      // pidió kmMax/anioMin (mismo criterio que useProductLoader).
      const cacheKeyResultados = filtrosAplicados === filters
        ? cacheKey
        : clientCache.generateKey({
          ...filtrosAplicados,
          pagina: page,
          limite: itemsPerPage
        });
      clientCache.set(cacheKeyResultados, {
        productos: ordenados,
        totalCount: count ?? 0
      });
    } catch (error) {
      console.error('Error prefetching page:', error);
    }
  }, []);

  return { prefetchPage };
};
