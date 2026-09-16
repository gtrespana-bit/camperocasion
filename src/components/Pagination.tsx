'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
}

export const Pagination = ({ currentPage, totalPages, itemsPerPage, totalItems }: PaginationProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (page === 1) {
      params.delete('pagina');
    } else {
      params.set('pagina', page.toString());
    }
    
    router.push(`${pathname}?${params.toString()}`);
  };

  // No mostrar paginación si hay menos de una página
  if (totalPages <= 1) return null;

  // Generar rango de páginas a mostrar
  const getPageRange = () => {
    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | '...')[] = [];

    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  const pageRange = getPageRange();

  return (
    <div className="flex justify-center mt-8">
      <div className="flex items-center space-x-1">
        {/* Botón de página anterior */}
        <button
          onClick={() => goToPage(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className={`px-3 py-1 rounded-md flex items-center ${
            currentPage <= 1
              ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} />
        </button>

        {/* Mostrar páginas */}
        {pageRange.map((item, index) => {
          if (item === '...') {
            return (
              <span key={`ellipsis-${index}`} className="px-3 py-1 text-gray-500">
                ...
              </span>
            );
          }

          return (
            <button
              key={item}
              onClick={() => goToPage(item as number)}
              className={`px-3 py-1 rounded-md ${
                currentPage === item
                  ? 'bg-brand-primary text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
              aria-current={currentPage === item ? 'page' : undefined}
            >
              {item}
            </button>
          );
        })}

        {/* Botón de siguiente página */}
        <button
          onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className={`px-3 py-1 rounded-md flex items-center ${
            currentPage >= totalPages
              ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
          aria-label="Página siguiente"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};