/**
 * Tamaño único de página para el catálogo.
 *
 * El SSR inicial y las cargas posteriores del cliente deben usar exactamente
 * el mismo valor; de otro modo pueden quedar productos entre ambas páginas.
 */
export const CATALOG_PAGE_SIZE = 24

export function getCatalogPageRange(page: number, pageSize = CATALOG_PAGE_SIZE) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0
    ? Math.floor(pageSize)
    : CATALOG_PAGE_SIZE
  const from = (safePage - 1) * safePageSize

  return { from, to: from + safePageSize - 1 }
}
