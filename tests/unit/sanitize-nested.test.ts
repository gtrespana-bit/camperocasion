/**
 * Tests de sanitización de objetos ANIDADOS.
 *
 * Al empezar a guardar `especificaciones` (JSONB con las specs del paso 2 de
 * /publicar) apareció un hueco de seguridad: `sanitizeObject` solo sanitizaba
 * strings de primer nivel y arrays; los objetos anidados se copiaban tal cual,
 * así que un payload XSS dentro de `especificaciones` llegaba intacto a la DB
 * y luego se renderizaba en la ficha del producto.
 */
import { sanitizeObject, sanitizeString } from '@/lib/validation'

describe('sanitizeObject: objetos anidados', () => {
  test('sanitiza los valores dentro de `especificaciones`', () => {
    const out = sanitizeObject({
      titulo: 'Radiador Ford Explorer',
      especificaciones: {
        Marca: '<script>alert(1)</script>Ford',
        Modelo: 'Explorer <img src=x onerror=alert(1)>',
      },
    })

    expect(out.especificaciones.Marca).toBe('Ford')
    expect(out.especificaciones.Modelo).not.toContain('<img')
    expect(out.especificaciones.Modelo).not.toContain('onerror')
  })

  test('sanitiza también las CLAVES del objeto anidado', () => {
    const out = sanitizeObject({
      especificaciones: { '<script>x</script>Marca': 'Ford' },
    })
    expect(Object.keys(out.especificaciones)[0]).toBe('Marca')
  })

  test('sanitiza metodos_contacto (objeto anidado ya existente)', () => {
    const out = sanitizeObject({
      metodos_contacto: { whatsapp: '<b>+58412</b>', email: 'a@b.com' },
    })
    expect(out.metodos_contacto.whatsapp).toBe('+58412')
    expect(out.metodos_contacto.email).toBe('a@b.com')
  })

  test('preserva los valores legítimos sin alterarlos', () => {
    const out = sanitizeObject({
      especificaciones: { Marca: 'Ford', 'Tipo de repuesto': 'Radiador', Año: '2012' },
    })
    expect(out.especificaciones).toEqual({
      Marca: 'Ford',
      'Tipo de repuesto': 'Radiador',
      Año: '2012',
    })
  })

  test('no rompe con null, números, booleanos ni arrays', () => {
    const out = sanitizeObject({
      precio_usd: 120.5,
      activo: true,
      categoria_id: null,
      imagenes: ['https://cdn/a.webp', '<script>x</script>b'],
      especificaciones: null,
    })
    expect(out.precio_usd).toBe(120.5)
    expect(out.activo).toBe(true)
    expect(out.categoria_id).toBeNull()
    expect(out.imagenes[0]).toBe('https://cdn/a.webp')
    expect(out.imagenes[1]).toBe('b')
    expect(out.especificaciones).toBeNull()
  })

  test('acota la profundidad sin lanzar (objeto muy anidado)', () => {
    let profundo: any = 'x'
    for (let i = 0; i < 50; i++) profundo = { nivel: profundo }
    expect(() => sanitizeObject({ data: profundo })).not.toThrow()
  })

  test('no entra en bucle infinito con referencias cíclicas', () => {
    const ciclico: any = { nombre: 'a' }
    ciclico.self = ciclico
    expect(() => sanitizeObject({ data: ciclico })).not.toThrow()
  })
})

describe('sanitizeString', () => {
  test('elimina scripts y tags pero conserva el texto', () => {
    expect(sanitizeString('<script>alert(1)</script>Hola')).toBe('Hola')
    expect(sanitizeString('Ford <b>Explorer</b>')).toBe('Ford Explorer')
  })
})
