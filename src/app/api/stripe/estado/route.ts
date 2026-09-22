/**
 * GET /api/stripe/estado
 *
 * Dice al cliente si el pago con tarjeta/Bizum está disponible, sin exponer
 * ninguna clave. La página de créditos lo usa para enseñar el botón de pago
 * inmediato o quedarse con el circuito manual.
 */
import { NextResponse } from 'next/server'
import { stripeConfigurado } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ disponible: stripeConfigurado() })
}
