/**
 * Tests del cálculo de ITP.
 *
 * Es una calculadora que la gente usará para decidir presupuestos de compra, así
 * que lo que se protege es: (1) la base imponible es el MAYOR entre precio y
 * valor de tablas depreciado; (2) el orden de exención → cuota fija → tipo; (3)
 * los tipos y rarezas por comunidad siguen en el registro (si alguien los borra
 * o los descuadra, el test cae); (4) los límites de las cuotas fijas y las
 * exenciones por valor.
 */
import {
  COEFICIENTES_DEPRECIACION,
  TASA_DGT,
  TIPOS_ITP,
  calcularITP,
  coeficienteDepreciacion,
  compararComunidades,
  edadVehiculo,
  getComunidadITP,
} from '@/lib/itp'

describe('coeficientes de depreciación', () => {
  test('siguen la tabla oficial por tramos de antigüedad', () => {
    expect(coeficienteDepreciacion(0)).toBe(1)
    expect(coeficienteDepreciacion(1)).toBe(0.84)
    expect(coeficienteDepreciacion(5)).toBe(0.39)
    expect(coeficienteDepreciacion(6)).toBe(0.34)
    expect(coeficienteDepreciacion(7)).toBe(0.28)
    expect(coeficienteDepreciacion(10)).toBe(0.17)
    expect(coeficienteDepreciacion(12)).toBe(0.1)
    expect(coeficienteDepreciacion(30)).toBe(0.1)
  })

  test('los tramos están ordenados y son decrecientes', () => {
    const tramos = COEFICIENTES_DEPRECIACION
    expect(tramos[tramos.length - 1].hasta).toBe(Infinity)
    for (let i = 1; i < tramos.length; i++) {
      expect(tramos[i].coeficiente).toBeLessThan(tramos[i - 1].coeficiente)
    }
  })

  test('edadVehiculo no devuelve negativos y usa el ejercicio en curso', () => {
    expect(edadVehiculo(2026, 2026)).toBe(0)
    expect(edadVehiculo(2019, 2026)).toBe(7)
    expect(edadVehiculo(2030, 2026)).toBe(0)
  })
})

describe('registro de comunidades', () => {
  test('cubre las 17 comunidades autónomas más Ceuta y Melilla', () => {
    expect(TIPOS_ITP).toHaveLength(19)
    expect(new Set(TIPOS_ITP.map(c => c.slug)).size).toBe(19)
  })

  test('cada entrada tiene fuente oficial y notas para la landing', () => {
    for (const c of TIPOS_ITP) {
      expect(c.fuente.startsWith('https://')).toBe(true)
      expect(c.notas.length).toBeGreaterThan(0)
      expect(c.tipo).toBeGreaterThan(0)
      expect(getComunidadITP(c.slug)).toBe(c)
    }
  })

  test('los tipos están en el rango real (3 % Galicia — 6 % el más alto)', () => {
    for (const c of TIPOS_ITP) {
      expect(c.tipo).toBeGreaterThanOrEqual(3)
      expect(c.tipo).toBeLessThanOrEqual(6)
      if (c.tipoIncrementado) expect(c.tipoIncrementado.tipo).toBeGreaterThan(c.tipo)
    }
    expect(getComunidadITP('galicia')?.tipo).toBe(3)
    expect(getComunidadITP('comunitat-valenciana')?.tipo).toBe(6)
    expect(getComunidadITP('no-existe')).toBeUndefined()
  })

  test('los tramos de cuota fija terminan en el tipo general o en una cuota real', () => {
    for (const c of TIPOS_ITP.filter(c => c.cuotaFija)) {
      const tramos = c.cuotaFija!.tramos
      expect(tramos[tramos.length - 1].hastaCc).toBe(Infinity)
      // El último tramo o es una cuota (Galicia, Murcia) o es "0 € sentinela"
      // (Cantabria, Canarias, C. Valenciana) que significa "vuelve al tipo general".
      expect(tramos[tramos.length - 1].cuota).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('calcularITP', () => {
  const base = { precio: 30000, anioMatriculacion: 2019, anioCompra: 2026 }

  test('Madrid, vehículo de 7 años y 30.000 €: 4 % sobre el precio', () => {
    const r = calcularITP({ ...base, ccaa: 'madrid' })

    expect(r.edadAnios).toBe(7)
    // 7 años → tramo "de 7 a 8 años" (28 %). La convención (año de la operación
    // − año de matriculación) está documentada en `coeficienteDepreciacion`.
    expect(r.coeficiente).toBe(0.28)
    expect(r.baseImponible).toBe(30000)
    expect(r.tipoAplicado).toBe(4)
    expect(r.cuota).toBe(1200)
    expect(r.cuotaFija).toBe(false)
    expect(r.sinAutoliquidar).toBe(false)
  })

  test('la base imponible es el MAYOR entre precio y valor de tablas depreciado', () => {
    // Tablas: 100.000 € de nuevo, 7 años → 28 % → 28.000 € → base = el precio
    const conPrecioMayor = calcularITP({ ...base, ccaa: 'madrid', valorTablas: 100000 })
    expect(conPrecioMayor.valorFiscal).toBe(28000)
    expect(conPrecioMayor.baseImponible).toBe(30000)

    // Tablas: 200.000 € de nuevo, 7 años → 56.000 € → base = valor fiscal
    const conTablasMayor = calcularITP({ ...base, ccaa: 'madrid', valorTablas: 200000 })
    expect(conTablasMayor.valorFiscal).toBe(56000)
    expect(conTablasMayor.baseImponible).toBe(56000)
    expect(conTablasMayor.cuota).toBe(2240)
  })

  test('sin valor de tablas avisa de que Hacienda puede usar el suyo', () => {
    const r = calcularITP({ ...base, ccaa: 'madrid' })
    expect(r.avisos.join(' ')).toMatch(/tablas de Hacienda/i)
  })

  test('tipo incrementado por potencia fiscal (Andalucía y 15 CV fiscales)', () => {
    const sinDato = calcularITP({ ...base, ccaa: 'andalucia' })
    expect(sinDato.tipoAplicado).toBe(4)
    expect(sinDato.cuota).toBe(1200)
    expect(sinDato.avisos.join(' ')).toMatch(/CV fiscales/i)

    const justo = calcularITP({ ...base, ccaa: 'andalucia', cvFiscales: 15 })
    expect(justo.tipoAplicado).toBe(4)

    const grande = calcularITP({ ...base, ccaa: 'andalucia', cvFiscales: 16 })
    expect(grande.tipoAplicado).toBe(8)
    expect(grande.cuota).toBe(2400)
    expect(grande.reglas.map(r => r.clave)).toContain('tipoIncrementado')
  })

  test('Galicia es la comunidad más barata: 3 %', () => {
    const r = calcularITP({ ...base, ccaa: 'galicia' })
    expect(r.tipoAplicado).toBe(3)
    expect(r.cuota).toBe(900)
  })

  test('cuota fija para vehículos antiguos (Murcia, 12 años y 1.900 cc)', () => {
    const r = calcularITP({
      ccaa: 'murcia',
      precio: 18000,
      anioMatriculacion: 2012,
      anioCompra: 2026,
      cilindrada: 1900,
    })

    expect(r.edadAnios).toBe(14)
    expect(r.cuotaFija).toBe(true)
    expect(r.cuota).toBe(50)
    expect(r.tipoAplicado).toBe(0)
    expect(r.reglas.map(x => x.clave)).toContain('cuotaFija')
  })

  test('Murcia sin autoliquidación hasta 1.000 cc', () => {
    const r = calcularITP({ ccaa: 'murcia', precio: 9000, anioMatriculacion: 2010, anioCompra: 2026, cilindrada: 1000 })
    expect(r.cuota).toBe(0)
    expect(r.sinAutoliquidar).toBe(true)
    expect(r.cuotaFija).toBe(true)
  })

  test('por encima del tramo de cilindrada, la cuota fija no aplica y vuelve el tipo general', () => {
    // Cantabria: desde 2.000 cc no hay cuota fija para antiguos
    const r = calcularITP({ ccaa: 'cantabria', precio: 20000, anioMatriculacion: 2010, anioCompra: 2026, cilindrada: 2300 })
    expect(r.cuotaFija).toBe(false)
    expect(r.tipoAplicado).toBe(6)
    expect(r.cuota).toBe(1200)
  })

  test('el tipo incrementado por cilindrada (Comunitat Valenciana, más de 2.000 cc)', () => {
    const pequeno = calcularITP({ ccaa: 'comunitat-valenciana', precio: 20000, anioMatriculacion: 2020, anioCompra: 2026, cilindrada: 1600 })
    expect(pequeno.tipoAplicado).toBe(6)

    const grande = calcularITP({ ccaa: 'comunitat-valenciana', precio: 20000, anioMatriculacion: 2020, anioCompra: 2026, cilindrada: 2300 })
    expect(grande.tipoAplicado).toBe(8)
    expect(grande.cuota).toBe(1600)

    const sinDato = calcularITP({ ccaa: 'comunitat-valenciana', precio: 20000, anioMatriculacion: 2020, anioCompra: 2026 })
    expect(sinDato.avisos.join(' ')).toMatch(/cilindrada/i)
  })

  test('sin cilindrada no se puede saber la cuota fija: avisa en vez de inventar', () => {
    const r = calcularITP({ ccaa: 'cantabria', precio: 20000, anioMatriculacion: 2010, anioCompra: 2026 })
    expect(r.cuotaFija).toBe(false)
    expect(r.tipoAplicado).toBe(6)
    expect(r.avisos.join(' ')).toMatch(/cilindrada/i)
  })

  test('cuota fija condicionada al valor (Comunitat Valenciana, límite 20.000 €)', () => {
    const barato = calcularITP({ ccaa: 'comunitat-valenciana', precio: 15000, anioMatriculacion: 2012, anioCompra: 2026, cilindrada: 2200 })
    expect(barato.cuotaFija).toBe(true)
    expect(barato.cuota).toBe(140)

    const caro = calcularITP({ ccaa: 'comunitat-valenciana', precio: 25000, anioMatriculacion: 2012, anioCompra: 2026, cilindrada: 2200 })
    expect(caro.cuotaFija).toBe(false)
    // Más de 2.000 cc en la Comunitat Valenciana: tipo incrementado del 8 %
    expect(caro.tipoAplicado).toBe(8)
    expect(caro.cuota).toBe(2000)
  })

  test('exención por antigüedad (Navarra, turismo de 10 años por debajo de 40.000 €)', () => {
    const exento = calcularITP({ ccaa: 'navarra', precio: 25000, anioMatriculacion: 2015, anioCompra: 2026 })
    expect(exento.tipoAplicado).toBe(0)
    expect(exento.cuota).toBe(0)
    expect(exento.sinAutoliquidar).toBe(true)

    const caro = calcularITP({ ccaa: 'navarra', precio: 45000, anioMatriculacion: 2015, anioCompra: 2026 })
    expect(caro.cuota).toBe(1800) // 4 % de 45.000
    expect(caro.avisos.join(' ')).toMatch(/límite de 40000/i)
  })

  test('Cataluña no autoliquida a partir de 10 años, pero respeta el límite de 40.000 €', () => {
    const viejo = calcularITP({ ccaa: 'cataluna', precio: 22000, anioMatriculacion: 2010, anioCompra: 2026 })
    expect(viejo.sinAutoliquidar).toBe(true)

    const caro = calcularITP({ ccaa: 'cataluna', precio: 50000, anioMatriculacion: 2010, anioCompra: 2026 })
    expect(caro.sinAutoliquidar).toBe(false)
    expect(caro.tipoAplicado).toBe(5)
    expect(caro.cuota).toBe(2500)
  })

  test('distintivos ambientales: cero emisiones y ECO', () => {
    const cero = calcularITP({ ccaa: 'baleares', precio: 40000, anioMatriculacion: 2022, anioCompra: 2026, etiquetaDGT: '0' })
    expect(cero.tipoAplicado).toBe(0)
    expect(cero.cuota).toBe(0)

    const eco = calcularITP({ ccaa: 'baleares', precio: 40000, anioMatriculacion: 2022, anioCompra: 2026, etiquetaDGT: 'ECO' })
    expect(eco.tipoAplicado).toBe(2)
    expect(eco.cuota).toBe(800)

    // Un vehículo con etiqueta C no tiene reducción
    const c = calcularITP({ ccaa: 'baleares', precio: 40000, anioMatriculacion: 2022, anioCompra: 2026, etiquetaDGT: 'C' })
    expect(c.tipoAplicado).toBe(4)
  })

  test('el aviso de la DGT aparece siempre que no hay autoliquidación que presentar', () => {
    const r = calcularITP({ ccaa: 'murcia', precio: 9000, anioMatriculacion: 2010, anioCompra: 2026, cilindrada: 900 })
    expect(r.avisos.join(' ')).toMatch(/cambio de nombre/i)
  })

  test('avisa del matiz camper cuando la cuota fija habla de turismos', () => {
    const r = calcularITP({ ccaa: 'cantabria', precio: 20000, anioMatriculacion: 2010, anioCompra: 2026, cilindrada: 1900 })
    expect(r.cuotaFija).toBe(true)
    expect(r.avisos.join(' ')).toMatch(/vivienda \(2448\/3148\)/i)
  })

  test('cada resultado explica sus reglas, no solo la cifra', () => {
    const r = calcularITP({ ...base, ccaa: 'madrid', valorTablas: 50000 })
    const claves = r.reglas.map(x => x.clave)
    expect(claves).toEqual(['depreciacion', 'base', 'tipoGeneral'])
    for (const regla of r.reglas) expect(regla.descripcion.length).toBeGreaterThan(10)
  })

  test('una comunidad desconocida es un error de programación, no un 0 €', () => {
    expect(() => calcularITP({ ...base, ccaa: 'atlantida' })).toThrow(/desconocida/i)
  })

  test('un precio de 0 no rompe el cálculo', () => {
    const r = calcularITP({ ccaa: 'madrid', precio: 0, anioMatriculacion: 2020, anioCompra: 2026 })
    expect(r.baseImponible).toBe(0)
    expect(r.cuota).toBe(0)
  })
})

describe('compararComunidades', () => {
  test('ordena de más barata a más cara y cubre todas las comunidades', () => {
    const filas = compararComunidades({ precio: 30000, anioMatriculacion: 2019, anioCompra: 2026 })

    expect(filas).toHaveLength(TIPOS_ITP.length)
    for (let i = 1; i < filas.length; i++) {
      expect(filas[i].cuota).toBeGreaterThanOrEqual(filas[i - 1].cuota)
    }
    // Galicia (3 %) va por delante de Madrid (4 %)
    expect(filas[0].comunidad.slug).toBe('galicia')
    expect(filas[0].cuota).toBe(900)
  })
})

describe('costes de la operación', () => {
  test('la tasa de la DGT está en el resultado para poder calcular el coste total', () => {
    expect(TASA_DGT).toBe(55.7)
  })
})
