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

  const buildPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) params.delete('pagina');
    else params.set('pagina', page.toString());
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const goToPage = (page: number) => {
    router.push(buildPageUrl(page));
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
        <a
          href={currentPage > 1 ? buildPageUrl(Math.max(1, currentPage - 1)) : undefined}
          onClick={(e) => { if (currentPage <= 1) { e.preventDefault(); return; } e.preventDefault(); goToPage(Math.max(1, currentPage - 1)); }}
          aria-disabled={currentPage <= 1}
          className={`px-3 py-1 rounded-md flex items-center ${
            currentPage <= 1
              ? 'bg-gray-100 text-gray-500 cursor-not-allowed pointer-events-none'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
          aria-label="Página anterior"
          rel="prev"
        >
          <ChevronLeft size={16} />
        </a>

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
            <a
              key={item}
              href={buildPageUrl(item as number)}
              onClick={(e) => { e.preventDefault(); goToPage(item as number); }}
              className={`px-3 py-1 rounded-md inline-flex items-center justify-center ${
                currentPage === item
                  ? 'bg-brand-primary text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
              aria-current={currentPage === item ? 'page' : undefined}
              rel={currentPage === item ? undefined : (item as number) < currentPage ? 'prev' : 'next'}
            >
              {item}
            </a>
          );
        })}

        {/* Botón de siguiente página */}
        <a
          href={currentPage < totalPages ? buildPageUrl(Math.min(totalPages, currentPage + 1)) : undefined}
          onClick={(e) => { if (currentPage >= totalPages) { e.preventDefault(); return; } e.preventDefault(); goToPage(Math.min(totalPages, currentPage + 1)); }}
          aria-disabled={currentPage >= totalPages}
          className={`px-3 py-1 rounded-md flex items-center ${
            currentPage >= totalPages
              ? 'bg-gray-100 text-gray-500 cursor-not-allowed pointer-events-none'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
          aria-label="Página siguiente"
          rel="next"
        >
          <ChevronRight size={16} />
        </a>
      </div>
    </div>
  );
};