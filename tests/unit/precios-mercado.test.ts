/**
 * Tests de las estadísticas de precio de mercado.
 *
 * Esto es contenido que la gente va a citar como si fuera un dato oficial, así
 * que lo que se protege es que **nunca publiquemos un número que no se
 * sostenga**:
 *
 *  1. Con muestra insuficiente no hay estadística, hay `null`.
 *  2. Un outlier absurdo no puede mover la cifra principal (por eso mediana).
 *  3. Los anuncios de demostración no son mercado y quedan fuera.
 *  4. Los percentiles coinciden con los de una hoja de cálculo.
 *  5. Los tramos de antigüedad no se solapan ni pierden vehículos.
 */
import {
  MIN_MUESTRA,
  MIN_MUESTRA_TRAMO,
  PRECIO_MAXIMO_VALIDO,
  PRECIO_MINIMO_VALIDO,
  TRAMOS_ANTIGUEDAD,
  calcularEstadisticas,
  estadisticasPorTramo,
  percentil,
  precioValido,
  resumenMercado,
  valorarPrecio,
  type AnuncioMercado,
} from '@/lib/precios-mercado'

const anuncios = (precios: number[], extra: Partial<AnuncioMercado> = {}): AnuncioMercado[] =>
  precios.map(precio => ({ precio, ...extra }))

describe('precioValido', () => {
  it('acepta precios creíbles', () => {
    expect(precioValido(15000)).toBe(true)
    expect(precioValido(PRECIO_MINIMO_VALIDO)).toBe(true)
    expect(precioValido(PRECIO_MAXIMO_VALIDO)).toBe(true)
  })

  it('rechaza errores de tecleo y basura', () => {
    expect(precioValido(1)).toBe(false)           // "1 €, llamar"
    expect(precioValido(9_999_999)).toBe(false)   // sobró un dígito
    expect(precioValido(0)).toBe(false)
    expect(precioValido(-5000)).toBe(false)
    expect(precioValido(null)).toBe(false)
    expect(precioValido('hola')).toBe(false)
    expect(precioValido(NaN)).toBe(false)
  })
})

describe('percentil', () => {
  it('coincide con el cálculo de una hoja de cálculo', () => {
    const v = [10, 20, 30, 40, 50]
    expect(percentil(v, 0.5)).toBe(30)
    expect(percentil(v, 0.25)).toBe(20)
    expect(percentil(v, 0.75)).toBe(40)
  })

  it('interpola cuando el percentil cae entre dos valores', () => {
    expect(percentil([10, 20], 0.5)).toBe(15)
    expect(percentil([0, 100], 0.25)).toBe(25)
  })

  it('no revienta con listas vacías o de un elemento', () => {
    expect(percentil([], 0.5)).toBe(0)
    expect(percentil([42], 0.5)).toBe(42)
  })
})

describe('calcularEstadisticas', () => {
  it('devuelve null si la muestra es insuficiente (mejor nada que inventar)', () => {
    expect(calcularEstadisticas(anuncios([10000, 20000]))).toBeNull()
    expect(calcularEstadisticas(anuncios(Array(MIN_MUESTRA - 1).fill(15000)))).toBeNull()
  })

  it('calcula con la muestra justa', () => {
    const est = calcularEstadisticas(anuncios([10000, 20000, 30000, 40000, 50000]))
    expect(est).not.toBeNull()
    expect(est!.muestra).toBe(5)
    expect(est!.mediana).toBe(30000)
    expect(est!.p25).toBe(20000)
    expect(est!.p75).toBe(40000)
    expect(est!.minimo).toBe(10000)
    expect(est!.maximo).toBe(50000)
  })

  it('un outlier NO desplaza la mediana (razón de ser de usar mediana)', () => {
    const normal = calcularEstadisticas(anuncios([20000, 21000, 22000, 23000, 24000]))!
    const conOutlier = calcularEstadisticas(
      anuncios([20000, 21000, 22000, 23000, 24000, 390000])
    )!
    // La media saltaría por los aires; la mediana apenas se mueve.
    expect(Math.abs(conOutlier.mediana - normal.mediana)).toBeLessThan(2000)
  })

  it('descarta precios imposibles antes de calcular', () => {
    const est = calcularEstadisticas(
      anuncios([1, 20000, 21000, 22000, 23000, 24000, 99_999_999])
    )!
    expect(est.muestra).toBe(5)
    expect(est.minimo).toBe(20000)
    expect(est.maximo).toBe(24000)
  })

  it('los anuncios de demostración no cuentan como mercado', () => {
    const reales = anuncios([20000, 21000, 22000, 23000, 24000])
    const demos = anuncios([1000, 1000, 1000], { es_demo: true })
    const est = calcularEstadisticas([...reales, ...demos])!
    expect(est.muestra).toBe(5)
    expect(est.minimo).toBe(20000)
  })

  it('si solo hay demos, no hay estadística', () => {
    expect(calcularEstadisticas(anuncios([1000, 2000, 3000, 4000, 5000], { es_demo: true })))
      .toBeNull()
  })

  it('el km y el año medianos requieren datos propios', () => {
    const sinKm = calcularEstadisticas(anuncios([20000, 21000, 22000, 23000, 24000]))!
    expect(sinKm.kmMediana).toBeNull()
    expect(sinKm.anioMediano).toBeNull()

    const conKm = calcularEstadisticas([
      { precio: 20000, km: 100000, anio: 2015 },
      { precio: 21000, km: 120000, anio: 2016 },
      { precio: 22000, km: 140000, anio: 2017 },
      { precio: 23000, km: 160000, anio: 2018 },
      { precio: 24000, km: 180000, anio: 2019 },
    ])!
    expect(conKm.kmMediana).toBe(140000)
    expect(conKm.anioMediano).toBe(2017)
  })
})

describe('estadisticasPorTramo', () => {
  const REF = 2026

  it('agrupa por antigüedad sin solaparse', () => {
    const lista: AnuncioMercado[] = [
      // Hasta 3 años (2023-2026)
      ...anuncios([60000, 62000, 64000]).map((a, i) => ({ ...a, anio: 2024 + (i % 2) })),
      // De 4 a 8 años (2018-2022)
      ...anuncios([40000, 42000, 44000]).map(a => ({ ...a, anio: 2020 })),
    ]
    const tramos = estadisticasPorTramo(lista, REF)
    expect(tramos.map(t => t.id)).toEqual(['reciente', 'media'])
    expect(tramos[0].mediana).toBeGreaterThan(tramos[1].mediana)
  })

  it('omite tramos sin muestra suficiente en vez de inventarlos', () => {
    const lista = [
      ...anuncios([40000, 42000, 44000]).map(a => ({ ...a, anio: 2020 })),
      { precio: 9000, anio: 2005 }, // un solo clásico: no basta
    ]
    const tramos = estadisticasPorTramo(lista, REF)
    expect(tramos.map(t => t.id)).toEqual(['media'])
  })

  it('ignora anuncios sin año', () => {
    const lista = [
      ...anuncios([40000, 42000, 44000]).map(a => ({ ...a, anio: 2020 })),
      { precio: 50000, anio: null },
      { precio: 50000 },
    ]
    const tramos = estadisticasPorTramo(lista, REF)
    expect(tramos).toHaveLength(1)
    expect(tramos[0].muestra).toBe(3)
  })

  it('el umbral por tramo es más laxo que el general, pero existe', () => {
    expect(MIN_MUESTRA_TRAMO).toBeLessThan(MIN_MUESTRA)
    expect(MIN_MUESTRA_TRAMO).toBeGreaterThan(1)
  })

  it('los tramos cubren toda la vida del vehículo', () => {
    expect(TRAMOS_ANTIGUEDAD[TRAMOS_ANTIGUEDAD.length - 1].maxEdad).toBe(Infinity)
  })
})

describe('valorarPrecio', () => {
  const est = calcularEstadisticas(
    anuncios([20000, 25000, 30000, 35000, 40000])
  )!

  it('sitúa un precio en el rango normal', () => {
    expect(valorarPrecio(30000, est).posicion).toBe('mercado')
  })

  it('detecta un chollo', () => {
    expect(valorarPrecio(15000, est).posicion).toBe('chollo')
  })

  it('detecta un precio muy alto', () => {
    expect(valorarPrecio(60000, est).posicion).toBe('caro')
  })

  it('calcula la diferencia porcentual con la mediana', () => {
    expect(valorarPrecio(33000, est).difMediana).toBe(10)
    expect(valorarPrecio(27000, est).difMediana).toBe(-10)
  })
})

describe('resumenMercado', () => {
  it('no promete cifras cuando no las hay', () => {
    const texto = resumenMercado('Fiat Ducato', null)
    expect(texto).toContain('Fiat Ducato')
    expect(texto).not.toMatch(/\d+\s*€/)
  })

  it('usa los mismos números que la tabla', () => {
    const est = calcularEstadisticas(anuncios([20000, 25000, 30000, 35000, 40000]))!
    const texto = resumenMercado('Fiat Ducato', est)
    expect(texto).toContain('30.000 €')
    expect(texto).toContain('5 anuncios')
  })
})
