import { categoriasData } from '@/lib/categorias'
import { CATEGORIAS_SEO, CATEGORIAS_SEO_LIST } from '@/lib/categorias-seo'

describe('páginas SEO de categorías', () => {
  it('cubre exactamente todas las categorías reales del catálogo', () => {
    expect(Object.keys(CATEGORIAS_SEO).sort()).toEqual(Object.keys(categoriasData).sort())
  })

  it('tiene contenido único y suficiente para cada landing', () => {
    const titles = CATEGORIAS_SEO_LIST.map((categoria) => categoria.titulo)
    const descriptions = CATEGORIAS_SEO_LIST.map((categoria) => categoria.descripcion)

    expect(new Set(titles).size).toBe(CATEGORIAS_SEO_LIST.length)
    expect(new Set(descriptions).size).toBe(CATEGORIAS_SEO_LIST.length)

    for (const categoria of CATEGORIAS_SEO_LIST) {
      expect(categoria.slug).toMatch(/^[a-z]+$/)
      expect(categoria.titulo.length).toBeGreaterThan(35)
      expect(categoria.descripcion.length).toBeGreaterThan(100)
      expect(categoria.introduccion.length).toBeGreaterThanOrEqual(2)
      expect(categoria.terminos.length).toBeGreaterThanOrEqual(5)
      expect(categoria.faq.length).toBeGreaterThanOrEqual(2)
    }
  })
})
