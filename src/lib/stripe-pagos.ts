/**
 * Reglas puras del cobro con Stripe.
 *
 * Están fuera de la ruta del webhook a propósito: son las decisiones que, si se
 * equivocan, regalan créditos o cobran dos veces. Al vivir aquí se pueden
 * probar sin montar un servidor ni firmar eventos.
 */
import { getPaqueteByCreditos, isValidPaquete } from '@/lib/creditos'

/** Eventos de Stripe que acreditan créditos. El resto se ignora con 200. */
export const EVENTOS_ACREDITABLES = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
] as const

export function esEventoAcreditable(tipo: string): boolean {
  return (EVENTOS_ACREDITABLES as readonly string[]).includes(tipo)
}

export type DecisionPago =
  | { accion: 'acreditar'; userId: string; creditos: number; importeEur: number | null }
  /** No es un error: el pago aún no está confirmado (Bizum es asíncrono). */
  | { accion: 'esperar'; motivo: string }
  /** Descartable: responder 200, porque reintentar no lo arregla. */
  | { accion: 'descartar'; motivo: string }

export interface SesionStripeMinima {
  id?: string | null
  payment_status?: string | null
  amount_total?: number | null
  client_reference_id?: string | null
  metadata?: { user_id?: string; creditos?: string } | null
}

/**
 * Decide qué hacer con una Checkout Session recibida por webhook.
 *
 * Criterios, por orden:
 *  · Sin `payment_status === 'paid'` no se acredita nada. Con Bizum el evento
 *    llega antes de que el dinero esté confirmado.
 *  · El usuario y los créditos salen de `metadata`/`client_reference_id`, que
 *    los fijó NUESTRO servidor al crear la sesión; el navegador no los toca.
 *  · Los créditos deben corresponder a un paquete real de la allowlist. Si
 *    alguien manipulase la sesión, no se acredita un paquete inventado.
 *  · El importe cobrado debe coincidir con el precio del paquete. Protege
 *    contra sesiones creadas fuera de nuestro flujo (por ejemplo, un Payment
 *    Link hecho a mano en el dashboard con un importe menor).
 */
export function decidirAccionPago(sesion: SesionStripeMinima): DecisionPago {
  if (!sesion?.id) {
    return { accion: 'descartar', motivo: 'Sesión sin identificador' }
  }

  if (sesion.payment_status !== 'paid') {
    return { accion: 'esperar', motivo: `payment_status=${sesion.payment_status ?? 'desconocido'}` }
  }

  const userId = sesion.metadata?.user_id || sesion.client_reference_id || ''
  if (!userId) {
    return { accion: 'descartar', motivo: 'Sesión sin usuario asociado' }
  }

  const creditos = Number(sesion.metadata?.creditos)
  if (!Number.isInteger(creditos) || !isValidPaquete(creditos)) {
    return { accion: 'descartar', motivo: `Paquete no válido: ${sesion.metadata?.creditos}` }
  }

  const paquete = getPaqueteByCreditos(creditos)!
  const importeEur = sesion.amount_total != null ? sesion.amount_total / 100 : null

  // Tolerancia de un céntimo por redondeo de divisa.
  if (importeEur != null && Math.abs(importeEur - paquete.precio) > 0.01) {
    return {
      accion: 'descartar',
      motivo: `Importe cobrado (${importeEur} €) no coincide con el paquete (${paquete.precio} €)`,
    }
  }

  return { accion: 'acreditar', userId, creditos, importeEur }
}
