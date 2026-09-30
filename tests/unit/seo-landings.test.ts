jest.mock('react', () => ({
  ...jest.requireActual('react'),
  cache: (fn: (...args: any[]) => any) => fn,
}))

import { hayAnunciosEnCiudad, hayAnunciosEnCiudadCategoria } from '@/lib/seo-landings'
import { getSubcategoriaSEO } from '@/lib/categorias-seo'

function crearQuery(resultado: { count: number | null }) {
  const llamadas: Array<[string, ...unknown[]]> = []
  const query: any = {}
  for (const metodo of ['select', 'eq', 'or']) {
    query[metodo] = (...args: unknown[]) => {
      llamadas.push([metodo, ...args])
      return query
    }
  }
  query.then = (resolve: (value: typeof resultado) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(resultado).then(resolve, reject)
  query.llamadas = llamadas
  return query
}

describe('landings locales indexables', () => {
  test('la landing de ciudad solo cuenta anuncios visibles y aprobados', async () => {
    const query = crearQuery({ count: 1 })
    const supabase = { from: jest.fn(() => query) }

    await expect(hayAnunciosEnCiudad(supabase, 'Madrid', 'Madrid')).resolves.toBe(true)
    expect(query.llamadas).toContainEqual([
      'or',
      'estado_moderacion.is.null,estado_moderacion.eq.aprobado',
    ])
    expect(query.llamadas).toContainEqual([
      'or',
      'ubicacion_ciudad.eq."Madrid",ubicacion_ciudad.eq."Madrid"',
    ])
  })

  test('la combinación ciudad/categoría resuelve el slug a la etiqueta guardada', async () => {
    const query = crearQuery({ count: 2 })
    const supabase = { from: jest.fn(() => query) }
    const subcategoria = getSubcategoriaSEO('gran-volumen')?.categoria

    await expect(
      hayAnunciosEnCiudadCategoria(supabase, 'Madrid', 'Madrid', 'gran-volumen'),
    ).resolves.toBe(true)

    expect(subcategoria).toBeTruthy()
    expect(query.llamadas).toContainEqual(['eq', 'subcategoria', subcategoria])
    expect(query.llamadas).toContainEqual([
      'or',
      'estado_moderacion.is.null,estado_moderacion.eq.aprobado',
    ])
  })

  test('un slug que no es una subcategoría indexable no declara resultados', async () => {
    const supabase = { from: jest.fn() }

    await expect(
      hayAnunciosEnCiudadCategoria(supabase, 'Madrid', 'Madrid', 'categoria-inventada'),
    ).resolves.toBe(false)
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
