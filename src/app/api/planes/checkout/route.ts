import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/require-auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import {
  esPlanPago,
  getPlanDef,
  precioPlan,
  type Periodicidad,
  type PlanPago,
} from '@/lib/planes-anuncios'
import { cuponAplicable, normalizarCodigo } from '@/lib/cupones'
import { sbAdmin } from '@/lib/planes-servidor'
import { obtenerPrecioPlan } from '@/lib/stripe-precios'
import { getStripe, getSiteUrl, stripeConfigurado } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

/**
 * POST /api/planes/checkout — contratar (o cambiar) un pack profesional.
 *
 * Decisiones que importan:
 *  · El precio sale de `precioPlan()` en el servidor, nunca del navegador.
 *  · El producto/precio de Stripe es estable (`lookup_key`), no `price_data`:
 *    así el portal de cliente y las facturas muestran el mismo producto.
 *  · Si ya hay una suscripción activa se actualiza en Stripe en vez de crear
 *    una segunda: nadie debe pagar dos packs a la vez.
 *  · Bizum no admite cobros recurrentes (Stripe), así que en modo suscripción
 *    solo se ofrece tarjeta. Bizum sigue disponible para comprar créditos.
 */
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
  const plan = body.plan as PlanPago

  if (body?.periodicidad && body.periodicidad !== 'mensual' && body.periodicidad !== 'anual') {
    return NextResponse.json({ ok: false, error: 'Periodicidad no válida' }, { status: 400 })
  }
  const periodicidad: Periodicidad = body?.periodicidad === 'anual' ? 'anual' : 'mensual'

  const def = getPlanDef(plan)!
  const ip = getClientIp(req)
  const rl = await checkRateLimit('planes:checkout', user.id, { ip })
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: 'Demasiados intentos. Espera un momento.' }, { status: 429 })
  }

  const sb = sbAdmin()
  const { data: perfil } = await sb
    .from('perfiles')
    .select('tipo_vendedor, plan_anuncios, plan_hasta, stripe_customer_id, stripe_subscription_id')
    .eq('id', user.id)
    .maybeSingle()

  const planVigente =
    esPlanPago(perfil?.plan_anuncios) &&
    (!perfil?.plan_hasta || new Date(perfil.plan_hasta).getTime() >= Date.now())
  const suscripcionViva = Boolean(planVigente && perfil?.stripe_subscription_id)

  // ── Cambio de pack sobre una suscripción que ya existe ──────────────────
  // Se modifica la suscripción en Stripe (con prorrateo) en lugar de abrir
  // otra. El webhook `customer.subscription.updated` es quien actualiza la
  // base de datos: una sola fuente de verdad.
  if (suscripcionViva && perfil?.stripe_subscription_id) {
    if (perfil.plan_anuncios === plan) {
      return NextResponse.json(
        {
          ok: false,
          codigo: 'SUSCRIPCION_ACTIVA',
          error: `Ya tienes el pack ${def.nombre} activo. Puedes gestionarlo desde tu panel.`,
        },
        { status: 409 },
      )
    }

    try {
      const suscripcion = await stripe.subscriptions.retrieve(perfil.stripe_subscription_id)
      const item = suscripcion.items.data[0]
      if (!item) throw new Error('Suscripción sin líneas')
      const precio = await obtenerPrecioPlan(stripe, plan, periodicidad)
      await stripe.subscriptions.update(perfil.stripe_subscription_id, {
        items: [{ id: item.id, price: precio.id }],
        proration_behavior: 'create_prorations',
        metadata: {
          user_id: user.id,
          plan,
          tipo: 'plan',
          periodicidad,
          activar_profesional: '1',
        },
      })
      return NextResponse.json({
        ok: true,
        actualizado: true,
        plan,
        mensaje: `Pack ${def.nombre} activado. Stripe aplicará la diferencia prorrateada en la próxima factura.`,
      })
    } catch (e: any) {
      console.error('[planes/checkout] cambio de plan:', e?.message || e)
      return NextResponse.json(
        { ok: false, error: 'No se pudo cambiar el pack. Gestiona tu suscripción desde el panel.' },
        { status: 502 },
      )
    }
  }

  // ── Cupón (solo en altas nuevas) ────────────────────────────────────────
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
    if (cupon.plan && cupon.plan !== plan) {
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
  const metadata = {
    user_id: user.id,
    plan,
    tipo: 'plan',
    periodicidad,
    // Un particular que contrata un pack pasa a profesional al confirmarse el
    // pago. Si no, pagaría el cupo y seguiría limitado a 1 anuncio.
    activar_profesional: '1',
    ...(cuponCodigo ? { cupon: cuponCodigo } : {}),
  }

  try {
    const precio = await obtenerPrecioPlan(stripe, plan, periodicidad)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      // Bizum no admite cobros recurrentes. En suscripciones, tarjeta (con
      // Apple Pay / Google Pay incluidos). Bizum sigue en la compra de créditos.
      payment_method_types: ['card'],
      client_reference_id: user.id,
      ...(perfil?.stripe_customer_id
        ? { customer: perfil.stripe_customer_id }
        : { customer_email: user.email || undefined }),
      locale: 'es',
      adaptive_pricing: { enabled: false },
      // Domicilio y NIF/CIF en la factura: lo necesita un autónomo o taller.
      tax_id_collection: { enabled: true },
      line_items: [{ quantity: 1, price: precio.id }],
      ...(discounts ? { discounts } : {}),
      subscription_data: {
        metadata,
        description: `CamperOcasión ${def.nombre} (${periodicidad === 'anual' ? 'anual' : 'mensual'})`,
      },
      metadata,
      success_url: `${site}/para-profesionales?pago=ok&plan=${plan}`,
      cancel_url: `${site}/para-profesionales?pago=cancelado`,
    })
    if (!session.url) {
      return NextResponse.json({ ok: false, error: 'Stripe no devolvió URL' }, { status: 502 })
    }
    return NextResponse.json({
      ok: true,
      url: session.url,
      plan,
      periodicidad,
      importe: precioPlan(plan, periodicidad),
    })
  } catch (e: any) {
    console.error('[planes/checkout]', e?.message || e)
    return NextResponse.json({ ok: false, error: 'No se pudo iniciar el pago.' }, { status: 502 })
  }
}
