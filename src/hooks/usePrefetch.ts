'use client';

import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { clientCache } from '@/lib/clientCache';

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
}

// Mismos campos técnicos que useProductLoader: la caché usa las claves
// completas del filtro, así que ambos hooks deben filtrar igual.
const CAMPOS_TECNICOS: Record<string, string> = {
  dgt: 'Distintivo Ambiental DGT',
  homologacion: 'Homologación',
  combustible: 'Combustible',
  plazasViaje: 'Plazas homologadas para viajar',
  plazasDormir: 'Plazas para dormir',
  calefaccion: 'Calefacción estacionaria',
};

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
        .select('id, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, ubicacion_estado, creado_en, subcategoria, boosteado_en, destacado, destacado_hasta, vendedor_verificado', { count: 'exact' })
        .eq('activo', true)
        .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado');

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

      // Filtros técnicos sobre el JSONB de especificaciones
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

      // Aplicar offset para la página específica
      const offset = (page - 1) * itemsPerPage;
      query = query.order('creado_en', { ascending: false })
                   .range(offset, offset + itemsPerPage - 1);

      const { data, count, error } = await query;

      if (error) {
        console.error('Error prefetching page:', error);
        return;
      }

      // Guardar en caché
      clientCache.set(cacheKey, {
        productos: data,
        totalCount: count ?? 0
      });
    } catch (error) {
      console.error('Error prefetching page:', error);
    }
  }, []);

  return { prefetchPage };
};