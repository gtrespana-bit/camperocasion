import { FILTROS_TECNICOS, RANGOS_NUMERICOS } from '@/lib/filtros-tecnicos'
import { FILTRO_VENDEDOR_PARAM, FILTRO_VERIFICADA_PARAM } from '@/lib/catalog-consulta'

export type AppliedFilter = { key: string; label: string }
type Translate = (key: string) => string

/** One visible chip for each URL filter. Keep the same parameter names used by
 * the catalog loader, so removing a chip never silently drops another filter. */
export function catalogAppliedFilters(params: URLSearchParams, t: Translate): AppliedFilter[] {
  const chips: AppliedFilter[] = []
  const add = (key: string, label: string) => {
    const value = params.get(key)
    if (value) chips.push({ key, label: `${label}: ${value}` })
  }

  add('q', t('catalog.search'))
  add('categoria', t('catalog.category'))
  add('subcategoria', t('catalog.typeLabel'))
  add('marca', t('catalog.brandLabel'))
  add('precioMin', `${t('catalog.priceEur')} ${t('catalog.min')}`)
  add('precioMax', `${t('catalog.priceEur')} ${t('catalog.max')}`)
  add('estado', t('catalog.state'))
  add('ciudad', t('catalog.municipality'))
  if (params.get(FILTRO_VERIFICADA_PARAM)) chips.push({ key: FILTRO_VERIFICADA_PARAM, label: t('catalog.filters.verified') })
  add(FILTRO_VENDEDOR_PARAM, t('catalog.whoSells'))
  for (const filtro of FILTROS_TECNICOS) add(filtro.param, t(filtro.i18n))
  for (const rango of RANGOS_NUMERICOS) add(rango.param, t(rango.i18n))
  return chips
}

/** Remove exactly one condition; reset pagination and dependent municipality. */
export function withoutCatalogFilter(params: URLSearchParams, key: string): string {
  const next = new URLSearchParams(params)
  next.delete(key)
  next.delete('pagina')
  if (key === 'estado') next.delete('ciudad')
  return next.toString()
}
