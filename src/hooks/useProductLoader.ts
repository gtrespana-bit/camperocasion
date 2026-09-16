'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { clientCache } from '@/lib/clientCache';
import { getCatalogPageRange } from '@/lib/catalog-pagination';

interface ProductFilter {
  categoria?: string;
  subcategoria?: string;
  marca?: string;
  q?: string;
  precioMin?: string;
  precioMax?: string;
  ubicacionEstado?: string;
  ubicacionCiudad?: string;
  // Filtros técnicos camper (JSONB `especificaciones`)
  dgt?: string;
  homologacion?: string;
  combustible?: string;
  plazasViaje?: string;
  plazasDormir?: string;
  calefaccion?: string;
  [key: string]: string | number | boolean | undefined;
}

// Mapeo parámetro de URL → clave del JSONB `especificaciones`.
const CAMPOS_TECNICOS: Record<string, string> = {
  dgt: 'Distintivo Ambiental DGT',
  homologacion: 'Homologación',
  combustible: 'Combustible',
  plazasViaje: 'Plazas homologadas para viajar',
  plazasDormir: 'Plazas para dormir',
  calefaccion: 'Calefacción estacionaria',
};

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

const PAGE_COLUMNS =
  'id, slug, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, ubicacion_estado, creado_en, subcategoria, boosteado_en, destacado, destacado_hasta, vendedor_verificado';

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
        .select(PAGE_COLUMNS, { count: 'exact' })
        .eq('activo', true)
        .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado,estado_moderacion.eq.pendiente');

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

      // Filtros técnicos sobre el JSONB de especificaciones (p. ej.
      // etiqueta DGT, homologación vivienda, plazas, calefacción...).
      for (const [param, campo] of Object.entries(CAMPOS_TECNICOS)) {
        const value = filters[param];
        if (value) {
          try {
            query = query.eq(`especificaciones->>"${campo}"`, value);
          } catch {
            // Clave inválida: ignorar el filtro en lugar de romper la página
          }
        }
      }

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

      // Ordenar productos según la lógica de prioridad (boost > destacado > fecha)
      const now = new Date().toISOString();
      const sorted = (data || []).sort((a, b) => {
        const aBoost = a.boosteado_en || null;
        const bBoost = b.boosteado_en || null;
        if (aBoost && !bBoost) return -1;
        if (!aBoost && bBoost) return 1;
        if (aBoost && bBoost) return bBoost.localeCompare(aBoost);
        const aDest = a.destacado && a.destacado_hasta && a.destacado_hasta > now;
        const bDest = b.destacado && b.destacado_hasta && b.destacado_hasta > now;
        if (aDest && !bDest) return -1;
        if (!aDest && bDest) return 1;
        if (aDest && bDest) return b.destacado_hasta!.localeCompare(a.destacado_hasta!);
        return b.creado_en.localeCompare(a.creado_en);
      });

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
