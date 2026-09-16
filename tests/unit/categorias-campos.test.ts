/**
 * Tests de resolución de campos técnicos de CamperOcasión.
 *
 * Verifica que las subcategorías camper resuelven correctamente sus opciones
 * dinámicas:
 *  - `Año de matriculación` → últimos 30 años.
 *  - `Marca` → hereda la lista `marcas` de la subcategoría.
 * Y que cada subcategoría incluye los bloques técnicos del marketplace
 * vertical (mecánica, habitabilidad y equipamiento camper).
 */
import {
  categoriasData,
  resolverCampos,
  esCampoAnio,
  getSubConfig,
  getSubBySlug,
  getMarcaOptions,
} from '@/lib/categorias'

describe('resolverCampos: campos técnicos camper', () => {
  test('Gran Volumen resuelve Año de matriculación con años', () => {
    const sub = getSubConfig('camper', 'Gran Volumen')
    const campos = resolverCampos(sub)
    const anio = campos.find(c => esCampoAnio(c))

    expect(anio).toBeDefined()
    expect(anio!.options!.length).toBe(30)
    expect(anio!.options![0]).toBe(String(new Date().getFullYear()))
  })

  test('Gran Volumen ofrece las marcas gran volumen', () => {
    const marcas = getMarcaOptions('camper', 'Gran Volumen')

    expect(marcas).toEqual(
      expect.arrayContaining(['Fiat Ducato', 'Volkswagen Crafter', 'Mercedes-Benz Sprinter'])
    )
  })

  test('Minicamper ofrece marcas minicamper, no las de gran volumen', () => {
    const marcas = getMarcaOptions('camper', 'Minicamper')

    expect(marcas).toEqual(expect.arrayContaining(['Citroën Berlingo', 'Volkswagen Caddy']))
    expect(marcas).not.toContain('Fiat Ducato')
  })

  test('cada subcategoría incluye mecánica + habitabilidad + equipamiento camper', () => {
    const bloques = [
      'Año de matriculación',
      'Kilómetros',
      'Combustible',
      'Transmisión',
      'Potencia (CV)',
      'Distintivo Ambiental DGT',
      'Homologación',
      'Plazas homologadas para viajar',
      'Plazas para dormir',
      'Calefacción estacionaria',
      'Agua caliente',
      'Baño / Ducha',
      'Depósito agua limpia (litros)',
      'Batería auxiliar',
      'Placa solar',
      'Inversor 220V',
      'Nevera',
    ]
    for (const [catKey, cat] of Object.entries(categoriasData)) {
      for (const sub of cat.subs) {
        const campos = resolverCampos(sub).map(c => c.label)
        for (const bloque of bloques) {
          expect(campos).toContain(bloque)
        }
      }
    }
  })

  test('Distintivo DGT y Homologación traen las opciones oficiales', () => {
    const campos = resolverCampos(getSubConfig('camper', 'Gran Volumen'))
    const dgt = campos.find(c => c.label === 'Distintivo Ambiental DGT')
    expect(dgt!.options).toEqual(['Cero Emisiones', 'ECO', 'C (Verde)', 'B (Amarillo)', 'Sin distintivo'])

    const hom = campos.find(c => c.label === 'Homologación')
    expect(hom!.options).toEqual([
      'Vehículo Vivienda (2448 / 3148)',
      'Turismo (1000)',
      'Vehículo Mixto Adaptable (3100)',
      'Furgón (2400)',
    ])
  })

  test('los 7 slugs de subcategoría son únicos y kebab-case', () => {
    const slugs = categoriasData.camper.subs.map(s => s.slug)
    expect(slugs).toHaveLength(7)
    expect(new Set(slugs).size).toBe(7)
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9-]+$/)
    }
    expect(getSubBySlug('camper', 'gran-volumen')?.label).toBe('Gran Volumen')
  })
})
