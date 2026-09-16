import { CATALOG_PAGE_SIZE, getCatalogPageRange } from '@/lib/catalog-pagination'

describe('catalog pagination', () => {
  it('uses 24 elements consistently for the initial and subsequent pages', () => {
    expect(CATALOG_PAGE_SIZE).toBe(24)
    expect(getCatalogPageRange(1)).toEqual({ from: 0, to: 23 })
    expect(getCatalogPageRange(2)).toEqual({ from: 24, to: 47 })
  })

  it('normalizes invalid pagination input to a safe first page', () => {
    expect(getCatalogPageRange(0, 0)).toEqual({ from: 0, to: 23 })
    expect(getCatalogPageRange(Number.NaN, 10)).toEqual({ from: 0, to: 9 })
  })
})
