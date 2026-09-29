import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/require-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { esPlanPago, getPlanDef } from '@/lib/planes-anuncios'
import { cuponAplicable, normalizarCodigo } from '@/lib/cupones'
import { sbAdmin } from '@/lib/planes-servidor'
import { getStripe, getSiteUrl, stripeConfigurado } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  if (!stripe || !stripeConfigurado()) {
    return NextResponse.json({ ok: false, error: 'Stripe no está configurado todavía.' }, { status: 503 })
  }

  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ ok: false, error: 'Inicia sesión.' }, { status: 401 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  if (!esPlanPago(body?.plan)) {
    return NextResponse.json({ ok: false, error: 'Pack no válido' }, { status: 400 })
  }
  const def = getPlanDef(body.plan)!

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const rl = await checkRateLimit('planes:checkout', user.id, { ip })
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: 'Demasiados intentos. Espera un momento.' }, { status: 429 })
  }

  const sb = sbAdmin()
  let discounts: { coupon: string }[] | undefined
  let cuponCodigo: string | undefined

  if (body?.cupon) {
    const codigo = normalizarCodigo(String(body.cupon))
    const { data: cupon } = await sb.from('cupones').select('*').eq('codigo', codigo).maybeSingle()
    if (!cupon) return NextResponse.json({ ok: false, error: 'Cupón no encontrado.' }, { status: 400 })
    const ok = cuponAplicable(cupon)
    if (!ok.ok) return NextResponse.json({ ok: false, error: ok.error }, { status: 400 })
    if (cupon.tipo !== 'descuento') {
      return NextResponse.json(
        { ok: false, error: 'Ese cupón es un regalo de días: canjéalo en la caja de cupones, no en el pago.' },
        { status: 400 },
      )
    }
    if (cupon.plan && cupon.plan !== body.plan) {
      return NextResponse.json({ ok: false, error: `Este cupón solo vale para el pack ${cupon.plan}.` }, { status: 400 })
    }
    if (!cupon.stripe_coupon_id) {
      return NextResponse.json(
        { ok: false, error: 'Este descuento aún no está enlazado a Stripe. El admin debe recrearlo con Stripe activo.' },
        { status: 400 },
      )
    }
    discounts = [{ coupon: cupon.stripe_coupon_id }]
    cuponCodigo = codigo
  }

  const site = getSiteUrl()
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card', 'bizum'],
      client_reference_id: user.id,
      customer_email: user.email || undefined,
      locale: 'es',
      adaptive_pricing: { enabled: false },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: Math.round(def.precioMes * 100),
            recurring: { interval: 'month' },
            product_data: {
              name: `CamperOcasión ${def.nombre}`,
              description: def.eslogan,
            },
          },
        },
      ],
      ...(discounts ? { discounts } : {}),
      subscription_data: {
        metadata: { user_id: user.id, plan: def.id, tipo: 'plan' },
      },
      metadata: {
        user_id: user.id,
        plan: def.id,
        tipo: 'plan',
        ...(cuponCodigo ? { cupon: cuponCodigo } : {}),
      },
      success_url: `${site}/para-profesionales?pago=ok&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/para-profesionales?pago=cancelado`,
    })
    if (!session.url) {
      return NextResponse.json({ ok: false, error: 'Stripe no devolvió URL' }, { status: 502 })
    }
    return NextResponse.json({ ok: true, url: session.url })
  } catch (e: any) {
    console.error('[planes/checkout]', e?.message || e)
    return NextResponse.json({ ok: false, error: 'No se pudo iniciar el pago.' }, { status: 502 })
  }
}
