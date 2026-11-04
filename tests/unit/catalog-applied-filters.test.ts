import { catalogAppliedFilters, withoutCatalogFilter } from '@/lib/catalog-applied-filters'
import es from '@/i18n/dictionaries/es.json'
import en from '@/i18n/dictionaries/en.json'

const translate = (locale: 'es' | 'en') => (key: string): string => {
  const value = key.split('.').reduce<any>((node, part) => node?.[part], locale === 'es' ? es : en)
  return typeof value === 'string' ? value : key
}

test('applied chips expose search, location, verification and technical conditions in both languages', () => {
  const params = new URLSearchParams('q=camper&estado=Madrid&ciudad=Alcalá&verificada=1&dgt=ECO&kmMax=90000')
  for (const locale of ['es', 'en'] as const) {
    const chips = catalogAppliedFilters(params, translate(locale))
    expect(chips.map(chip => chip.key)).toEqual(['q', 'estado', 'ciudad', 'verificada', 'dgt', 'kmMax'])
    expect(chips.find(chip => chip.key === 'dgt')?.label).toContain(translate(locale)('catalog.filters.dgt'))
  }
})

test('removing a chip keeps other conditions, resets pagination and clears a dependent city', () => {
  const params = new URLSearchParams('q=camper&estado=Madrid&ciudad=Alcalá&dgt=ECO&pagina=4&orden=precio')
  const withoutLocation = new URLSearchParams(withoutCatalogFilter(params, 'estado'))
  expect(withoutLocation.get('estado')).toBeNull()
  expect(withoutLocation.get('ciudad')).toBeNull()
  expect(withoutLocation.get('pagina')).toBeNull()
  expect(withoutLocation.get('q')).toBe('camper')
  expect(withoutLocation.get('dgt')).toBe('ECO')
  expect(withoutLocation.get('orden')).toBe('precio')

  const withoutQuery = new URLSearchParams(withoutCatalogFilter(params, 'q'))
  expect(withoutQuery.get('estado')).toBe('Madrid')
  expect(withoutQuery.get('ciudad')).toBe('Alcalá')
})

test('empty-state recovery copy is present in both languages', () => {
  for (const locale of [es, en]) {
    expect(locale.catalog.emptyFiltered).toBeTruthy()
    expect(locale.catalog.emptyFilteredHint).toBeTruthy()
    expect(locale.catalog.emptyUnfiltered).toBeTruthy()
    expect(locale.catalog.removeApplied).toContain('{filter}')
  }
})
