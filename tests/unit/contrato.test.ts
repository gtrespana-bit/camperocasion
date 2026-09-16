/**
 * Tests del generador de contrato de compraventa.
 *
 * Lo que se protege:
 *  1. El prefill desde el anuncio: marca/modelo, precio (solo si > 0) y las
 *     claves del JSONB de especificaciones que traen año y kilómetros.
 *  2. Que la matrícula y el bastidor NUNCA vengan del anuncio (no son datos
 *     públicos: los escribe el vendedor).
 *  3. La normalización: sin saltos de línea inyectables y con huecos «____»
 *     donde falte dato, para que el documento impreso nunca quede roto.
 *  4. La noción de "contrato imprimible": con lo mínimo puesto, listo.
 */
import {
  contratoCompleto,
  datosContratoPorDefecto,
  normalizarDatosContrato,
  parrafosContrato,
  prefillDesdeProducto,
} from '@/lib/contrato'

const DATOS_MINIMOS = {
  ...datosContratoPorDefecto(),
  vendedor: { nombre: 'Vendedor Vázquez', dni: '12345678Z', domicilio: 'C/ Mayor 1, Madrid' },
  comprador: { nombre: 'Comprador Común', dni: '87654321X', domicilio: 'Av. de la Playa 2, Valencia' },
  vehiculo: {
    tipo: 'Furgoneta camper / autocaravana',
    marca: 'Fiat',
    modelo: 'Ducato camperizada',
    matricula: '1234 ABC',
    bastidor: '',
    anio: '2019',
    kilometros: '85000',
    itvVigente: true,
  },
  precio: '24900',
}

describe('prefill desde el anuncio', () => {
  it('precarga marca, modelo, precio, año y kilómetros del JSONB', () => {
    const d = prefillDesdeProducto({
      titulo: 'Fiat Ducato camperizada 2019',
      marca: 'Fiat',
      modelo: 'Ducato',
      precio: 24900,
      especificaciones: { 'Año de matriculación': '2019', 'Kilómetros': '85.000' },
    })
    expect(d.vehiculo.marca).toBe('Fiat')
    expect(d.vehiculo.modelo).toBe('Ducato')
    expect(d.precio).toBe('24900')
    expect(d.vehiculo.anio).toBe('2019')
    expect(d.vehiculo.kilometros).toBe('85.000')
  })

  it('la matrícula y el bastidor nunca vienen del anuncio', () => {
    const d = prefillDesdeProducto({
      titulo: 'x',
      marca: 'Fiat',
      precio: 1000,
      especificaciones: { Matrícula: '9999 ZZZ', bastidor: 'ZFA123' },
    })
    expect(d.vehiculo.matricula).toBe('')
    expect(d.vehiculo.bastidor).toBe('')
  })

  it('precio 0 (a consultar) se deja vacío para obligar a mirarlo', () => {
    const d = prefillDesdeProducto({ titulo: 'x', precio: 0 })
    expect(d.precio).toBe('')
  })

  it('caza variantes de clave del JSONB (con y sin tilde)', () => {
    const conTilde = prefillDesdeProducto({
      especificaciones: { 'Kilómetros': '10.000', 'Año de matriculación': '2021' },
    })
    expect(conTilde.vehiculo.kilometros).toBe('10.000')
    const sinTilde = prefillDesdeProducto({
      especificaciones: { 'Kilometros': '10.000', 'Año': '2021' },
    })
    expect(sinTilde.vehiculo.kilometros).toBe('10.000')
    expect(sinTilde.vehiculo.anio).toBe('2021')
  })

  it('tolera un anuncio nulo o vacío', () => {
    expect(prefillDesdeProducto(null)).toEqual(datosContratoPorDefecto())
    expect(prefillDesdeProducto({}).precio).toBe('')
  })
})

describe('normalización y validez del documento', () => {
  it('un contrato con lo mínimo está listo para imprimir', () => {
    expect(contratoCompleto(DATOS_MINIMOS as any)).toBe(true)
  })

  it('sin partes, marca, matrícula o precio no se imprime', () => {
    const sinComprador = { ...DATOS_MINIMOS, comprador: { nombre: '', dni: '', domicilio: '' } }
    const sinMatricula = {
      ...DATOS_MINIMOS,
      vehiculo: { ...DATOS_MINIMOS.vehiculo, matricula: '' },
    }
    const sinPrecio = { ...DATOS_MINIMOS, precio: '' }
    expect(contratoCompleto(sinComprador as any)).toBe(false)
    expect(contratoCompleto(sinMatricula as any)).toBe(false)
    expect(contratoCompleto(sinPrecio as any)).toBe(false)
  })

  it('los saltos de línea del usuario no inyectan maquetación', () => {
    const d = normalizarDatosContrato({
      ...DATOS_MINIMOS,
      vendedor: { nombre: 'Uno\nDos\nTres', dni: 'X', domicilio: 'Y' },
    } as any)
    expect(d.vendedor.nombre).toBe('Uno Dos Tres')
  })

  it('recorta los campos largos en lugar de romper el documento', () => {
    const d = normalizarDatosContrato({
      ...DATOS_MINIMOS,
      observaciones: 'x'.repeat(2000),
    } as any)
    expect(d.observaciones.length).toBeLessThanOrEqual(400)
  })
})

describe('cuerpo del contrato', () => {
  const parrafos = parrafosContrato(normalizarDatosContrato(DATOS_MINIMOS as any))

  it('incluye las cláusulas esenciales de una compraventa ES', () => {
    const texto = parrafos.join(' ')
    expect(texto).toMatch(/PRIMERA — Objeto/)
    expect(texto).toMatch(/SEGUNDA — Precio/)
    expect(texto).toMatch(/24900 €/)
    expect(texto).toMatch(/30 días/)
    expect(texto).toMatch(/modelo 620/i)
    expect(texto).toMatch(/1234 ABC/)
  })

  it('los huecos quedan como ____ para completar a mano, sin nunca romper el texto', () => {
    const vacios = parrafosContrato(normalizarDatosContrato(datosContratoPorDefecto()))
    const texto = vacios.join(' ')
    expect(texto).toContain('________')
    expect(texto).toMatch(/______ €/)
  })
})
