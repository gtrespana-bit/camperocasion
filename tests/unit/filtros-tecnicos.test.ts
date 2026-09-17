/**
 * Tests del registro de filtros técnicos del catálogo.
 *
 * Lo que se protege aquí:
 *  1. Que la captura (/publicar) y el filtro (catálogo) no diverjan: cada filtro
 *     tiene que existir como campo de formulario y sus opciones tienen que
 *     salir de la misma lista.
 *  2. Que los filtros se traduzcan a UNA condición de contención JSONB (`@>`,
 *     el operador que cubre el índice GIN `productos_especificaciones_idx`) y no
 *     a una condición por campo con `->>`.
 *  3. Que parámetros desconocidos o vacíos no ensucien la consulta ni la caché.
 */
import {
  FILTROS_TECNICOS,
  GRUPOS_FILTROS_TECNICOS,
  CAMPOS_TECNICOS,
  PARAMETROS_TECNICOS,
  RANGOS_NUMERICOS,
  leerFiltrosTecnicos,
  limpiarFiltrosTecnicos,
  hayFiltrosTecnicos,
  especificacionesDeFiltros,
  aplicarFiltrosTecnicos,
  firmaFiltrosTecnicos,
  leerFiltrosRango,
  limpiarFiltrosRango,
  hayFiltrosRango,
  firmaFiltrosRango,
  parsearNumeroEs,
} from '@/lib/filtros-tecnicos'
import { categoriasData, resolverCampos } from '@/lib/categorias'

describe('registro de filtros técnicos', () => {
  test('los parámetros y las claves JSONB son únicos', () => {
    const params = FILTROS_TECNICOS.map(f => f.param)
    const campos = FILTROS_TECNICOS.map(f => f.campo)

    expect(new Set(params).size).toBe(params.length)
    expect(new Set(campos).size).toBe(campos.length)
    expect(PARAMETROS_TECNICOS).toEqual(params)
    expect(CAMPOS_TECNICOS).toEqual(Object.fromEntries(FILTROS_TECNICOS.map(f => [f.param, f.campo])))
  })

  test('cada filtro ofrezca opciones', () => {
    for (const filtro of FILTROS_TECNICOS) {
      expect(filtro.opciones.length).toBeGreaterThan(0)
      expect(filtro.i18n).toMatch(/^catalog\.filters\./)
    }
  })

  test('los filtros técnicos se agrupan en mecánica, habitabilidad y autonomía', () => {
    expect(GRUPOS_FILTROS_TECNICOS.map(g => g.grupo)).toEqual(['mecanica', 'habitabilidad', 'autonomia'])
    const agrupados = GRUPOS_FILTROS_TECNICOS.flatMap(g => g.filtros)
    expect(agrupados).toHaveLength(FILTROS_TECNICOS.length)
    for (const grupo of GRUPOS_FILTROS_TECNICOS) {
      expect(grupo.filtros.every(f => f.grupo === grupo.grupo)).toBe(true)
    }
  })

  test('cada filtro existe como campo del formulario de publicación con las mismas opciones', () => {
    for (const sub of categoriasData.camper.subs) {
      const campos = resolverCampos(sub)
      for (const filtro of FILTROS_TECNICOS) {
        const campo = campos.find(c => c.label === filtro.campo)
        expect(campo).toBeDefined()
        // Las opciones del filtro son un subconjunto de las del formulario: el
        // filtro nunca ofrece un valor que el vendedor no pueda declarar.
        for (const opcion of filtro.opciones) {
          expect(campo!.options).toContain(opcion)
        }
      }
    }
  })

  test('los campos de medida y tracción se capturan en todas las subcategorías', () => {
    for (const sub of categoriasData.camper.subs) {
      const labels = resolverCampos(sub).map(c => c.label)
      const repetidos = labels.filter((l, i) => labels.indexOf(l) !== i)
      expect(repetidos).toEqual([])
      expect(labels).toEqual(expect.arrayContaining(['Tracción', 'Longitud exterior', 'Altura exterior']))
    }
  })
})

describe('lectura de filtros desde la query string', () => {
  test('lee los parámetros conocidos y descarta vacíos y desconocidos', () => {
    const params = new URLSearchParams('dgt=ECO&plazasDormir=4&precioMin=20000&marca=&raro=1')

    expect(leerFiltrosTecnicos(params)).toEqual({ dgt: 'ECO', plazasDormir: '4' })
  })

  test('acepta la forma de searchParams de Next.js (string | string[])', () => {
    expect(leerFiltrosTecnicos({ bano: 'Sin baño', dgt: ['ECO'], marca: 'Fiat Ducato', vacio: '' })).toEqual({
      bano: 'Sin baño',
      dgt: 'ECO',
    })
  })

  test('sin parámetros devuelve un objeto vacío', () => {
    expect(leerFiltrosTecnicos(null)).toEqual({})
    expect(leerFiltrosTecnicos(undefined)).toEqual({})
    expect(leerFiltrosTecnicos(new URLSearchParams())).toEqual({})
  })

  test('recorta espacios y descarta parámetros desconocidos', () => {
    expect(limpiarFiltrosTecnicos({ dgt: '  ECO  ', inventado: 'x', altura: '   ' })).toEqual({ dgt: 'ECO' })
    expect(hayFiltrosTecnicos({ inventado: 'x' })).toBe(false)
    expect(hayFiltrosTecnicos({ dgt: 'ECO' })).toBe(true)
    expect(hayFiltrosTecnicos(null)).toBe(false)
  })
})

describe('traducción a la consulta de Supabase', () => {
  test('traduce los parámetros a las claves del JSONB especificaciones', () => {
    expect(especificacionesDeFiltros({ plazasDormir: '4', mma: 'Hasta 3.500 kg (carnet B)' })).toEqual({
      'Plazas para dormir': '4',
      'MMA / Peso máximo autorizado': 'Hasta 3.500 kg (carnet B)',
    })
  })

  test('aplica todos los filtros en UNA contención JSONB (índice GIN)', () => {
    const llamadas: unknown[] = []
    const query = {
      contains: (column: string, value: Record<string, string>) => {
        llamadas.push([column, value])
        return query
      },
    }

    const resultado = aplicarFiltrosTecnicos(query, { dgt: 'ECO', plazasDormir: '4', calefaccion: 'No tiene' })

    expect(resultado).toBe(query)
    expect(llamadas).toEqual([
      ['especificaciones', { 'Distintivo Ambiental DGT': 'ECO', 'Plazas para dormir': '4', 'Calefacción estacionaria': 'No tiene' }],
    ])
  })

  test('sin filtros activos devuelve la consulta intacta (una sola llamada por query)', () => {
    const contains = jest.fn()
    const query = { contains }

    expect(aplicarFiltrosTecnicos(query, {})).toBe(query)
    expect(aplicarFiltrosTecnicos(query, { precioMin: '20000' })).toBe(query)
    expect(contains).not.toHaveBeenCalled()
  })
})

describe('firma de filtros', () => {
  test('es estable e independiente del orden de las claves', () => {
    const a = firmaFiltrosTecnicos({ dgt: 'ECO', plazasDormir: '4' })
    const b = firmaFiltrosTecnicos({ plazasDormir: '4', dgt: 'ECO' })

    expect(a).toBe(b)
    expect(a).toBe('dgt=ECO&plazasDormir=4')
  })

  test('cambia al cambiar un valor y se vacía sin filtros', () => {
    expect(firmaFiltrosTecnicos({ dgt: 'ECO' })).not.toBe(firmaFiltrosTecnicos({ dgt: 'Cero Emisiones' }))
    expect(firmaFiltrosTecnicos({})).toBe('')
    expect(firmaFiltrosTecnicos(null)).toBe('')
  })
})

describe('rangos numéricos', () => {
  test('los rangos cubren km, año y watios con columna generada esperada', () => {
    expect(RANGOS_NUMERICOS.map(r => r.param)).toEqual([
      'kmMax', 'anioMin', 'placaWatiosMin', 'inversorWatiosMin',
    ])
    for (const r of RANGOS_NUMERICOS) {
      expect(r.columnaGenerada).toMatch(/^espec_/)
      expect(r.campo).toBeTruthy()
      expect(r.claves).toContain(r.campo)
    }
    expect(RANGOS_NUMERICOS.find(r => r.param === 'kmMax')!.operador).toBe('lte')
    expect(RANGOS_NUMERICOS.find(r => r.param === 'anioMin')!.operador).toBe('gte')
  })

  test('parsea números en formato español e internacional', () => {
    expect(parsearNumeroEs('145000')).toBe(145000)
    expect(parsearNumeroEs('145.000')).toBe(145000)
    expect(parsearNumeroEs('12,5')).toBe(12.5)
    expect(parsearNumeroEs('200')).toBe(200)
    expect(parsearNumeroEs(240)).toBe(240)
    expect(parsearNumeroEs('abc')).toBeNull()
    expect(parsearNumeroEs('')).toBeNull()
    expect(parsearNumeroEs('1450.500')).toBe(1450500) // heurístico US/miles → un solo número
  })

  test('lee y limpia los rangos de la query string', () => {
    expect(leerFiltrosRango(new URLSearchParams('kmMax=150000&anioMin=2019&placaWatiosMin=200'))).toEqual({
      kmMax: 150000, anioMin: 2019, placaWatiosMin: 200,
    })
    expect(leerFiltrosRango(new URLSearchParams('kmMax=abc&foo=1'))).toEqual({})
    expect(limpiarFiltrosRango({ kmMax: '150000', anioMin: 2019, raro: 'x' })).toEqual({ kmMax: 150000, anioMin: 2019 })
    expect(hayFiltrosRango({ kmMax: 1 })).toBe(true)
    expect(hayFiltrosRango({ raro: 1 })).toBe(false)
    expect(hayFiltrosRango(null)).toBe(false)
  })

  test('firma de rangos estable e independiente del orden', () => {
    const a = firmaFiltrosRango({ kmMax: 150000, anioMin: 2019 })
    const b = firmaFiltrosRango({ anioMin: 2019, kmMax: 150000 })
    expect(a).toBe(b)
    expect(a).toBe('kmMax=150000&anioMin=2019')
    expect(firmaFiltrosRango({})).toBe('')
  })
})
