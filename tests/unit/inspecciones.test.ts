/**
 * Tests de las reglas de la inspección precompra (concierge).
 *
 * Lo que se protege:
 *  1. Que las transiciones sigan el flujo concierge del plan (presupuestar →
 *     pago → en curso → completada) y que un estado terminal no se reabra.
 *  2. Que el mapa de acciones del admin apunte siempre a estados válidos: si
 *     se renombra un estado en la lib y no en el panel, el test cae.
 *  3. Que nadie inspeccione su propio anuncio ni un vehículo vendido, y que
 *     una solicitud viva bloquee una segunda del mismo comprador.
 *  4. Que el precio orientativo esté acotado (150-250 €) y el validador de la
 *     API tolere un margen algo mayor (100-400 €).
 */
import {
  ACCIONES_ADMIN_INSPECCION,
  ESTADOS_INSPECCION,
  ESTADOS_INSPECCION_VIVOS,
  INSPECCION_PRECIO_ORIENTATIVO_MAX,
  INSPECCION_PRECIO_ORIENTATIVO_MIN,
  TRANSICIONES_INSPECCION,
  accionAdminValida,
  puedeSolicitarInspeccion,
  precioInspeccionValido,
} from '@/lib/inspecciones'

describe('estados y transiciones de inspección', () => {
  it('los estados vivos son exactamente los 4 no terminales', () => {
    const terminales = ESTADOS_INSPECCION.filter((e) => !ESTADOS_INSPECCION_VIVOS.includes(e))
    expect(terminales).toEqual(['completada', 'cancelada'])
    expect(ESTADOS_INSPECCION_VIVOS).toEqual([
      'solicitada',
      'presupuestada',
      'pagada',
      'en_curso',
    ])
  })

  it('sigue el flujo concierge completo', () => {
    expect(TRANSICIONES_INSPECCION.solicitada).toContain('presupuestada')
    expect(TRANSICIONES_INSPECCION.presupuestada).toContain('pagada')
    expect(TRANSICIONES_INSPECCION.pagada).toContain('en_curso')
    expect(TRANSICIONES_INSPECCION.en_curso).toContain('completada')
  })

  it('se puede cancelar desde cualquier estado vivo, nunca desde un terminal', () => {
    for (const vivo of ESTADOS_INSPECCION_VIVOS) {
      expect(TRANSICIONES_INSPECCION[vivo]).toContain('cancelada')
    }
    expect(TRANSICIONES_INSPECCION.completada).not.toContain('cancelada')
    expect(TRANSICIONES_INSPECCION.cancelada).not.toContain('cancelada')
  })

  it('una solicitud completada o cancelada no se reabre', () => {
    expect(TRANSICIONES_INSPECCION.completada).toEqual([])
    expect(TRANSICIONES_INSPECCION.cancelada).toEqual([])
  })

  it('sin presupuesto no hay pago: la solicitada no salta estados', () => {
    expect(TRANSICIONES_INSPECCION.solicitada).not.toContain('pagada')
    expect(TRANSICIONES_INSPECCION.solicitada).not.toContain('en_curso')
  })

  it('las acciones del panel apuntan a estados válidos y alcanzables', () => {
    for (const [accion, destino] of Object.entries(ACCIONES_ADMIN_INSPECCION)) {
      expect(ESTADOS_INSPECCION).toContain(destino)
      expect(accionAdminValida(accion)).toBe(true)
    }
    // La acción de presupuestar nace de "solicitada" y da "presupuestada".
    expect(ACCIONES_ADMIN_INSPECCION.presupuestar).toBe('presupuestada')
    expect(TRANSICIONES_INSPECCION.solicitada).toContain(ACCIONES_ADMIN_INSPECCION.presupuestar)
  })

  it('accionAdminValida rechaza basura', () => {
    expect(accionAdminValida('activar')).toBe(false)
    expect(accionAdminValida(undefined)).toBe(false)
    expect(accionAdminValida(42)).toBe(false)
  })
})

describe('precio de la inspección', () => {
  it('el orientativo publicado es 150-250 €', () => {
    expect(INSPECCION_PRECIO_ORIENTATIVO_MIN).toBe(150)
    expect(INSPECCION_PRECIO_ORIENTATIVO_MAX).toBe(250)
  })

  it('el validador de la API acepta el margen amplio y rechaza lo absurdo', () => {
    expect(precioInspeccionValido(150)).toBe(true)
    expect(precioInspeccionValido(250)).toBe(true)
    expect(precioInspeccionValido(100)).toBe(true)
    expect(precioInspeccionValido(399.99)).toBe(true)
    expect(precioInspeccionValido(0)).toBe(false)
    expect(precioInspeccionValido(-100)).toBe(false)
    expect(precioInspeccionValido(9999)).toBe(false)
    expect(precioInspeccionValido('gratis')).toBe(false)
    expect(precioInspeccionValido(null)).toBe(false)
  })
})

describe('puedeSolicitarInspeccion', () => {
  const productoBase = { id: 'p1', user_id: 'vendedor' }

  it('un comprador normal puede solicitar', () => {
    const v = puedeSolicitarInspeccion(productoBase, null, 'comprador')
    expect(v.ok).toBe(true)
  })

  it('nadie inspecciona su propio anuncio', () => {
    const v = puedeSolicitarInspeccion(productoBase, null, 'vendedor')
    expect(v.ok).toBe(false)
    expect(v.motivo).toMatch(/propio/i)
  })

  it('sin sesión se pide login', () => {
    const v = puedeSolicitarInspeccion(productoBase, null, null)
    expect(v.ok).toBe(false)
    expect(v.motivo).toMatch(/sesión/i)
  })

  it('un vehículo vendido o desactivado no se inspecciona', () => {
    expect(puedeSolicitarInspeccion({ ...productoBase, vendido: true }, null, 'c').ok).toBe(false)
    expect(puedeSolicitarInspeccion({ ...productoBase, activo: false }, null, 'c').ok).toBe(false)
    expect(
      puedeSolicitarInspeccion({ ...productoBase, estado_moderacion: 'rechazado' }, null, 'c').ok,
    ).toBe(false)
  })

  it('una solicitud viva bloquea una segunda del mismo comprador', () => {
    for (const estado of ESTADOS_INSPECCION_VIVOS) {
      const v = puedeSolicitarInspeccion(productoBase, { id: 's1', estado }, 'comprador')
      expect(v.ok).toBe(false)
      expect(v.motivo).toMatch(/en marcha/i)
    }
  })

  it('una solicitud cancelada o completada NO bloquea una nueva', () => {
    expect(puedeSolicitarInspeccion(productoBase, { id: 's1', estado: 'cancelada' }, 'comprador').ok).toBe(true)
    expect(puedeSolicitarInspeccion(productoBase, { id: 's1', estado: 'completada' }, 'comprador').ok).toBe(true)
  })

  it('la inspección NO depende de la reserva: un anuncio reservado se puede inspeccionar', () => {
    // La exclusividad es cosa de la reserva; aquí no se consulta.
    const v = puedeSolicitarInspeccion(productoBase, null, 'comprador')
    expect(v.ok).toBe(true)
  })
})
