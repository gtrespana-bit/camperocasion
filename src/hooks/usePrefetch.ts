'use client';

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { clientCache } from '@/lib/clientCache';
import {
  CATALOG_PRODUCT_COLUMNS,
  CATALOG_FILTRO_MODERACION,
  ordenarProductosCatalogo,
  ProductoCatalogo,
} from '@/lib/catalog-consulta';
import { aplicarFiltrosTecnicos } from '@/lib/filtros-tecnicos';

interface ProductFilter {
  categoria?: string;
  subcategoria?: string;
  marca?: string;
  q?: string;
  precioMin?: string;
  precioMax?: string;
  ubicacionEstado?: string;
  ubicacionCiudad?: string;
  // Filtros técnicos camper: parámetro del registro `filtros-tecnicos` → valor.
  [key: string]: string | number | boolean | undefined;
}

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
    filters: ProductFilter = {}
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

    try {
      let query = supabase
        .from('productos')
        .select(CATALOG_PRODUCT_COLUMNS, { count: 'exact' })
        .eq('activo', true)
        .or(CATALOG_FILTRO_MODERACION);

      if (filters.categoria) {
        // maybeSingle(): evita el 406 de single() con cero filas.
        const { data: catRow } = await supabase
          .from('categorias')
          .select('id')
          .eq('nombre', filters.categoria)
          .maybeSingle();
        if (catRow) {
          query = query.eq('categoria_id', catRow.id);
        }
      }

      if (filters.subcategoria) {
        query = query.eq('subcategoria', filters.subcategoria);
      }

      if (filters.marca) {
        query = query.eq('marca', filters.marca);
      }

      if (filters.q) {
        query = query.textSearch('search_vector', filters.q, { config: 'spanish', type: 'plain' });
      }

      if (filters.ubicacionCiudad) {
        query = query.eq('ubicacion_ciudad', filters.ubicacionCiudad);
      } else if (filters.ubicacionEstado) {
        query = query.eq('ubicacion_estado', filters.ubicacionEstado);
      }

      if (filters.precioMin) {
        query = query.gte('precio_usd', parseFloat(filters.precioMin));
      }
      if (filters.precioMax) {
        query = query.lte('precio_usd', parseFloat(filters.precioMax));
      }

      // Mismos filtros técnicos que el loader (contención JSONB, índice GIN).
      query = aplicarFiltrosTecnicos(query, filters);

      // Aplicar offset para la página específica
      const offset = (page - 1) * itemsPerPage;
      query = query.order('creado_en', { ascending: false })
                   .range(offset, offset + itemsPerPage - 1);

      const { data, count, error } = await query;

      if (error) {
        console.error('Error prefetching page:', error);
        return;
      }

      // Guardar en caché ya ordenado: un acierto de caché no vuelve a ordenar.
      const ordenados = ordenarProductosCatalogo((data || []) as ProductoCatalogo[]);

      clientCache.set(cacheKey, {
        productos: ordenados,
        totalCount: count ?? 0
      });
    } catch (error) {
      console.error('Error prefetching page:', error);
    }
  }, []);

  return { prefetchPage };
};
