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
