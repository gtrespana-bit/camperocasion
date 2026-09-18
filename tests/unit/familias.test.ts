/**
 * Tests de la taxonomía por familias de CamperOcasión.
 *
 * El vertical es 100% camper: la categoría única `camper` ya no se expone en
 * la UI; la navegación la organizan 3 FAMILIAS (Campers / Autocaravanas /
 * Overland) que agrupan los 7 tipos (subcategorías). Estos tests blindan la
 * coherencia de esa agrupación.
 */
import { FAMILIAS, familiaDeSub, categoriasData } from '@/lib/categorias'
import { SUBCATEGORIAS_SLUG } from '@/lib/marcas'

describe('taxonomía por familias', () => {
  test('hay exactamente 3 familias', () => {
    expect(FAMILIAS.map(f => f.key)).toEqual(['campers', 'autocaravanas', 'overland'])
  })

  test('las familias cubren los 7 tipos, sin solapes ni huecos', () => {
    const slugs = FAMILIAS.flatMap(f => f.subs)
    expect(slugs).toHaveLength(SUBCATEGORIAS_SLUG.length)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of SUBCATEGORIAS_SLUG) {
      expect(slugs).toContain(slug)
    }
  })

  test('cada slug de familia apunta a una subcategoría real', () => {
    const subSlugs = new Set(categoriasData.camper.subs.map(s => s.slug))
    for (const f of FAMILIAS) {
      for (const slug of f.subs) {
        expect(subSlugs).toContain(slug)
      }
    }
  })

  test('familiaDeSub resuelve la familia de cada tipo', () => {
    expect(familiaDeSub('gran-volumen')?.key).toBe('campers')
    expect(familiaDeSub('camper-mediana')?.key).toBe('campers')
    expect(familiaDeSub('minicamper')?.key).toBe('campers')
    expect(familiaDeSub('perfilada')?.key).toBe('autocaravanas')
    expect(familiaDeSub('capuchina')?.key).toBe('autocaravanas')
    expect(familiaDeSub('integral')?.key).toBe('autocaravanas')
    expect(familiaDeSub('overland')?.key).toBe('overland')
    expect(familiaDeSub('no-existe')).toBeUndefined()
  })

  test('la categoría única sigue siendo `camper` (compatibilidad BD)', () => {
    expect(Object.keys(categoriasData)).toEqual(['camper'])
    expect(categoriasData.camper.subs).toHaveLength(7)
  })
})
