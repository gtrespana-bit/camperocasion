/**
 * Tests de las reglas de la reserva con señal (confirmación del vendedor).
 *
 * Lo que se protege:
 *  1. Que "reservado" signifique algo: solo una reserva ACTIVA (confirmada por
 *     el vendedor) bloquea el anuncio, y las caducadas dejan de bloquear.
 *  2. Que una solicitud del comprador NO bloquee el anuncio (si no, cualquiera
 *     logueado "reservaría" sin pagar).
 *  3. Que las transiciones sean las del modelo nuevo (sin comprobantes):
 *     solicitada → activa, rechazada, cancelada o expirada; activa → completada,
 *     cancelada o expirada; y ningún estado terminal reabre.
 *  4. Que la señal sea pequeña de verdad (importe acotado).
 *  5. Que nadie reserve su propio anuncio ni un vehículo vendido.
 *  6. Que el conjunto de estados vivos coincida con el índice único de la
 *     migración: si alguien añade un estado y no lo actualiza, el test cae.
 */
import {
  COMISION_RESERVA_PCT,
  CONDICIONES_SEÑAL,
  DIAS_VALIDEZ_RESERVA,
  ESTADOS_RESERVA,
  ESTADOS_VIVOS,
  SEÑAL_MAXIMA,
  SEÑAL_MINIMA,
  SEÑAL_POR_DEFECTO,
  TRANSICIONES_RESERVA,
  accionesDisponibles,
  comisionDe,
  esParteDeReserva,
  fechaExpiracion,
  importeSeñalValido,
  motivoReservaCerrada,
  normalizarEstadoReserva,
  puedeReservar,
  puedeTransicionar,
  reservaVigente,
  sugerirImporteSeñal,
} from '@/lib/reservas'

const AYER = new Date(Date.now() - 24 * 60 * 60 * 1000)
const EN_CINCO_DIAS = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()

const PRODUCTO = {
  id: 'p1',
  user_id: 'vendedor',
  activo: true,
  vendido: false,
  reservado: false,
  estado_moderacion: 'aprobado',
}

describe('estados', () => {
  test('los estados vivos son solo los confirmados por el vendedor', () => {
    expect(ESTADOS_VIVOS).toEqual(['activa'])
    // Si esta lista cambia, hay que cambiar también la migración
    // (reservas_producto_activa_key) y el trigger de propagación.
    for (const estado of ESTADOS_VIVOS) expect(ESTADOS_RESERVA).toContain(estado)
    expect(ESTADOS_RESERVA).toHaveLength(6)
  })

  test('normaliza estados desconocidos al inicial, no a uno vivo', () => {
    expect(normalizarEstadoReserva('activa')).toBe('activa')
    expect(normalizarEstadoReserva('solicitada')).toBe('solicitada')
    expect(normalizarEstadoReserva('inventado')).toBe('solicitada')
    expect(normalizarEstadoReserva('pendiente_pago')).toBe('solicitada') // estado antiguo
    expect(normalizarEstadoReserva(null)).toBe('solicitada')
  })

  test('solo bloquea el anuncio una reserva activa y sin caducar', () => {
    expect(reservaVigente('activa', EN_CINCO_DIAS)).toBe(true)
    expect(reservaVigente('solicitada', EN_CINCO_DIAS)).toBe(false) // no confirmada: no bloquea
    expect(reservaVigente('activa', AYER.toISOString())).toBe(false)
    expect(reservaVigente('cancelada', EN_CINCO_DIAS)).toBe(false)
    expect(reservaVigente('completada', EN_CINCO_DIAS)).toBe(false)
    expect(reservaVigente('activa', null)).toBe(false)
    expect(reservaVigente('activa', 'no-es-una-fecha')).toBe(false)
  })
})

describe('transiciones', () => {
  test('el flujo normal avanza sin comprobante', () => {
    expect(puedeTransicionar('solicitada', 'activa')).toBe(true)
    expect(puedeTransicionar('activa', 'completada')).toBe(true)
    expect(puedeTransicionar('solicitada', 'rechazada')).toBe(true)
    expect(puedeTransicionar('solicitada', 'cancelada')).toBe(true)
  })

  test('una solicitud puede caducar (barrido perezoso)', () => {
    expect(puedeTransicionar('solicitada', 'expirada')).toBe(true)
    expect(puedeTransicionar('activa', 'expirada')).toBe(true)
  })

  test('los estados terminales no reabren', () => {
    for (const estado of ['completada', 'rechazada', 'cancelada', 'expirada'] as const) {
      expect(TRANSICIONES_RESERVA[estado]).toEqual([])
    }
  })

  test('una rechazada no se reactiva sola: hay que volver a solicitar', () => {
    expect(puedeTransicionar('rechazada', 'activa')).toBe(false)
    expect(TRANSICIONES_RESERVA.rechazada).toEqual([])
  })

  test('toda transición declarada es a un estado conocido', () => {
    for (const [desde, lista] of Object.entries(TRANSICIONES_RESERVA)) {
      expect(ESTADOS_RESERVA).toContain(desde)
      for (const hacia of lista) expect(ESTADOS_RESERVA).toContain(hacia)
    }
  })
})

describe('importe de la señal', () => {
  test('la señal es pequeña: nunca pasa de 1.000 €', () => {
    expect(sugerirImporteSeñal(80000)).toBe(SEÑAL_MAXIMA)
    expect(sugerirImporteSeñal(30000)).toBe(600)
    expect(sugerirImporteSeñal(10000)).toBe(SEÑAL_POR_DEFECTO)
    expect(sugerirImporteSeñal(0)).toBe(SEÑAL_POR_DEFECTO)
    expect(sugerirImporteSeñal(null)).toBe(SEÑAL_POR_DEFECTO)
  })

  test('el importe sugerido es válido y redondo', () => {
    for (const precio of [5000, 12000, 17500, 25000, 45000, 90000]) {
      const sugerido = sugerirImporteSeñal(precio)
      expect(importeSeñalValido(sugerido)).toBe(true)
      expect(sugerido % 50).toBe(0)
    }
  })

  test('valida el importe que llega del cliente', () => {
    expect(importeSeñalValido(300)).toBe(true)
    expect(importeSeñalValido(SEÑAL_MINIMA)).toBe(true)
    expect(importeSeñalValido(SEÑAL_MAXIMA)).toBe(true)
    expect(importeSeñalValido(50)).toBe(false)
    expect(importeSeñalValido(5000)).toBe(false)
    expect(importeSeñalValido('mucho')).toBe(false)
    expect(importeSeñalValido(undefined)).toBe(false)
  })

  test('sin pasarela no se cobra comisión', () => {
    expect(COMISION_RESERVA_PCT).toBe(0)
    expect(comisionDe(500)).toBe(0)
    expect(comisionDe(500, 5)).toBe(25)
  })
})

describe('puedeReservar', () => {
  test('lo normal es que sí', () => {
    expect(puedeReservar(PRODUCTO, null, 'comprador').ok).toBe(true)
  })

  test('no puedes reservar tu propio anuncio', () => {
    const r = puedeReservar(PRODUCTO, null, 'vendedor')
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/tu propio anuncio/i)
  })

  test('sin sesión hay que iniciar sesión', () => {
    const r = puedeReservar(PRODUCTO, null, null)
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/inicia sesión/i)
  })

  test('un vehículo vendido no se reserva', () => {
    expect(puedeReservar({ ...PRODUCTO, vendido: true }, null, 'comprador').ok).toBe(false)
  })

  test('un anuncio pausado no se reserva', () => {
    expect(puedeReservar({ ...PRODUCTO, activo: false }, null, 'comprador').ok).toBe(false)
  })

  test('un anuncio rechazado en moderación no se reserva', () => {
    const r = puedeReservar({ ...PRODUCTO, estado_moderacion: 'rechazado' }, null, 'comprador')
    expect(r.ok).toBe(false)
  })

  test('si otro comprador tiene reserva activa, no se puede reservar', () => {
    const r = puedeReservar(
      PRODUCTO,
      { id: 'r1', estado: 'activa', comprador_id: 'otro', expira_en: EN_CINCO_DIAS },
      'comprador'
    )
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/reservado ahora mismo/i)
  })

  test('una solicitud pendiente de OTRO no bloquea el anuncio', () => {
    const r = puedeReservar(
      PRODUCTO,
      { id: 'r1', estado: 'solicitada', comprador_id: 'otro', expira_en: EN_CINCO_DIAS },
      'comprador'
    )
    expect(r.ok).toBe(true)
  })

  test('una reserva activa caducada de otro no bloquea', () => {
    const r = puedeReservar(
      PRODUCTO,
      { id: 'r1', estado: 'activa', comprador_id: 'otro', expira_en: AYER.toISOString() },
      'comprador'
    )
    expect(r.ok).toBe(true)
  })
})

describe('permisos por rol', () => {
  test('el vendedor confirma o rechaza la solicitud; el comprador no', () => {
    expect(accionesDisponibles('solicitada', 'vendedor', new Date(), EN_CINCO_DIAS)).toContain('confirmar')
    expect(accionesDisponibles('solicitada', 'vendedor', new Date(), EN_CINCO_DIAS)).toContain('rechazar')
    expect(accionesDisponibles('solicitada', 'comprador', new Date(), EN_CINCO_DIAS)).toEqual(['cancelar'])
  })

  test('el comprador puede cancelar una solicitud', () => {
    expect(accionesDisponibles('solicitada', 'comprador', new Date(), EN_CINCO_DIAS)).toContain('cancelar')
  })

  test('con reserva activa, el vendedor puede completarla o cancelarla', () => {
    const acciones = accionesDisponibles('activa', 'vendedor', new Date(), EN_CINCO_DIAS)
    expect(acciones).toContain('completar')
    expect(acciones).toContain('cancelar')
    expect(acciones).not.toContain('confirmar')
  })

  test('una reserva cerrada no ofrece acciones a las partes', () => {
    for (const estado of ['cancelada', 'completada', 'rechazada', 'expirada'] as const) {
      expect(accionesDisponibles(estado, 'comprador', new Date(), EN_CINCO_DIAS)).toEqual([])
      expect(accionesDisponibles(estado, 'vendedor', new Date(), EN_CINCO_DIAS)).toEqual([])
    }
  })

  test('detecta si el usuario es parte de la reserva', () => {
    const reserva = { comprador_id: 'c1', vendedor_id: 'v1' }
    expect(esParteDeReserva(reserva, 'c1')).toBe(true)
    expect(esParteDeReserva(reserva, 'v1')).toBe(true)
    expect(esParteDeReserva(reserva, 'otro')).toBe(false)
    expect(esParteDeReserva(reserva, null)).toBe(false)
  })
})

describe('fechas y copy', () => {
  test('la reserva confirmada caduca en una semana', () => {
    expect(DIAS_VALIDEZ_RESERVA).toBe(7)
    const desde = new Date('2026-09-01T10:00:00.000Z')
    expect(fechaExpiracion(desde)).toBe('2026-09-08T10:00:00.000Z')
  })

  test('las condiciones explican dónde está el dinero', () => {
    const texto = CONDICIONES_SEÑAL.join(' ')
    expect(texto).toMatch(/no toca ni custodia el dinero/i)
    expect(texto).toMatch(/se descuenta del precio/i)
    expect(texto).toMatch(/señal íntegra/i)
    expect(CONDICIONES_SEÑAL.length).toBeGreaterThanOrEqual(5)
  })

  test('el motivo de cierre solo aparece cuando la reserva ya no bloquea', () => {
    expect(motivoReservaCerrada('activa')).toBeNull()
    expect(motivoReservaCerrada('cancelada')).toMatch(/cancelado/i)
    expect(motivoReservaCerrada('cancelada', 'el comprador se echó atrás')).toMatch(/el comprador se echó atrás/)
  })
})
