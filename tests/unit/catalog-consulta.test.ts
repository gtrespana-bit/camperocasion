/**
 * Tests de la consulta compartida del catálogo.
 *
 * Los tres sitios que consultan productos (SSR inicial, useProductLoader y
 * usePrefetch) comparten la caché del cliente, que indexa por filtros + página.
 * Si uno filtrara u ordenara distinto, el usuario vería una página incoherente
 * al cambiar de página. Aquí se fija ese contrato.
 */
import {
  CATALOG_FILTRO_MODERACION,
  CATALOG_PRODUCT_COLUMNS,
  FILTRO_VERIFICADA_PARAM,
  FILTRO_VENDEDOR_PARAM,
  aplicarFiltrosCatalogo,
  aplicarRangosNumericos,
  quitarRangos,
  tieneRangosNumericos,
  filtroVerificadaActivo,
  tipoVendedorFiltro,
  marcarDestacados,
  ordenarProductosCatalogo,
  BOOST_DIAS,
  boostVigente,
  ORDEN_CATALOGO,
} from '@/lib/catalog-consulta'

describe('columnas y filtro de moderación', () => {
  test('las columnas incluyen slug (URL canónica) y los dos sellos', () => {
    const columnas = CATALOG_PRODUCT_COLUMNS.split(',').map(c => c.trim())
    expect(columnas).toContain('slug')
    expect(columnas).toContain('vendedor_verificado')
    expect(columnas).toContain('vendedor_tipo')
    expect(columnas).toContain('verificacion_homologacion')
  })

  test('el filtro de moderación deja fuera lo rechazado', () => {
    expect(CATALOG_FILTRO_MODERACION).toContain('estado_moderacion.is.null')
    expect(CATALOG_FILTRO_MODERACION).toContain('estado_moderacion.eq.aprobado')
    expect(CATALOG_FILTRO_MODERACION).toContain('estado_moderacion.eq.pendiente')
    expect(CATALOG_FILTRO_MODERACION).not.toContain('rechazado')
  })
})

describe('aplicarFiltrosCatalogo', () => {
  const crearQuery = () => {
    const llamadas: unknown[] = []
    const query: any = {
      llamadas,
      contains: (columna: string, valor: unknown) => { llamadas.push(['contains', columna, valor]); return query },
      eq: (columna: string, valor: unknown) => { llamadas.push(['eq', columna, valor]); return query },
      gte: (columna: string, valor: unknown) => { llamadas.push(['gte', columna, valor]); return query },
      lte: (columna: string, valor: unknown) => { llamadas.push(['lte', columna, valor]); return query },
    }
    return query
  }

  test('sin filtros no toca la consulta', () => {
    const query = crearQuery()
    expect(aplicarFiltrosCatalogo(query, {})).toBe(query)
    expect(aplicarFiltrosCatalogo(query, null)).toBe(query)
    expect(query.llamadas).toEqual([])
  })

  test('los filtros técnicos van en una sola contención sobre el JSONB', () => {
    const query = crearQuery()
    aplicarFiltrosCatalogo(query, { plazasDormir: '4', bano: 'Sin baño', precioMin: '20000' })

    expect(query.llamadas).toEqual([
      ['contains', 'especificaciones', { 'Plazas para dormir': '4', 'Baño / Ducha': 'Sin baño' }],
    ])
  })

  test('el filtro de homologación verificada usa la columna, no el JSONB', () => {
    const query = crearQuery()
    aplicarFiltrosCatalogo(query, { [FILTRO_VERIFICADA_PARAM]: '1' })

    expect(query.llamadas).toEqual([['eq', 'verificacion_homologacion', 'verificada']])
  })

  test('combina los dos tipos de filtro cuando están activos', () => {
    const query = crearQuery()
    aplicarFiltrosCatalogo(query, { [FILTRO_VERIFICADA_PARAM]: '1', mma: 'Hasta 3.500 kg (carnet B)' })

    expect(query.llamadas).toEqual([
      ['contains', 'especificaciones', { 'MMA / Peso máximo autorizado': 'Hasta 3.500 kg (carnet B)' }],
      ['eq', 'verificacion_homologacion', 'verificada'],
    ])
  })

  test('el filtro de tipo de vendedor usa la columna denormalizada', () => {
    const query = crearQuery()
    aplicarFiltrosCatalogo(query, { [FILTRO_VENDEDOR_PARAM]: 'camperizador' })

    expect(query.llamadas).toEqual([['eq', 'vendedor_tipo', 'camperizador']])
  })

  test('un tipo de vendedor inventado en la URL no toca la consulta', () => {
    const query = crearQuery()
    aplicarFiltrosCatalogo(query, { [FILTRO_VENDEDOR_PARAM]: 'empresa' })
    aplicarFiltrosCatalogo(query, { [FILTRO_VENDEDOR_PARAM]: 42 })

    expect(query.llamadas).toEqual([])
  })

  test('tipoVendedorFiltro solo acepta los tres tipos válidos', () => {
    expect(tipoVendedorFiltro('particular')).toBe('particular')
    expect(tipoVendedorFiltro('camperizador')).toBe('camperizador')
    expect(tipoVendedorFiltro('profesional')).toBe('profesional')
    expect(tipoVendedorFiltro('profesionales')).toBeNull()
    expect(tipoVendedorFiltro('')).toBeNull()
    expect(tipoVendedorFiltro(undefined)).toBeNull()
  })

  test('los rangos numéricos se aplican sobre las columnas generadas (no el JSONB)', () => {
    const query = crearQuery()
    aplicarFiltrosCatalogo(query, { kmMax: '150000', anioMin: '2019', placaWatiosMin: '200' })

    expect(query.llamadas).toEqual([
      ['lte', 'espec_km', 150000],
      ['gte', 'espec_anio', 2019],
      ['gte', 'espec_placa_w', 200],
    ])
  })

  test('sin rangos no se toca la consulta', () => {
    const query = crearQuery()
    expect(aplicarRangosNumericos(query, {})).toBe(query)
    expect(aplicarRangosNumericos(query, { precioMin: '20000' })).toBe(query)
    expect(query.llamadas).toEqual([])
  })

  test('quitarRangos y tieneRangosNumericos', () => {
    expect(tieneRangosNumericos({ kmMax: 1 })).toBe(true)
    expect(tieneRangosNumericos({ q: 'x' })).toBe(false)

    const sinRangos = quitarRangos({ q: 'ducato', kmMax: 150000, anioMin: 2019 })
    expect(sinRangos).toEqual({ q: 'ducato' })
    expect(quitarRangos(null)).toEqual({})
  })

  test('solo se considera activo con valores afirmativos', () => {
    expect(filtroVerificadaActivo('1')).toBe(true)
    expect(filtroVerificadaActivo(true)).toBe(true)
    expect(filtroVerificadaActivo('si')).toBe(true)
    expect(filtroVerificadaActivo('')).toBe(false)
    expect(filtroVerificadaActivo(undefined)).toBe(false)
    expect(filtroVerificadaActivo('0')).toBe(false)
  })
})

describe('orden del catálogo', () => {
  const producto = (over: Record<string, unknown> = {}) => ({
    id: String(Math.random()),
    titulo: 'Fiat Ducato',
    precio_usd: 38500,
    estado: 'Usado',
    imagen_url: null,
    ubicacion_ciudad: 'Madrid',
    ubicacion_estado: 'Madrid',
    creado_en: '2026-09-01T10:00:00.000Z',
    subcategoria: 'Gran Volumen',
    boosteado_en: null,
    destacado: false,
    destacado_hasta: null,
    vendedor_verificado: false,
    verificacion_homologacion: 'sin_verificar',
    ...over,
  }) as any

  test('prioriza boost vigente > destacado vigente > fecha', () => {
    const antiguo = producto({ creado_en: '2026-01-01T00:00:00.000Z' })
    const reciente = producto({ creado_en: '2026-09-10T00:00:00.000Z' })
    // Relativo a "ahora": un boost dura BOOST_DIAS, así que una fecha fija
    // dejaría el test roto (o verde por casualidad) según el día que se corra.
    const boosteado = producto({ boosteado_en: new Date(Date.now() - 3600e3).toISOString() })
    const destacado = producto({ destacado: true, destacado_hasta: '2099-01-01T00:00:00.000Z' })

    const orden = ordenarProductosCatalogo([antiguo, reciente, destacado, boosteado])

    expect(orden[0]).toBe(boosteado)
    expect(orden[1]).toBe(destacado)
    expect(orden[2]).toBe(reciente)
    expect(orden[3]).toBe(antiguo)
  })

  test('un destacado caducado no adelanta a un reciente', () => {
    const caducado = producto({ destacado: true, destacado_hasta: '2020-01-01T00:00:00.000Z', creado_en: '2026-01-01T00:00:00.000Z' })
    const reciente = producto({ creado_en: '2026-09-10T00:00:00.000Z' })

    expect(ordenarProductosCatalogo([caducado, reciente])[0]).toBe(reciente)
  })

  test('un boost caducado deja de adelantar (se puede volver a comprar)', () => {
    const caducado = producto({
      boosteado_en: new Date(Date.now() - (BOOST_DIAS + 1) * 864e5).toISOString(),
      creado_en: '2026-01-01T00:00:00.000Z',
    })
    const reciente = producto({ creado_en: '2026-09-10T00:00:00.000Z' })

    expect(ordenarProductosCatalogo([caducado, reciente])[0]).toBe(reciente)
    expect(boostVigente(caducado.boosteado_en)).toBe(false)
    expect(boostVigente(new Date(Date.now() - 3600e3).toISOString())).toBe(true)
  })

  test('el ORDER BY de SQL es el mismo orden que aplica el comparador', () => {
    // La ventana de la página la define la consulta; si el orden de SQL no
    // coincide con el de memoria, un anuncio pagado puede caer fuera de la
    // primera página. Este test fija ese contrato.
    expect(ORDEN_CATALOGO.map(o => o.column)).toEqual([
      'boosteado_en',
      'destacado',
      'destacado_hasta',
      'creado_en',
    ])
    expect(ORDEN_CATALOGO.every(o => o.ascending === false)).toBe(true)
  })

  test('no muta el array recibido y pre-computa el flag de destacado', () => {
    const productos = [
      producto({ destacado: true, destacado_hasta: '2099-01-01T00:00:00.000Z' }),
      producto(),
    ]
    const copia = [...productos]

    const ordenados = ordenarProductosCatalogo(productos)
    expect(productos).toEqual(copia)

    const marcados = marcarDestacados(productos)
    expect(marcados[0]._isFeatured).toBe(true)
    expect(marcados[1]._isFeatured).toBe(false)
  })
})
