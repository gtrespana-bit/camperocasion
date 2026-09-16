'use client';

import { Suspense, lazy } from 'react';
import { LoadingIndicator } from './LoadingIndicator';

// Cargar el catálogo de forma diferida
const CatalogPageContent = lazy(() => import('@/app/[locale]/catalogo/CatalogoPage'));

interface CatalogLazyLoaderProps {
  initialProducts?: any[];
  initialCount?: number;
}

export const CatalogLazyLoader = ({ 
  initialProducts = [], 
  initialCount = 0 
}: CatalogLazyLoaderProps) => {
  return (
    <Suspense fallback={<LoadingIndicator count={12} />}>
      <CatalogPageContent 
        initialProducts={initialProducts} 
        initialCount={initialCount} 
      />
    </Suspense>
  );
};