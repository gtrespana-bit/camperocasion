import type Stripe from 'stripe'
import { esPlanPago } from '@/lib/planes-anuncios'

export function esCheckoutDePlan(sesion: {
  mode?: string | null
  metadata?: Record<string, string> | null
}): boolean {
  return sesion.mode === 'subscription' || sesion.metadata?.tipo === 'plan'
}

export function planDesdeMetadata(meta?: Record<string, string> | null): string | null {
  const p = meta?.plan
  return esPlanPago(p) ? p : null
}

/**
 * Plan de una suscripción cuando el metadata no es fiable.
 *
 * El metadata lo escribimos nosotros al crear/cambiar el pack, pero hay dos
 * casos en los que puede faltar:
 *  · suscripciones creadas a mano en el dashboard de Stripe;
 *  · cambio de plan desde el Customer Portal, que no pasa por nuestro checkout.
 * En ambos el precio sí lleva nuestro `lookup_key` estable
 * (`camperocasion_<plan>_<mensual|anual>`), así que se usa como respaldo.
 */
export function planDesdeSuscripcion(sub: {
  metadata?: Record<string, string> | null
  items?: {
    data?: Array<{
      price?: {
        lookup_key?: string | null
        metadata?: Record<string, string> | null
      } | null
    }> | null
  } | null
}): string | null {
  // El precio manda sobre el metadata de la suscripción: un cambio de plan
  // desde el Customer Portal actualiza el precio pero no nuestro metadata.
  for (const item of sub.items?.data || []) {
    const price = item?.price
    const key = price?.lookup_key
    if (typeof key === 'string') {
      const match = key.match(/^camperocasion_(plus)_(mensual|anual)$/)
      if (match) return match[1]
    }
    const porMetadata = planDesdeMetadata(price?.metadata)
    if (porMetadata) return porMetadata
  }

  return planDesdeMetadata(sub.metadata)
}

export function periodoHastaUnix(unix?: number | null): string | null {
  if (!unix) return null
  return new Date(unix * 1000).toISOString()
}

export function userIdDesdeStripe(obj: {
  metadata?: Record<string, string> | null
  client_reference_id?: string | null
}): string {
  return obj.metadata?.user_id || obj.client_reference_id || ''
}
