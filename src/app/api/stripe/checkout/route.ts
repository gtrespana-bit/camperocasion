/**
 * POST /api/stripe/checkout
 *
 * Crea una Checkout Session de Stripe para un paquete de créditos y devuelve
 * la URL a la que hay que redirigir al usuario.
 *
 * Reglas de seguridad (las mismas que ya aplicaba el circuito manual):
 *  · El usuario sale de la sesión verificada, nunca del body.
 *  · El paquete se valida contra la allowlist del servidor (`src/lib/creditos`).
 *  · El PRECIO lo pone el servidor. Lo que mande el cliente se ignora: si el
 *    precio viniera del navegador, cualquiera compraría 100 créditos por 1 cent.
 *  · El `user_id` viaja en `metadata` y `client_reference_id` para que el
 *    webhook sepa a quién acreditar sin fiarse del navegador.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/require-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { getPaqueteByCreditos, isValidPaquete } from '@/lib/creditos'
import { getStripe, getSiteUrl, stripeConfigurado } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  if (!stripe || !stripeConfigurado()) {
    return NextResponse.json(
      { ok: false, error: 'El pago con tarjeta no está disponible ahora mismo.' },
      { status: 503 }
    )
  }

  const user = await getSessionUser(req)
  if (!user) {
    return NextResponse.json({ ok: false, error: 'No autorizado. Inicia sesión.' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 })
  }

  const creditos = Number(body?.creditos)
  if (!Number.isInteger(creditos) || !isValidPaquete(creditos)) {
    return NextResponse.json({ ok: false, error: 'Paquete no válido' }, { status: 400 })
  }
  const paquete = getPaqueteByCreditos(creditos)!

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const rl = await checkRateLimit('creditos:comprar', user.id, { ip })
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: `Demasiados intentos. Espera ${Math.ceil(rl.resetIn / 60000)} min` },
      { status: 429 }
    )
  }

  const site = getSiteUrl()

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Bizum y tarjeta: los dos métodos que usa de verdad un vendedor español.
      // Si la cuenta aún no tiene Bizum activado, Stripe lo ignora en vez de
      // fallar, así que no hace falta condicionarlo.
      payment_method_types: ['card', 'bizum'],
      client_reference_id: user.id,
      customer_email: user.email || undefined,
      locale: 'es',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            // Importe en céntimos y calculado en el servidor.
            unit_amount: Math.round(paquete.precio * 100),
            product_data: {
              name: `${paquete.creditos} créditos CamperOcasión`,
              description:
                'Créditos para destacar y subir tus anuncios en CamperOcasión. Uso inmediato tras el pago.',
            },
          },
        },
      ],
      metadata: {
        user_id: user.id,
        creditos: String(paquete.creditos),
      },
      payment_intent_data: {
        metadata: { user_id: user.id, creditos: String(paquete.creditos) },
      },
      // Recibo/factura automática de Stripe: cumple con lo que hay que
      // entregar al comprador y evita emitirla a mano.
      invoice_creation: { enabled: true },
      success_url: `${site}/creditos?pago=ok&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/creditos?pago=cancelado`,
    })

    if (!session.url) {
      return NextResponse.json({ ok: false, error: 'Stripe no devolvió URL de pago' }, { status: 502 })
    }

    return NextResponse.json({ ok: true, url: session.url, sessionId: session.id })
  } catch (e: any) {
    console.error('[stripe/checkout]', e?.message || e)
    return NextResponse.json(
      { ok: false, error: 'No se pudo iniciar el pago. Inténtalo de nuevo.' },
      { status: 502 }
    )
  }
}
