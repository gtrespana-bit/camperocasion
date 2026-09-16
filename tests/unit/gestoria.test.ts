/**
 * Tests de la captación de leads de gestoría.
 *
 * Lo que se protege:
 *  1. La validación del lead (la misma en la API): nombre, email y teléfono
 *     mínimos; los campos opcionales no bloquean nunca un lead válido.
 *  2. Que una matrícula mal escrita NO tire el lead (se guarda tal cual).
 *  3. Que el embudo nueva → en gestión → cerrada sea el único camino y que se
 *     pueda reabrir un caso cerrado.
 */
import {
  ESTADOS_GESTORIA,
  GESTORIA_PRECIO_MAX,
  GESTORIA_PRECIO_MIN,
  TRANSICIONES_GESTORIA,
  puedeTransicionarGestoria,
  validarLeadGestoria,
} from '@/lib/gestoria'

const LEAD_VALIDO = {
  nombre: 'Ana García',
  email: 'ana@example.com',
  telefono: '600 123 456',
}

describe('validación del lead', () => {
  it('acepta un lead correcto y normaliza', () => {
    const r = validarLeadGestoria({ ...LEAD_VALIDO, email: '  ANA@Example.COM ' })
    expect(r.valid).toBe(true)
    expect(r.datos?.email).toBe('ana@example.com')
    expect(r.datos?.telefono).toBe('600 123 456')
    expect(r.datos?.provincia).toBeNull()
    expect(r.datos?.matricula).toBeNull()
  })

  it('rechaza nombre corto, email inválido y teléfono absurdo', () => {
    expect(validarLeadGestoria({ ...LEAD_VALIDO, nombre: 'A' }).valid).toBe(false)
    expect(validarLeadGestoria({ ...LEAD_VALIDO, email: 'no-es-un-email' }).valid).toBe(false)
    expect(validarLeadGestoria({ ...LEAD_VALIDO, telefono: '123' }).valid).toBe(false)
    expect(validarLeadGestoria({ ...LEAD_VALIDO, telefono: 'hola' }).valid).toBe(false)
  })

  it('acepta teléfonos internacionales con +', () => {
    expect(validarLeadGestoria({ ...LEAD_VALIDO, telefono: '+34 600 123 456' }).valid).toBe(true)
    expect(validarLeadGestoria({ ...LEAD_VALIDO, telefono: '+4915112345678' }).valid).toBe(true)
  })

  it('una matrícula inválida no tira el lead (se guarda tal cual)', () => {
    const r = validarLeadGestoria({ ...LEAD_VALIDO, matricula: 'abc-12' })
    expect(r.valid).toBe(true)
    expect(r.datos?.matricula).toBe('abc-12')
  })

  it('normaliza matrículas válidas a mayúsculas', () => {
    const r = validarLeadGestoria({ ...LEAD_VALIDO, matricula: '1234 abc' })
    expect(r.valid).toBe(true)
    expect(r.datos?.matricula).toBe('1234 ABC')
  })

  it('recorta mensaje y provincia largos en vez de rechazarlos', () => {
    const r = validarLeadGestoria({
      ...LEAD_VALIDO,
      mensaje: 'x'.repeat(5000),
      provincia: 'Comunitat Valenciana ' + 'y'.repeat(200),
    })
    expect(r.valid).toBe(true)
    expect(r.datos?.mensaje?.length).toBeLessThanOrEqual(1000)
    expect(r.datos?.provincia?.length).toBeLessThanOrEqual(60)
  })
})

describe('embudo de la gestoría', () => {
  it('el camino es nueva → en gestión → cerrada, y se puede reabrir', () => {
    expect(TRANSICIONES_GESTORIA.nueva).toEqual(['en_gestion', 'cerrada'])
    expect(TRANSICIONES_GESTORIA.en_gestion).toEqual(['cerrada', 'nueva'])
    expect(TRANSICIONES_GESTORIA.cerrada).toEqual(['en_gestion'])
  })

  it('no se pasa de cerrada a cerrada ni se salta el embudo', () => {
    expect(puedeTransicionarGestoria('nueva', 'nueva')).toBe(false)
    expect(puedeTransicionarGestoria('basura', 'en_gestion')).toBe(false)
    expect(puedeTransicionarGestoria('nueva', 'en_gestion')).toBe(true)
  })

  it('los tres estados están definidos con etiqueta', () => {
    expect(ESTADOS_GESTORIA).toEqual(['nueva', 'en_gestion', 'cerrada'])
  })

  it('el precio orientativo publicado es 89-149 €', () => {
    expect(GESTORIA_PRECIO_MIN).toBe(89)
    expect(GESTORIA_PRECIO_MAX).toBe(149)
  })
})
