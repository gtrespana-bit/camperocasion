import {
  agregarVisitas,
  agruparFuentes,
  bucketsDelRango,
  clasificarRuta,
  claveDia,
  dispositivoDesdeAncho,
  divisionSegura,
  formatearDuracion,
  fuenteDeHost,
  hostDesdeReferrer,
  inicioDiaMadrid,
  inicioSemanaMadrid,
  normalizarRuta,
  normalizarVisita,
  porcentajeVariacion,
  resolverRango,
  serieDeFechas,
  serieDiasSemana,
  serieHoras,
} from '@/lib/analitica'

// 29 de septiembre de 2026, 12:00 UTC = 14:00 en Madrid (CEST, UTC+2).
const MEDIODIA = new Date('2026-09-29T12:00:00Z')

describe('clasificación de rutas', () => {
  test('reconoce las páginas principales', () => {
    expect(clasificarRuta('/').tipo).toBe('home')
    expect(clasificarRuta('/catalogo').tipo).toBe('catalogo')
    expect(clasificarRuta('/buscar?q=ducato').tipo).toBe('buscar')
    expect(clasificarRuta('/blog/como-homologar').tipo).toBe('blog')
    expect(clasificarRuta('/tienda/taller-norte').tipo).toBe('tienda')
    expect(clasificarRuta('/vendedor/abc-123').tipo).toBe('vendedor')
    expect(clasificarRuta('/publicar').tipo).toBe('publicar')
  })

  test('la ficha de producto guarda el slug', () => {
    const ficha = clasificarRuta('/producto/vw-california-2007')
    expect(ficha.tipo).toBe('producto')
    expect(ficha.slug).toBe('vw-california-2007')
    // Editar un anuncio no es una visita a una ficha.
    expect(clasificarRuta('/producto/editar/abc').slug).toBeNull()
  })

  test('quita el prefijo de idioma y la query', () => {
    expect(normalizarRuta('/en/catalogo?pagina=2')).toBe('/catalogo')
    expect(normalizarRuta('/es/')).toBe('/')
    expect(normalizarRuta('/catalogo/')).toBe('/catalogo')
    expect(clasificarRuta('/en/producto/x-1').tipo).toBe('producto')
  })

  test('las landings de provincia se identifican', () => {
    expect(clasificarRuta('/madrid').tipo).toBe('provincia')
    expect(clasificarRuta('/madrid/gran-volumen').tipo).toBe('provincia')
  })
})

describe('fechas en hora peninsular', () => {
  test('el día empieza a medianoche de Madrid', () => {
    expect(inicioDiaMadrid(MEDIODIA).toISOString()).toBe('2026-09-28T22:00:00.000Z')
  })

  test('a las 23:30 UTC en Madrid ya es el día siguiente', () => {
    expect(claveDia(new Date('2026-09-29T23:30:00Z'))).toBe('2026-09-30')
    expect(claveDia(MEDIODIA)).toBe('2026-09-29')
  })

  test('la semana empieza el lunes', () => {
    // 29/09/2026 es martes; su lunes es el 28.
    expect(inicioSemanaMadrid(MEDIODIA).toISOString()).toBe('2026-09-27T22:00:00.000Z')
  })
})

describe('rangos y buckets', () => {
  test('7 días = 7 buckets diarios, incluido hoy', () => {
    const rango = resolverRango({ preset: '7d', ahora: MEDIODIA })
    expect(rango.granularidad).toBe('dia')
    expect(rango.desde.toISOString()).toBe('2026-09-22T22:00:00.000Z')
    expect(rango.hasta.toISOString()).toBe('2026-09-29T22:00:00.000Z')
    const buckets = bucketsDelRango(rango)
    expect(buckets).toHaveLength(7)
    expect(buckets[0].clave).toBe('2026-09-23')
    expect(buckets[6].clave).toBe('2026-09-29')
  })

  test('12 meses se agrupan por mes y salen 12 buckets', () => {
    const rango = resolverRango({ preset: '12m', ahora: MEDIODIA })
    expect(rango.granularidad).toBe('mes')
    const buckets = bucketsDelRango(rango)
    expect(buckets).toHaveLength(12)
    expect(buckets[0].clave).toBe('2025-10')
    expect(buckets[11].clave).toBe('2026-09')
  })

  test('este mes empieza el día 1 (en Madrid)', () => {
    const rango = resolverRango({ preset: 'mes', ahora: MEDIODIA })
    expect(rango.desde.toISOString()).toBe('2026-08-31T22:00:00.000Z')
  })

  test('un rango personalizado desmedido se recorta', () => {
    const rango = resolverRango({
      preset: 'personalizado',
      desde: '2010-01-01',
      hasta: '2026-09-29',
      ahora: MEDIODIA,
    })
    const dias = Math.round((rango.hasta.getTime() - rango.desde.getTime()) / 86400000)
    expect(dias).toBeLessThanOrEqual(366 * 3)
  })
})

describe('agregados', () => {
  const rango = resolverRango({ preset: '7d', ahora: MEDIODIA })
  const filas = [
    { creado_en: '2026-09-29T09:00:00Z', visitante_id: 'a', sesion_id: 's1', duracion_segundos: 30, dispositivo: 'movil', idioma: 'es', referrer_host: 'www.google.com', ruta: '/', tipo: 'home' },
    { creado_en: '2026-09-29T09:05:00Z', visitante_id: 'a', sesion_id: 's1', duracion_segundos: null, dispositivo: 'movil', idioma: 'es', referrer_host: null, ruta: '/catalogo', tipo: 'catalogo' },
    { creado_en: '2026-09-28T18:00:00Z', visitante_id: 'b', sesion_id: 's2', duracion_segundos: 90, dispositivo: 'escritorio', idioma: 'en', referrer_host: 'instagram.com', ruta: '/producto/x', tipo: 'producto' },
  ]

  test('cuenta visitas, visitantes únicos y sesiones', () => {
    const resumen = agregarVisitas(filas, rango)
    expect(resumen.visitas).toBe(3)
    expect(resumen.visitantes).toBe(2)
    expect(resumen.sesiones).toBe(2)
    expect(resumen.paginasPorVisita).toBe(1.5)
    // (30 + 90) / 2 muestras
    expect(resumen.duracionMedia).toBe(60)
    // Los «nuevos» requieren mirar fuera del rango: en el plan B no se inventan.
    expect(resumen.nuevos).toBeNull()
  })

  test('la serie coloca cada visita en su día', () => {
    const resumen = agregarVisitas(filas, rango)
    expect(resumen.serie).toHaveLength(7)
    expect(resumen.serie[5].clave).toBe('2026-09-28')
    expect(resumen.serie[5].visitas).toBe(1)
    expect(resumen.serie[6].clave).toBe('2026-09-29')
    expect(resumen.serie[6].visitas).toBe(2)
    expect(resumen.serie[6].visitantes).toBe(1)
  })

  test('las horas y los días van completos aunque no tengan datos', () => {
    const resumen = agregarVisitas(filas, rango)
    expect(resumen.horas).toHaveLength(24)
    expect(resumen.diasSemana).toHaveLength(7)
    expect(serieHoras([{ hora: 9, visitas: 3 }])).toHaveLength(24)
    expect(serieHoras([{ hora: 9, visitas: 3 }])[9].visitas).toBe(3)
    expect(serieHoras([{ hora: 9, visitas: 3 }])[10].visitas).toBe(0)
    expect(serieDiasSemana([{ dow: 3, visitas: 5 }]).map((d) => d.visitas)).toEqual([0, 0, 5, 0, 0, 0, 0])
  })

  test('los rankings salen ordenados por visitas', () => {
    const resumen = agregarVisitas(filas, rango)
    expect(resumen.dispositivos[0].clave).toBe('movil')
    expect(resumen.topPaginas.map((p) => p.clave)).toContain('/catalogo')
  })

  test('serieDeFechas agrupa por bucket y respeta las nulas', () => {
    const serie = serieDeFechas(['2026-09-29T09:00:00Z', null, '2026-09-29T10:00:00Z', '2026-09-20T10:00:00Z'], rango)
    expect(serie).toHaveLength(7)
    expect(serie[6]).toBe(2)
    expect(serie.reduce((a, b) => a + b, 0)).toBe(2)
  })
})

describe('métricas y formateo', () => {
  test('variación contra el periodo anterior', () => {
    expect(porcentajeVariacion(120, 100)).toBe(20)
    expect(porcentajeVariacion(80, 100)).toBe(-20)
    expect(porcentajeVariacion(5, 0)).toBe(100)
    expect(porcentajeVariacion(0, 0)).toBeNull()
  })

  test('duración legible', () => {
    expect(formatearDuracion(45)).toBe('45 s')
    expect(formatearDuracion(90)).toBe('1 min 30 s')
    expect(formatearDuracion(3720)).toBe('1 h 2 min')
    expect(formatearDuracion(null)).toBe('—')
  })

  test('divisiones sin ceros raros', () => {
    expect(divisionSegura(10, 4)).toBe(2.5)
    expect(divisionSegura(10, 0)).toBeNull()
  })
})

describe('dispositivos y fuentes', () => {
  test('ancho de pantalla → dispositivo', () => {
    expect(dispositivoDesdeAncho(390)).toBe('movil')
    expect(dispositivoDesdeAncho(768)).toBe('tablet')
    expect(dispositivoDesdeAncho(1600)).toBe('escritorio')
  })

  test('host del referrer limpio', () => {
    expect(hostDesdeReferrer('https://www.google.com/search?q=camper')).toBe('google.com')
    expect(hostDesdeReferrer('https://instagram.com/p/123')).toBe('instagram.com')
    expect(hostDesdeReferrer('')).toBeNull()
    expect(hostDesdeReferrer('no-es-una-url')).toBe('no-es-una-url')
  })

  test('las fuentes se agrupan en nombres legibles', () => {
    expect(fuenteDeHost('google.com')).toBe('google')
    expect(fuenteDeHost('es.search.yahoo.com')).toBe('referido')
    expect(fuenteDeHost(null)).toBe('directo')
    const agrupadas = agruparFuentes([
      { clave: 'google.com', visitas: 10, visitantes: 8 },
      { clave: 'directo', visitas: 5, visitantes: 5 },
      { clave: 'google.es', visitas: 2, visitantes: 2 },
    ])
    expect(agrupadas[0]).toMatchObject({ clave: 'google', visitas: 12 })
    expect(agrupadas[0].etiqueta).toBe('Google')
    expect(agrupadas.find((f) => f.clave === 'directo')?.etiqueta).toContain('Directo')
  })
})

describe('validación del evento de visita', () => {
  const base = { vid: 'abc12345-xyz', ruta: '/catalogo' }

  test('acepta un evento normal y recalcula el tipo', () => {
    const res = normalizarVisita({ ...base, ruta: '/producto/vw-california', disp: 'movil', ref: 'https://www.google.com/' })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.visita.tipo).toBe('producto')
    expect(res.visita.slug).toBe('vw-california')
    expect(res.visita.dispositivo).toBe('movil')
    expect(res.visita.referrerHost).toBe('google.com')
    expect(res.visita.soloDuracion).toBe(false)
  })

  test('rechaza ids raros y rutas del panel', () => {
    expect(normalizarVisita({ vid: 'corto', ruta: '/' }).ok).toBe(false)
    expect(normalizarVisita({ vid: 'abc12345-xyz', ruta: '/dashboard' }).ok).toBe(false)
    expect(normalizarVisita({ vid: 'abc12345-xyz', ruta: 'sin-barra' }).ok).toBe(false)
    expect(normalizarVisita(null).ok).toBe(false)
  })

  test('el cierre de duración necesita la página anterior', () => {
    expect(normalizarVisita({ ...base, soloDuracion: true }).ok).toBe(false)
    const res = normalizarVisita({
      ...base,
      soloDuracion: true,
      anterior: { ruta: '/catalogo', ts: Date.now(), segundos: 42 },
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.visita.soloDuracion).toBe(true)
    expect(res.visita.anterior?.segundos).toBe(42)
  })
})
