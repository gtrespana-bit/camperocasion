/**
 * Tests del cobro con Stripe.
 *
 * Lo que se protege (todo esto es dinero, no cosmética):
 *  1. Que solo se acredite un pago CONFIRMADO. Bizum es asíncrono: el evento
 *     llega antes de que el banco confirme, y acreditar ahí regala créditos.
 *  2. Que el paquete venga de la allowlist del servidor, nunca del navegador.
 *  3. Que el importe cobrado coincida con el precio del paquete: si alguien
 *     crea una sesión fuera de nuestro flujo (un Payment Link a mano de 1 €
 *     con metadata de 100 créditos), no se acredita.
 *  4. Que los eventos que no son de pago se ignoren en vez de reintentarse.
 *  5. Que un evento sin usuario asociado se descarte, no reviente.
 */
import {
  EVENTOS_ACREDITABLES,
  decidirAccionPago,
  esEventoAcreditable,
  type SesionStripeMinima,
} from '@/lib/stripe-pagos'
import { PAQUETES_CREDITO } from '@/lib/creditos'

const sesion = (over: Partial<SesionStripeMinima> = {}): SesionStripeMinima => ({
  id: 'cs_test_123',
  payment_status: 'paid',
  amount_total: 500, // 5,00 €
  metadata: { user_id: 'user-1', creditos: '15' },
  ...over,
})

describe('eventos que acreditan', () => {
  it('acepta los dos eventos de checkout pagado', () => {
    expect(esEventoAcreditable('checkout.session.completed')).toBe(true)
    expect(esEventoAcreditable('checkout.session.async_payment_succeeded')).toBe(true)
  })

  it('ignora cualquier otro evento', () => {
    for (const tipo of [
      'payment_intent.created',
      'checkout.session.expired',
      'charge.refunded',
      'invoice.paid',
    ]) {
      expect(esEventoAcreditable(tipo)).toBe(false)
    }
  })

  it('la lista no crece sin querer', () => {
    expect(EVENTOS_ACREDITABLES).toHaveLength(2)
  })
})

describe('decidirAccionPago', () => {
  it('acredita un pago válido del paquete más elegido', () => {
    expect(decidirAccionPago(sesion())).toEqual({
      accion: 'acreditar',
      userId: 'user-1',
      creditos: 15,
      importeEur: 5,
    })
  })

  it('acepta todos los paquetes reales con su precio correcto', () => {
    for (const p of PAQUETES_CREDITO) {
      const d = decidirAccionPago(
        sesion({
          amount_total: Math.round(p.precio * 100),
          metadata: { user_id: 'u', creditos: String(p.creditos) },
        })
      )
      expect(d).toMatchObject({ accion: 'acreditar', creditos: p.creditos })
    }
  })

  it('NO acredita si el pago aún no está confirmado (caso Bizum)', () => {
    const d = decidirAccionPago(sesion({ payment_status: 'unpaid' }))
    expect(d.accion).toBe('esperar')
  })

  it('NO acredita si el pago quedó como "no_payment_required"', () => {
    expect(decidirAccionPago(sesion({ payment_status: 'no_payment_required' })).accion).toBe('esperar')
  })

  it('descarta una sesión sin usuario', () => {
    const d = decidirAccionPago(sesion({ metadata: { creditos: '15' }, client_reference_id: null }))
    expect(d.accion).toBe('descartar')
  })

  it('usa client_reference_id si falta el metadata del usuario', () => {
    const d = decidirAccionPago(
      sesion({ metadata: { creditos: '15' }, client_reference_id: 'user-9' })
    )
    expect(d).toMatchObject({ accion: 'acreditar', userId: 'user-9' })
  })

  it('descarta un paquete que no existe en la allowlist', () => {
    for (const falso of ['999', '3', '0', '-15', 'muchos', '']) {
      const d = decidirAccionPago(sesion({ metadata: { user_id: 'u', creditos: falso } }))
      expect(d.accion).toBe('descartar')
    }
  })

  it('descarta si el importe cobrado no coincide con el precio del paquete', () => {
    // 100 créditos (20 €) pagando 1 €: el ataque clásico si alguien fabrica
    // la sesión fuera de nuestro endpoint.
    const d = decidirAccionPago(
      sesion({ amount_total: 100, metadata: { user_id: 'u', creditos: '100' } })
    )
    expect(d.accion).toBe('descartar')
  })

  it('tolera un céntimo de redondeo', () => {
    const d = decidirAccionPago(sesion({ amount_total: 501 }))
    expect(d.accion).toBe('acreditar')
  })

  it('descarta una sesión sin identificador (no se podría deduplicar)', () => {
    expect(decidirAccionPago(sesion({ id: null })).accion).toBe('descartar')
  })
})
