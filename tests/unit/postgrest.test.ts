import { esErrorColumnaAusente } from '@/lib/postgrest'

describe('esErrorColumnaAusente (fallback de /api/publicar)', () => {
  const pgrst204 = (mensaje: string, code = 'PGRST204') => ({ code, message: mensaje })

  it('reconoce solo el PGRST204 exacto de PostgREST', () => {
    expect(esErrorColumnaAusente(
      pgrst204("Could not find the 'especificaciones' column of 'productos' in the schema cache"),
      'especificaciones',
    )).toBe(true)
  })

  it('NO reintenta con errores de trigger/CHECK que mencionan la columna', () => {
    // Antes el fallback hacía /especificaciones/i.test(error.message) y volvía
    // a insertar: podía crear un anuncio duplicado y escondía el fallo real.
    expect(esErrorColumnaAusente(
      { code: '23514', message: 'new row violates check constraint "productos_especificaciones_check"' },
      'especificaciones',
    )).toBe(false)
    expect(esErrorColumnaAusente(
      { code: 'P0001', message: 'trigger: especificaciones inválidas' },
      'especificaciones',
    )).toBe(false)
  })

  it('NO reintenta si el mensaje nombra OTRA columna', () => {
    expect(esErrorColumnaAusente(
      pgrst204("Could not find the 'otra_columna' column of 'productos' in the schema cache"),
      'especificaciones',
    )).toBe(false)
  })

  it('NO reintenta sin código, aunque el mensaje se parezca', () => {
    expect(esErrorColumnaAusente(
      { message: "Could not find the 'especificaciones' column of 'productos' in the schema cache" },
      'especificaciones',
    )).toBe(false)
  })

  it('tolera errores nulos o de otro tipo', () => {
    expect(esErrorColumnaAusente(null, 'especificaciones')).toBe(false)
    expect(esErrorColumnaAusente('PGRST204', 'especificaciones')).toBe(false)
    expect(esErrorColumnaAusente({ code: null, message: null }, 'especificaciones')).toBe(false)
  })
})
