import {
  verificarContenido,
  verificarContenidoCampos,
  contieneTerminoCompleto,
  normalizarTextoModeracion,
} from '@/lib/moderacion'

describe('moderación por términos completos', () => {
  it.each(['Computadora portátil', 'Reputación de vendedor', 'Balanza de cocina'])('does not flag a fragment in: %s', texto => {
    expect(verificarContenido(texto).nivel).toBe('limpio')
  })
  it.each(['Pistola de calor', 'Pistola para silicón', 'Pistola para pintar'])('sends ambiguous products to review: %s', texto => {
    expect(verificarContenido(texto).nivel).toBe('sospechoso')
  })
  it.each(['Venta de rifle', 'Cocaína disponible', 'servicio de prostitución'])('still blocks prohibited content: %s', texto => {
    expect(verificarContenido(texto).nivel).toBe('prohibido')
  })
})

describe('normalización anti-evasión (auditoría 2026-10-27, punto 5)', () => {
  it('quita diacríticos, zero-width y caracteres de formato', () => {
    expect(normalizarTextoModeracion('CocaÍna\u200B')).toBe('cocaina')
    expect(verificarContenido('ma\u200Bri\u200Bhuana').nivel).toBe('prohibido')
  })

  it('detecta homoglifos cirílicos (о → o)', () => {
    expect(normalizarTextoModeracion('c\u043eca\u00edna')).toBe('cocaina')
    expect(verificarContenido('c\u043eca\u00edna en venta').nivel).toBe('prohibido')
  })

  it('detecta leetspeak sin confundir "CA" con el término "c4"', () => {
    expect(verificarContenido('c0c41n4').nivel).toBe('prohibido')
    expect(verificarContenido('1sd a la venta').nivel).toBe('prohibido')
    expect(verificarContenido('Inversor 220V CA').nivel).toBe('limpio')
    expect(verificarContenido('C4').nivel).toBe('prohibido')
  })

  it('detecta letras separadas por puntos y espacios artificiales', () => {
    expect(verificarContenido('C.O.C.A.I.N.A disponible').nivel).toBe('prohibido')
    expect(verificarContenido('Venta de d.r.o.g.a.s').nivel).toBe('prohibido')
    expect(verificarContenido('c-o-c-a-i-n-a').nivel).toBe('prohibido')
  })

  it('no crea falsos positivos al compactar palabras legítimas', () => {
    expect(verificarContenido('Balanza de cocina y nevera').nivel).toBe('limpio')
    expect(contieneTerminoCompleto('Balanza de cocina', 'bala')).toBe(false)
  })
})

describe('verificarContenidoCampos', () => {
  it('modera cada campo y también la concatenación', () => {
    // El término está PARTIDO entre título y descripción: la concatenación lo
    // reconstruye y la versión compactada absorbe el espacio artificial.
    expect(verificarContenidoCampos('VEN', 'TA DE DROGAS').nivel).toBe('prohibido')
    expect(verificarContenidoCampos('Furgoneta', 'Venta de rifle').nivel).toBe('prohibido')
  })

  it('acumula sospechosos de los dos campos y deduplica', () => {
    const r = verificarContenidoCampos('Pistola de calor', 'pago por adelantado')
    expect(r.nivel).toBe('sospechoso')
    expect(r.palabras).toEqual(expect.arrayContaining(['pistola', 'pago por adelantado']))
    expect(new Set(r.palabras).size).toBe(r.palabras.length)
  })

  it('campos vacíos o no string no rompen', () => {
    expect(verificarContenidoCampos(null, undefined, '', 42)).toEqual({ nivel: 'limpio', palabras: [] })
    expect(verificarContenidoCampos('Camper familiar')).toEqual({ nivel: 'limpio', palabras: [] })
  })

  it('si un campo es prohibido gana aunque el otro sea sospechoso', () => {
    expect(verificarContenidoCampos('pistola', 'cocaína').nivel).toBe('prohibido')
  })
})
