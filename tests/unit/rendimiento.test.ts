import {
  antiguedad,
  capacidades,
  compararVentas,
  diagnosticoAnuncio,
  diferenciaPrecio,
  motivoUpsell,
  nivelPlan,
  normalizarPeriodo,
  periodoPermitido,
  rellenarSerie,
  tasaContacto,
} from '@/lib/rendimiento'

describe('rendimiento - plan único', () => {
  test('nivel por plan', () => {
    expect(nivelPlan('gratis')).toBe(0)
    expect(nivelPlan('plus')).toBe(3)
  })

  test('un plan desconocido o nulo cae a gratis (falla cerrado)', () => {
    expect(nivelPlan(null)).toBe(0)
    expect(nivelPlan(undefined)).toBe(0)
    expect(nivelPlan('plan-inventado')).toBe(0)
  })

  test('gratis ve totales; Profesional lo ve todo', () => {
    const gratis = capacidades('gratis')
    const pro = capacidades('plus')

    expect(gratis.totales).toBe(true)
    expect(gratis.porAnuncio).toBe(false)
    expect(gratis.mercado).toBe(false)
    expect(gratis.exportar).toBe(false)

    for (const clave of Object.keys(pro) as (keyof typeof pro)[]) {
      expect(pro[clave]).toBe(true)
    }
  })
})

describe('rendimiento - periodos', () => {
  test('normaliza a 7, 30 o 90; cualquier otra cosa es 30', () => {
    expect(normalizarPeriodo('7')).toBe(7)
    expect(normalizarPeriodo('30')).toBe(30)
    expect(normalizarPeriodo('90')).toBe(90)
    expect(normalizarPeriodo('365')).toBe(30)
    expect(normalizarPeriodo(null)).toBe(30)
    expect(normalizarPeriodo('basura')).toBe(30)
  })

  test('90 días necesita Profesional', () => {
    expect(periodoPermitido(90, 'gratis')).toBe(false)
    expect(periodoPermitido(90, 'plus')).toBe(true)
    // 7 y 30 están en todos.
    expect(periodoPermitido(30, 'gratis')).toBe(true)
  })
})

describe('rendimiento - diagnóstico por anuncio', () => {
  const base = { visitas: 50, favoritos: 2, contactos: 0, diasPublicado: 30 }

  test('vendido tiene prioridad sobre todo lo demás', () => {
    const d = diagnosticoAnuncio({ ...base, visitas: 0, vendido: true })
    expect(d.clave).toBe('vendido')
  })

  test('pausado por cupo se distingue de pausado a mano', () => {
    expect(diagnosticoAnuncio({ ...base, activo: false, pausadoPorPlan: true }).etiqueta).toBe(
      'Pausado por cupo',
    )
    expect(diagnosticoAnuncio({ ...base, activo: false }).etiqueta).toBe('Pausado')
  })

  test('recién publicado no se juzga', () => {
    const d = diagnosticoAnuncio({ ...base, diasPublicado: 3, visitas: 0 })
    expect(d.clave).toBe('nuevo')
  })

  test('sin visitas tras una semana es un problema de escaparate', () => {
    const d = diagnosticoAnuncio({ ...base, visitas: 0, diasPublicado: 12 })
    expect(d.clave).toBe('sin-visitas')
    expect(d.tono).toBe('malo')
    expect(d.sugerencia).toContain('título')
  })

  test('muchas visitas y ningún contacto apunta al precio', () => {
    const d = diagnosticoAnuncio({ ...base, visitas: 120, contactos: 0 })
    expect(d.clave).toBe('sin-contactos')
    expect(d.sugerencia.toLowerCase()).toContain('precio')
  })

  test('con pocas visitas no se culpa al precio', () => {
    // 12 visitas y 0 contactos es ruido, no una señal.
    const d = diagnosticoAnuncio({ ...base, visitas: 12, contactos: 0 })
    expect(d.clave).toBe('normal')
  })

  test('detecta interés guardado sin consultas', () => {
    const d = diagnosticoAnuncio({ ...base, visitas: 20, favoritos: 8, contactos: 0 })
    expect(d.clave).toBe('sin-contactos')
    expect(d.etiqueta).toBe('Guardado, sin consultas')
  })

  test('una tasa sana se marca como que funciona', () => {
    const d = diagnosticoAnuncio({ ...base, visitas: 40, contactos: 4 })
    expect(d.clave).toBe('funciona')
    expect(d.tono).toBe('ok')
    expect(d.sugerencia).toContain('10 de cada 100')
  })

  test('el tono nunca es negativo para lo que no se puede arreglar solo', () => {
    const d = diagnosticoAnuncio({ ...base, diasPublicado: 1 })
    expect(d.tono).toBe('neutro')
  })
})

describe('rendimiento - comparativa', () => {
  test('tasa de contacto', () => {
    expect(tasaContacto(5, 100)).toBe(5)
    expect(tasaContacto(0, 100)).toBe(0)
    expect(tasaContacto(3, 0)).toBeNull()
    expect(tasaContacto(3, -1)).toBeNull()
  })

  test('diferencia de precio frente a la mediana', () => {
    expect(diferenciaPrecio(110, 100)).toBe(10)
    expect(diferenciaPrecio(80, 100)).toBe(-20)
    expect(diferenciaPrecio(null, 100)).toBeNull()
    expect(diferenciaPrecio(100, 0)).toBeNull()
  })

  test('sin mercado suficiente no se compara', () => {
    const c = compararVentas({ diasMios: 10, diasMercado: 20, ventasPropias: 5, ventasMercado: 2 })
    expect(c.diferencia).toBeNull()
    expect(c.titulo).toContain('suficiente mercado')
  })

  test('con mercado pero sin ventas propias no se inventa una conclusión', () => {
    const c = compararVentas({ diasMios: null, diasMercado: 20, ventasPropias: 0, ventasMercado: 30 })
    expect(c.diasMercado).toBe(20)
    expect(c.diferencia).toBeNull()
    expect(c.detalle).toContain('Vende 3 anuncios')
  })

  test('con 1–2 ventas propias tampoco: es suerte, no tendencia', () => {
    const c = compararVentas({ diasMios: 5, diasMercado: 20, ventasPropias: 2, ventasMercado: 40 })
    expect(c.diferencia).toBeNull()
  })

  test('vender más rápido se destaca en verde', () => {
    const c = compararVentas({ diasMios: 10, diasMercado: 20, ventasPropias: 5, ventasMercado: 40 })
    expect(c.tono).toBe('ok')
    expect(c.diferencia).toBe(-50)
    expect(c.titulo).toContain('más rápido')
  })

  test('vender más lento se marca como aviso con acción', () => {
    const c = compararVentas({ diasMios: 30, diasMercado: 20, ventasPropias: 5, ventasMercado: 40 })
    expect(c.tono).toBe('aviso')
    expect(c.titulo).toContain('más lento')
    expect(c.detalle).toContain('precio')
  })

  test('en línea con el mercado no genera alarma', () => {
    const c = compararVentas({ diasMios: 21, diasMercado: 20, ventasPropias: 5, ventasMercado: 40 })
    expect(c.tono).toBe('neutro')
    expect(c.titulo).toContain('línea')
  })
})

describe('rendimiento - serie', () => {
  const ahora = new Date('2026-10-23T10:00:00Z')

  test('rellena los días sin visitas con 0 para no mentir con la forma', () => {
    const serie = rellenarSerie(
      7,
      [
        { dia: '2026-10-20', visitas: 4 },
        { dia: '2026-10-23', visitas: 2 },
      ],
      ahora,
    )
    expect(serie).toHaveLength(7)
    expect(serie.map((p) => p.visitas)).toEqual([0, 0, 0, 4, 0, 0, 2])
    expect(serie[6].dia).toBe('2026-10-23')
  })

  test('ordena de más antiguo a hoy', () => {
    const serie = rellenarSerie(3, [], ahora)
    expect(serie.map((p) => p.dia)).toEqual(['2026-10-21', '2026-10-22', '2026-10-23'])
  })

  test('acepta datos nulos (RPC sin filas)', () => {
    expect(rellenarSerie(7, null, ahora)).toHaveLength(7)
  })

  test('acota la longitud para no dibujar 10 años', () => {
    expect(rellenarSerie(0, [], ahora)).toHaveLength(1)
    expect(rellenarSerie(9999, [], ahora)).toHaveLength(365)
  })
})

describe('rendimiento - textos', () => {
  test('antigüedad en lenguaje natural', () => {
    expect(antiguedad(0)).toBe('hoy')
    expect(antiguedad(1)).toBe('ayer')
    expect(antiguedad(12)).toBe('hace 12 días')
  })

  test('cada bloqueo explica qué desbloquea, siempre con Profesional', () => {
    for (const capacidad of ['porAnuncio', 'serie', 'mercado', 'exportar', 'periodo90'] as const) {
      const { titulo, detalle } = motivoUpsell(capacidad)
      expect(titulo.length).toBeGreaterThan(0)
      expect(detalle).toContain('Profesional')
    }
  })
})
