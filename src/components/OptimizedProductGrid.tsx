'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProductCardLazy } from './ProductCardLazy';

interface Producto {
  id: string;
  slug?: string | null;
  titulo: string;
  precio_usd: number;
  estado: string;
  imagen_url: string | null;
  ubicacion_ciudad: string | null;
  ubicacion_estado: string | null;
  creado_en: string;
  subcategoria: string | null;
  boosteado_en: string | null;
  destacado: boolean;
  destacado_hasta: string | null;
  vendedor_verificado: boolean | null;
}

interface OptimizedProductGridProps {
  productos: Producto[];
  t: (key: string) => string;
  currentPage: number;
  itemsPerPage: number;
}

export const OptimizedProductGrid = ({ 
  productos, 
  t, 
  currentPage,
  itemsPerPage
}: OptimizedProductGridProps) => {

  // Renderizar productos con carga diferida
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {productos.map((p, index) => (
        <ProductCardLazy
          key={`${p.id}-${currentPage}`}
          p={p}
          t={t}
          priority={index === 0 && currentPage === 1} // Prioridad solo para el primer producto de la primera página
        />
      ))}
    </div>
  );
};