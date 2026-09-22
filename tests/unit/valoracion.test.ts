/**
 * Tests del valorador «¿cuánto vale mi camper?».
 *
 * Esto le da una cifra a alguien que va a tomar una decisión de miles de euros,
 * así que lo que se protege es que la herramienta sea **honesta**:
 *
 *  1. Sin base de cálculo NO se inventa un número (devuelve null).
 *  2. La confianza declarada se corresponde con la calidad del dato.
 *  3. Los ajustes están acotados: los km no pueden convertir una camper de
 *     40.000 € en una de 10.000 €.
 *  4. Cada cifra es auditable: los ajustes aplicados se devuelven explicados.
 *  5. El sentido de los ajustes es el correcto (más nuevo vale más, más km
 *     vale menos).
 */
import {
  AJUSTE_KM_MAXIMO,
  ESTADOS_VEHICULO,
  FACTOR_ESTADO,
  KM_ANUALES_NORMALES,
  ajustePorKm,
  kmEsperados,
  validarEntrada,
  valorar,
} from '@/lib/valoracion'
import { calcularEstadisticas } from '@/lib/precios-mercado'

const REF = 2026

const mercadoDucato = calcularEstadisticas([
  { precio: 30000, anio: 2016, km: 160000 },
  { precio: 34000, anio: 2017, km: 140000 },
  { precio: 38000, anio: 2018, km: 120000 },
  { precio: 42000, anio: 2019, km: 100000 },
  { precio: 46000, anio: 2020, km: 80000 },
])

const entradaBase = { modelo: 'Fiat Ducato', anio: 2018, km: 96000 }

describe('sin base de cálculo no hay cifra', () => {
  it('sin mercado y sin precio de nuevo devuelve null', () => {
    expect(valorar(entradaBase, null, REF)).toBeNull()
  })

  it('con precio de nuevo sí estima, pero avisa de confianza baja', () => {
    const r = valorar({ ...entradaBase, precioNuevo: 60000 }, null, REF)!
    expect(r).not.toBeNull()
    expect(r.fuente).toBe('depreciacion')
    expect(r.confianza).toBe('baja')
  })
})

describe('valoración con mercado real', () => {
  it('usa la mediana del modelo como punto de partida', () => {
    const r = valorar(entradaBase, mercadoDucato, REF)!
    expect(r.fuente).toBe('mercado')
    expect(r.muestra).toBe(5)
    // La mediana es 38.000 y el vehículo es justo el del año mediano.
    expect(r.estimado).toBeGreaterThan(30000)
    expect(r.estimado).toBeLessThan(46000)
  })

  it('un vehículo más nuevo vale más que uno más viejo', () => {
    const nuevo = valorar({ ...entradaBase, anio: 2022 }, mercadoDucato, REF)!
    const viejo = valorar({ ...entradaBase, anio: 2012 }, mercadoDucato, REF)!
    expect(nuevo.estimado).toBeGreaterThan(viejo.estimado)
  })

  it('más kilómetros valen menos', () => {
    const pocos = valorar({ ...entradaBase, km: 40000 }, mercadoDucato, REF)!
    const muchos = valorar({ ...entradaBase, km: 250000 }, mercadoDucato, REF)!
    expect(pocos.estimado).toBeGreaterThan(muchos.estimado)
  })

  it('declara confianza alta solo con muestra amplia', () => {
    const conPoca = valorar(entradaBase, mercadoDucato, REF)!
    expect(conPoca.confianza).toBe('media')

    const amplio = calcularEstadisticas(
      Array.from({ length: 20 }, (_, i) => ({ precio: 30000 + i * 500, anio: 2018, km: 120000 }))
    )
    expect(valorar(entradaBase, amplio, REF)!.confianza).toBe('alta')
  })

  it('devuelve una horquilla coherente alrededor de la estimación', () => {
    const r = valorar(entradaBase, mercadoDucato, REF)!
    expect(r.minimo).toBeLessThan(r.estimado)
    expect(r.maximo).toBeGreaterThan(r.estimado)
  })

  it('cada cifra viene explicada (auditable)', () => {
    const r = valorar({ ...entradaBase, km: 250000, estado: 'mejorable' }, mercadoDucato, REF)!
    const conceptos = r.ajustes.map(a => a.concepto)
    expect(conceptos).toContain('Precio de partida')
    expect(conceptos).toContain('Kilometraje')
    expect(conceptos).toContain('Estado declarado')
    for (const a of r.ajustes) expect(a.detalle.length).toBeGreaterThan(5)
  })
})

describe('ajuste por kilómetros (acotado)', () => {
  it('nunca supera el tope, por muchos km que tenga', () => {
    expect(ajustePorKm(2_000_000, 5)).toBeGreaterThanOrEqual(1 - AJUSTE_KM_MAXIMO)
    expect(ajustePorKm(0.0001, 20)).toBeLessThanOrEqual(1 + AJUSTE_KM_MAXIMO)
  })

  it('un kilometraje normal para su edad no mueve el precio', () => {
    const edad = 5
    expect(ajustePorKm(kmEsperados(edad), edad)).toBeCloseTo(1, 5)
  })

  it('km inválidos no penalizan', () => {
    expect(ajustePorKm(0, 5)).toBe(1)
    expect(ajustePorKm(NaN, 5)).toBe(1)
  })

  it('los km esperados crecen con la edad', () => {
    expect(kmEsperados(10)).toBeGreaterThan(kmEsperados(3))
    expect(kmEsperados(1)).toBe(KM_ANUALES_NORMALES)
  })
})

describe('estado declarado', () => {
  it('mejora o penaliza en el sentido correcto', () => {
    const excelente = valorar({ ...entradaBase, estado: 'excelente' }, mercadoDucato, REF)!
    const bueno = valorar({ ...entradaBase, estado: 'bueno' }, mercadoDucato, REF)!
    const mejorable = valorar({ ...entradaBase, estado: 'mejorable' }, mercadoDucato, REF)!
    expect(excelente.estimado).toBeGreaterThan(bueno.estimado)
    expect(mejorable.estimado).toBeLessThan(bueno.estimado)
  })

  it('es conservador al alza: el vendedor siempre se ve excelente', () => {
    // Subir menos de lo que baja evita inflar expectativas.
    expect(FACTOR_ESTADO.excelente - 1).toBeLessThan(1 - FACTOR_ESTADO.mejorable)
  })

  it('todos los estados de la UI tienen factor definido', () => {
    for (const e of ESTADOS_VEHICULO) {
      expect(FACTOR_ESTADO[e.id]).toBeGreaterThan(0)
    }
  })
})

describe('validarEntrada', () => {
  it('acepta una entrada correcta', () => {
    expect(validarEntrada({ modelo: 'Fiat Ducato', anio: 2018, km: 120000 }, REF)).toEqual({})
  })

  it('exige modelo', () => {
    expect(validarEntrada({ anio: 2018, km: 1000 }, REF).modelo).toBeTruthy()
  })

  it('rechaza años imposibles', () => {
    expect(validarEntrada({ modelo: 'X', anio: 1850, km: 1000 }, REF).anio).toBeTruthy()
    expect(validarEntrada({ modelo: 'X', anio: 2100, km: 1000 }, REF).anio).toBeTruthy()
  })

  it('rechaza kilometrajes imposibles', () => {
    expect(validarEntrada({ modelo: 'X', anio: 2018, km: -5 }, REF).km).toBeTruthy()
    expect(validarEntrada({ modelo: 'X', anio: 2018, km: 9_000_000 }, REF).km).toBeTruthy()
  })

  it('el precio de nuevo es opcional pero se valida si viene', () => {
    expect(validarEntrada({ modelo: 'X', anio: 2018, km: 1000 }, REF).precioNuevo).toBeUndefined()
    expect(validarEntrada({ modelo: 'X', anio: 2018, km: 1000, precioNuevo: 5 }, REF).precioNuevo).toBeTruthy()
  })
})
