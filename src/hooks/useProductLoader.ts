'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { clientCache } from '@/lib/clientCache';
import { getCatalogPageRange } from '@/lib/catalog-pagination';
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

interface LoadPageOptions {
  page: number;
  pageSize: number;
  filters?: ProductFilter;
}

interface UseProductLoaderResult {
  productos: any[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  loadPage: (options: LoadPageOptions) => Promise<void>;
}

// Carga UNA página real desde el servidor usando range().
// Devuelve `totalCount` (conteo exacto) para paginar con el total real,
// no con la cantidad de filas cargadas.
export const useProductLoader = (): UseProductLoaderResult => {
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const loadPage = useCallback(async ({ page, pageSize, filters = {} }: LoadPageOptions) => {
    // Check cache first (la clave incluye página y tamaño)
    const cacheKey = clientCache.generateKey({ ...filters, pagina: page, limite: pageSize });
    const cachedData = clientCache.get<any>(cacheKey);

    if (cachedData) {
      setProductos(cachedData.productos);
      setTotalCount(cachedData.totalCount);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('productos')
        .select(CATALOG_PRODUCT_COLUMNS, { count: 'exact' })
        .eq('activo', true)
        .or(CATALOG_FILTRO_MODERACION);

      if (filters.categoria) {
        // maybeSingle(): si la categoría no existe en la tabla, single()
        // devolvería HTTP 406. Con maybeSingle() son 0 filas y ya está.
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

      // Filtros técnicos (DGT, homologación, plazas, baño, autonomía, medidas…)
      // en una sola condición de contención JSONB cubierta por el índice GIN.
      query = aplicarFiltrosTecnicos(query, filters);

      // Página real desde el servidor. El mismo tamaño se comparte con el
      // SSR inicial para no dejar filas sin mostrar entre páginas.
      const { from, to } = getCatalogPageRange(page, pageSize);
      query = query
        .order('creado_en', { ascending: false })
        .range(from, to);

      const { data, count, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Mismo orden que el servidor: boost > destacado vigente > fecha
      const sorted = ordenarProductosCatalogo((data || []) as ProductoCatalogo[]);

      setProductos(sorted);
      setTotalCount(count ?? 0);

      // Save to cache
      clientCache.set(cacheKey, {
        productos: sorted,
        totalCount: count ?? 0
      });
    } catch (err) {
      console.error('Error loading products:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setProductos([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    productos,
    loading,
    error,
    totalCount,
    loadPage
  };
};
