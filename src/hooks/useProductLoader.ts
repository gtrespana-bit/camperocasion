'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { clientCache } from '@/lib/clientCache';
import { esErrorDeCredenciales } from '@/lib/supabase-diagnostico';
import { getCatalogPageRange } from '@/lib/catalog-pagination';
import {
  CATALOG_PRODUCT_COLUMNS,
  CATALOG_FILTRO_MODERACION,
  aplicarFiltrosBase,
  ordenarProductosCatalogo,
  ProductoCatalogo,
  tieneRangosNumericos,
  quitarRangos,
  esErrorColumnasRango,
  type FiltrosCatalogo,
} from '@/lib/catalog-consulta';

interface LoadPageOptions {
  page: number;
  pageSize: number;
  filters?: FiltrosCatalogo;
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

    const ejecutar = async (filtros: FiltrosCatalogo) => {
      let query = supabase
        .from('productos')
        .select(CATALOG_PRODUCT_COLUMNS, { count: 'exact' })
        .eq('activo', true)
        .or(CATALOG_FILTRO_MODERACION);

      // La categoría se traduce a `categoria_id` (la columna FK), y el resto
      // de filtros se aplica con el helper compartido (mismo contrato que el
      // SSR inicial y el prefetch).
      if (filtros.categoria) {
        // maybeSingle(): si la categoría no existe en la tabla, single()
        // devolvería HTTP 406. Con maybeSingle() son 0 filas y ya está.
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

      const { from, to } = getCatalogPageRange(page, pageSize);
      query = query
        .order('creado_en', { ascending: false })
        .range(from, to);

      return await query;
    };

    try {
      let result = await ejecutar(filters);

      // Plan B: si la base de datos todavía no tiene las columnas generadas de
      // rangos (migración 202609170003 sin aplicar), la query con rangos falla.
      // Reintentamos SIN rangos: el resto de filtros sigue funcionando.
      if (result.error && esErrorColumnasRango(result.error) && tieneRangosNumericos(filters)) {
        result = await ejecutar(quitarRangos(filters) as FiltrosCatalogo);
      }

      const { data, count, error: fetchError } = result;

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
      // Fallo de credenciales (clave rotada/caducada/de otro proyecto): se
      // avisa con un prefijo filtrable en los logs. La UI NO debe enseñar
      // "Invalid API key" al visitante; eso lo hace CatalogoPage con un texto
      // traducido y amable (ver src/lib/supabase-diagnostico.ts).
      if (esErrorDeCredenciales(err)) {
        console.error(
          '[supabase-credenciales] Supabase rechazó NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
            'Compruébalo en /api/diagnostico/supabase?token=<CRON_SECRET>.',
        );
      }
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
