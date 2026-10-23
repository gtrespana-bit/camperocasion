/**
 * POST /api/planes/portal — abre el portal de cliente de Stripe.
 *
 * Sin esto, un suscriptor no puede cambiar su tarjeta, descargar facturas ni
 * darse de baja sin escribir un email. Es el mínimo legal y de confianza para
 * vender una suscripción en la UE: la baja tiene que estar a la misma
 * distancia que el alta.
 *
 * Requiere que el portal esté activado en Stripe
 * (Dashboard → Settings → Billing → Customer portal). Si no lo está, Stripe
 * devuelve error y aquí se explica en castellano.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { sbAdmin } from '@/lib/planes-servidor'
import { getSiteUrl, getStripe, stripeConfigurado } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  if (!stripe || !stripeConfigurado()) {
    return NextResponse.json({ ok: false, error: 'Stripe no está configurado.' }, { status: 503 })
  }

  const auth = await requireUser(req)
  if ('response' in auth) return auth.response

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const rl = await checkRateLimit('planes:portal', auth.user.id, { ip })
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: 'Demasiados intentos. Espera un momento.' }, { status: 429 })
  }

  const { data: perfil } = await sbAdmin()
    .from('perfiles')
    .select('stripe_customer_id')
    .eq('id', auth.user.id)
    .maybeSingle()

  if (!perfil?.stripe_customer_id) {
    return NextResponse.json(
      { ok: false, error: 'Todavía no tienes ninguna suscripción con tarjeta. Si has pagado por transferencia, escríbenos.' },
      { status: 400 },
    )
  }

  try {
    const sesion = await stripe.billingPortal.sessions.create({
      customer: perfil.stripe_customer_id,
      return_url: `${getSiteUrl()}/dashboard?tab=plan`,
    })
    return NextResponse.json({ ok: true, url: sesion.url })
  } catch (e: any) {
    console.error('[planes/portal]', e?.message || e)
    return NextResponse.json(
      {
        ok: false,
        error:
          'El portal de suscripción aún no está activado en Stripe. Actívalo en Dashboard → Settings → Billing → Customer portal.',
      },
      { status: 502 },
    )
  }
}
