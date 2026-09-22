/**
 * Tests del catálogo maestro de marcas y modelos (@/lib/marcas).
 *
 * El catálogo alimenta los filtros de marca/modelo del catálogo y del
 * buscador, el paso 2 de /publicar y la página /marcas. Estos tests blindan:
 *
 *  - Integridad: valores canónicos únicos y bien formados.
 *  - Compatibilidad: los valores antiguos que YA pueden estar guardados en
 *    `productos.marca` ('Fiat Ducato', 'Mercedes Marco Polo', 'Adria'…) no se
 *    pueden renombrar sin romper el filtro `?marca=…` de anuncios existentes.
 *  - Cobertura: cada subcategoría conserva al menos sus marcas históricas.
 *  - Agrupación: fabricante → modelo para los <optgroup> de la UI.
 */
import {
  MARCAS_MODELOS,
  SUBCATEGORIAS_SLUG,
  modelosDeSubcategoria,
  modeloPorValor,
  agruparPorFabricante,
  etiquetaModelo,
  valoresUnicos,
  fabricantesUnicos,
  resumenFabricantes,
} from '@/lib/marcas'
import { categoriasData, getMarcaOptions } from '@/lib/categorias'

describe('catálogo maestro de marcas y modelos', () => {
  test('los valores canónicos son únicos y no vacíos', () => {
    const valores = MARCAS_MODELOS.map(m => m.valor)
    expect(new Set(valores).size).toBe(valores.length)
    for (const m of MARCAS_MODELOS) {
      expect(m.valor.trim().length).toBeGreaterThan(0)
      expect(m.fabricante.trim().length).toBeGreaterThan(0)
    }
  })

  test('cada entrada es apta para al menos una subcategoría válida', () => {
    for (const m of MARCAS_MODELOS) {
      expect(m.aptoPara.length).toBeGreaterThan(0)
      for (const slug of m.aptoPara) {
        expect(SUBCATEGORIAS_SLUG).toContain(slug)
      }
    }
  })

  test('los 7 tipos camper tienen marcas y modelos', () => {
    for (const slug of SUBCATEGORIAS_SLUG) {
      expect(modelosDeSubcategoria(slug).length).toBeGreaterThanOrEqual(5)
    }
  })

  test('compatibilidad: los valores canónicos históricos siguen presentes', () => {
    const historicos = [
      // Gran volumen
      'Fiat Ducato', 'Citroën Jumper', 'Peugeot Boxer', 'Renault Master',
      'Volkswagen Crafter', 'Mercedes-Benz Sprinter', 'MAN TGE', 'Iveco Daily', 'Ford Transit',
      // Camper mediana
      'Volkswagen California', 'Volkswagen Transporter', 'Volkswagen Multivan',
      'Mercedes Marco Polo', 'Mercedes Vito', 'Ford Transit Custom',
      'Renault Trafic', 'Toyota Proace', 'Peugeot Expert Camper', 'Citroën Jumpy Camper',
      // Minicamper
      'Citroën Berlingo', 'Peugeot Rifter', 'Peugeot Partner', 'Renault Kangoo',
      'Volkswagen Caddy', 'Dacia Dokker', 'Fiat Doblò', 'Toyota Proace City',
      // Perfiladas y capuchinas (chasis carrozados)
      'Fiat Ducato Autocaravana', 'Ford Transit Autocaravana',
      'Volkswagen Crafter Autocaravana', 'Mercedes-Benz Sprinter Autocaravana',
      'Renault Master Autocaravana', 'Iveco Daily Autocaravana', 'Opel Movano Autocaravana',
      'Fiat Ducato Capuchina', 'Ford Transit Capuchina', 'Volkswagen Crafter Capuchina',
      'Renault Master Capuchina', 'Opel Movano Capuchina',
      // Integrales (fabricantes)
      'Adria', 'Hymer', 'Challenger', 'Laika', 'Swift', 'Benimar', 'Knaus', 'Niesmann + Bissel',
      // Overland
      'Toyota Hilux Overland', 'Mitsubishi L200', 'Nissan Navara', 'Volkswagen Amarok',
      'Ford Ranger', 'Land Rover Defender', 'Dacia Pik-Pik Célula', 'RAM ProMaster Célula',
    ]
    for (const valor of historicos) {
      expect(modeloPorValor(valor)).toBeDefined()
    }
  })

  test('las subcategorías conservan sus marcas históricas vía getMarcaOptions', () => {
    expect(getMarcaOptions('camper', 'Gran Volumen')).toEqual(
      expect.arrayContaining(['Fiat Ducato', 'Citroën Jumper', 'Mercedes-Benz Sprinter'])
    )
    expect(getMarcaOptions('camper', 'Minicamper')).toEqual(
      expect.arrayContaining(['Citroën Berlingo', 'Volkswagen Caddy'])
    )
    expect(getMarcaOptions('camper', 'Minicamper')).not.toContain('Fiat Ducato')
    // Las autocaravanas de fabricante ya no se confunden con las bases:
    expect(getMarcaOptions('camper', 'Autocaravana Integral')).toEqual(
      expect.arrayContaining(['Benimar', 'Hymer', 'Adria'])
    )
    expect(getMarcaOptions('camper', 'Autocaravana Integral')).not.toContain('Fiat Ducato')
  })

  test('los fabricantes de autocaravanas cubren perfiladas, capuchinas e integrales', () => {
    for (const fabricante of ['Benimar', 'Adria', 'Challenger', 'Knaus', 'Bürstner', 'Dethleffs']) {
      const entrada = MARCAS_MODELOS.find(m => m.fabricante === fabricante)
      expect(entrada).toBeDefined()
      expect(entrada!.aptoPara).toContain('perfilada')
      expect(entrada!.aptoPara).toContain('integral')
    }
  })

  test('agruparPorFabricante agrupa y ordena alfabéticamente', () => {
    const grupos = agruparPorFabricante(modelosDeSubcategoria('gran-volumen'))

    const fiat = grupos.find(g => g.fabricante === 'Fiat')
    expect(fiat).toBeDefined()
    expect(fiat!.modelos.map(etiquetaModelo)).toContain('Ducato')

    const vw = grupos.find(g => g.fabricante === 'Volkswagen')
    expect(vw).toBeDefined()

    // Orden alfabético es-ES de los grupos.
    const nombres = grupos.map(g => g.fabricante)
    expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, 'es')))

    // Dentro de un fabricante, los modelos también van ordenados.
    const valoresVw = vw!.modelos.map(etiquetaModelo)
    expect(valoresVw).toEqual([...valoresVw].sort((a, b) => a.localeCompare(b, 'es')))
  })

  test('valoresUnicos deduplica y fabricantesUnicos ordena', () => {
    const modelos = modelosDeSubcategoria('camper-mediana')
    const valores = valoresUnicos([...modelos, ...modelos])
    expect(new Set(valores).size).toBe(valores.length)

    const fabs = fabricantesUnicos(modelos)
    expect(fabs).toContain('Volkswagen')
    expect(fabs).toEqual([...fabs].sort((a, b) => a.localeCompare(b, 'es')))
  })

  test('resumenFabricantes muestra los primeros y un contador del resto', () => {
    const modelos = modelosDeSubcategoria('gran-volumen')
    const resumen = resumenFabricantes(modelos, 3)
    expect(resumen).toMatch(/\+\d+$/)
    expect(resumen).toContain(' · ')
    expect(resumenFabricantes([], 3)).toBe('')
  })

  test('categoriasData expone las marcas estructuradas de cada subcategoría', () => {
    for (const sub of categoriasData.camper.subs) {
      expect(sub.marcas.length).toBeGreaterThan(0)
      for (const m of sub.marcas) {
        expect(m.aptoPara).toContain(sub.slug)
      }
    }
  })
})

/**
 * Slugs de las páginas de modelo (/modelo/[slug]).
 *
 * Cada una de estas URLs se va a indexar y a enlazar desde /marcas y desde el
 * sitemap, así que un slug duplicado significaría dos modelos peleando por la
 * misma página, y un slug que cambie rompería enlaces ya indexados.
 */
describe('slugs de las páginas de modelo', () => {
  const { slugModelo, modeloPorSlug } = require('@/lib/marcas')

  it('todos los modelos generan un slug no vacío', () => {
    for (const m of MARCAS_MODELOS) {
      expect(slugModelo(m).length).toBeGreaterThan(2)
    }
  })

  it('los slugs son únicos (no hay dos modelos en la misma URL)', () => {
    const slugs = MARCAS_MODELOS.map(slugModelo)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('son URLs limpias: minúsculas, sin acentos ni símbolos', () => {
    for (const m of MARCAS_MODELOS) {
      expect(slugModelo(m)).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    }
  })

  it('cada slug resuelve a su modelo (ida y vuelta)', () => {
    for (const m of MARCAS_MODELOS) {
      expect(modeloPorSlug(slugModelo(m))?.valor).toBe(m.valor)
    }
  })

  it('un slug inventado no resuelve a nada', () => {
    expect(modeloPorSlug('no-existe-este-modelo')).toBeUndefined()
    expect(modeloPorSlug('')).toBeUndefined()
  })

  it('los acentos y símbolos de los valores canónicos se normalizan', () => {
    const jumper = MARCAS_MODELOS.find(m => m.valor === 'Citroën Jumper')
    expect(jumper && slugModelo(jumper)).toBe('citroen-jumper')
    const doblo = MARCAS_MODELOS.find(m => m.valor === 'Fiat Doblò')
    expect(doblo && slugModelo(doblo)).toBe('fiat-doblo')
  })
})
