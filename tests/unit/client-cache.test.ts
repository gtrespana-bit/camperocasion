/**
 * Regresiones sobre la clave de caché del catálogo (auditoría punto 6) y sobre
 * el reintento sin rangos (que SÍ podía envenenar la caché de verdad).
 */
import { clientCache } from '@/lib/clientCache'
import { quitarRangos } from '@/lib/catalog-consulta'

describe('clave de caché del catálogo', () => {
  it('es genérica: un filtro NUEVO cambia la clave sin tocar usePrefetch', () => {
    const base = { pagina: 1, limite: 12, categoria: 'camper' }
    const conFiltroNuevo = clientCache.generateKey({ ...base, filtroQueAnadeManana: 'si' })
    const sinFiltroNuevo = clientCache.generateKey(base)

    expect(conFiltroNuevo).not.toBe(sinFiltroNuevo)
  })

  it('no depende del orden de las claves y distingue valores', () => {
    expect(clientCache.generateKey({ a: '1', b: '2' })).toBe(clientCache.generateKey({ b: '2', a: '1' }))
    expect(clientCache.generateKey({ a: '1' })).not.toBe(clientCache.generateKey({ a: '2' }))
  })

  it('quitar los rangos produce una clave DISTINTA (no se cachea bajo la original)', () => {
    const filtros = { kmMax: 150000, anioMin: 2019, dgt: 'ECO' }
    const degradados = quitarRangos(filtros)
    expect(degradados).toEqual({ dgt: 'ECO' })
    expect(clientCache.generateKey({ ...degradados, pagina: 1, limite: 12 }))
      .not.toBe(clientCache.generateKey({ ...filtros, pagina: 1, limite: 12 }))
  })
})
