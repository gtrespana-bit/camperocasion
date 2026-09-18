import { enlaceWhatsApp, esNumeroNacionalEspanol, soloDigitos, telefonoInternacional } from '@/lib/telefono'

/**
 * El bug que motivó este módulo: el enlace de WhatsApp anteponía el prefijo de
 * Venezuela ('58') a cualquier número, así que un móvil español acababa en
 * `wa.me/5834612345678` (número inexistente) y el botón no funcionaba.
 */
describe('teléfonos para WhatsApp (+34)', () => {
  test('un móvil español sin prefijo recibe el 34', () => {
    expect(telefonoInternacional('612 34 56 78')).toBe('34612345678')
    expect(telefonoInternacional('612345678')).toBe('34612345678')
    expect(enlaceWhatsApp('612 34 56 78')).toBe('https://wa.me/34612345678')
  })

  test('nunca se antepone el prefijo de Venezuela', () => {
    expect(telefonoInternacional('+34 612 48 93 07')).not.toContain('583')
    expect(enlaceWhatsApp('+34 612 48 93 07')).toBe('https://wa.me/34612489307')
  })

  test('respeta el prefijo internacional ya presente', () => {
    expect(telefonoInternacional('+34 654 09 31 76')).toBe('34654093176')
    expect(telefonoInternacional('0034612345678')).toBe('34612345678')
    expect(telefonoInternacional('+33 6 12 34 56 78')).toBe('33612345678')
  })

  test('limpia espacios, guiones y paréntesis', () => {
    expect(soloDigitos('+34 (612) 34-56-78')).toBe('34612345678')
    expect(telefonoInternacional('+34 (612) 34-56-78')).toBe('34612345678')
  })

  test('no ofrece enlace si el número no es utilizable', () => {
    expect(telefonoInternacional('')).toBe('')
    expect(telefonoInternacional('123')).toBe('')
    expect(enlaceWhatsApp('')).toBe('')
  })

  test('añade el texto del mensaje codificado', () => {
    expect(enlaceWhatsApp('612345678', 'Hola, ¿sigue disponible?')).toBe(
      'https://wa.me/34612345678?text=Hola%2C%20%C2%BFsigue%20disponible%3F',
    )
  })

  test('detecta los números nacionales españoles', () => {
    expect(esNumeroNacionalEspanol('612345678')).toBe(true)
    expect(esNumeroNacionalEspanol('812345678')).toBe(true)
    expect(esNumeroNacionalEspanol('34612345678')).toBe(false)
  })
})
