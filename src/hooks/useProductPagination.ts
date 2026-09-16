'use client';

import { useCallback } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';

interface UseProductPaginationProps {
  itemsPerPage?: number;
  initialPage?: number;
}

// Paginación reactiva: `currentPage` se deriva del parámetro `pagina` del URL
// (en vez de guardarse en estado y leerse una sola vez al montar). Así, cuando
// el componente <Pagination /> o cualquier otra parte navega con router.push,
// la página se recalcula y el grid se actualiza.
export const useProductPagination = ({
  itemsPerPage = 24,
  initialPage = 1
}: UseProductPaginationProps = {}) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const pageParam = searchParams.get('pagina');
  const pageNum = pageParam ? parseInt(pageParam, 10) : NaN;
  const currentPage = (!isNaN(pageNum) && pageNum > 0) ? pageNum : initialPage;

  const goToPage = useCallback((page: number) => {
    const target = Math.max(1, Math.floor(page));
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) {
      params.delete('pagina');
    } else {
      params.set('pagina', String(target));
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, pathname, router]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(Math.max(1, currentPage - 1));
  }, [currentPage, goToPage]);

  const calculatePagination = useCallback((totalItems: number) => {
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);

    return {
      currentPage,
      totalPages,
      itemsPerPage,
      totalItems,
      startIndex,
      endIndex,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1
    };
  }, [currentPage, itemsPerPage]);

  return {
    currentPage,
    itemsPerPage,
    goToPage,
    nextPage,
    prevPage,
    calculatePagination
  };
};
