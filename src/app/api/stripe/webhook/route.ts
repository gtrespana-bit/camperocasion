/**
 * POST /api/stripe/webhook
 *
 * Único punto donde se acreditan créditos pagados con Stripe.
 *
 * Por qué aquí y no en la página de "gracias": el navegador puede cerrarse
 * antes de volver del checkout, y a la inversa, cualquiera puede abrir la URL
 * de éxito a mano. El webhook es la fuente de verdad porque llega firmado por
 * Stripe y se reintenta hasta que respondemos 2xx.
 *
 * Seguridad:
 *  · Se verifica la FIRMA con `STRIPE_WEBHOOK_SECRET` sobre el cuerpo crudo.
 *    Sin firma válida → 400 y no se toca la base de datos.
 *  · La acreditación va por la RPC `acreditar_pago_stripe`, que es atómica e
 *    idempotente (índice único sobre `stripe_session_id`): los reintentos de
 *    Stripe no duplican créditos.
 *
 * Configuración en Stripe (Dashboard → Developers → Webhooks):
 *   URL     https://camperocasion.online/api/stripe/webhook
 *   Eventos checkout.session.completed, checkout.session.async_payment_succeeded,
 *           customer.subscription.updated, customer.subscription.deleted,
 *           invoice.paid, invoice.payment_failed
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { getStripe, getWebhookSecret } from '@/lib/stripe'
import { decidirAccionPago, esEventoAcreditable } from '@/lib/stripe-pagos'
import { aplicarPlanPerfil, marcarPagoFallido, sbAdmin } from '@/lib/planes-servidor'
import { esCheckoutDePlan, planDesdeMetadata, planDesdeSuscripcion, periodoHastaUnix, userIdDesdeStripe } from '@/lib/stripe-planes'
import { etiquetaPlan } from '@/lib/planes-anuncios'
import { enviarEmailPagoFallido } from '@/email/server-email'

export const dynamic = 'force-dynamic'
// El cuerpo debe llegar tal cual para poder verificar la firma.
export const runtime = 'nodejs'

/**
 * Aviso inmediato de cobro fallido. Solo se envía la primera vez del ciclo
 * (`marcarPagoFallido` devuelve la fecha marcada o null): Stripe reintenta
 * varias veces y no queremos un email por reintento.
 */
async function avisarPagoFallido(userId: string, plan: string | null, fechaFin: string | null) {
  try {
    const sb = sbAdmin()
    const [{ data: authData }, { data: perfil }] = await Promise.all([
      sb.auth.admin.getUserById(userId),
      sb.from('perfiles').select('nombre').eq('id', userId).maybeSingle(),
    ])
    const email = authData?.user?.email
    if (!email) return
    await enviarEmailPagoFallido(email, perfil?.nombre || '', {
      plan: plan ? etiquetaPlan(plan) : 'tu pack',
      fechaFin,
    })
  } catch (e: any) {
    // Un fallo del correo no debe hacer que Stripe reintente el webhook: el
    // cobro ya está registrado y el aviso se reintenta en el cron diario.
    console.error('[stripe/webhook] email de cobro fallido:', e?.message || e)
  }
}

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  const secret = getWebhookSecret()

  if (!stripe || !secret) {
    console.error('[stripe/webhook] Stripe no configurado (falta STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET)')
    return NextResponse.json({ error: 'Stripe no configurado' }, { status: 503 })
  }

  const firma = req.headers.get('stripe-signature')
  if (!firma) {
    return NextResponse.json({ error: 'Falta la firma' }, { status: 400 })
  }

  const crudo = await req.text()

  let evento: Stripe.Event
  try {
    evento = stripe.webhooks.constructEvent(crudo, firma, secret)
  } catch (e: any) {
    console.error('[stripe/webhook] firma inválida:', e?.message || e)
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  if (
    evento.type === 'customer.subscription.deleted' ||
    evento.type === 'customer.subscription.updated'
  ) {
    const sub = evento.data.object as Stripe.Subscription
    const userId = userIdDesdeStripe(sub)
    if (!userId) return NextResponse.json({ recibido: true, ignorado: 'sub sin user' })
    if (evento.type === 'customer.subscription.deleted' || sub.status === 'canceled' || sub.status === 'unpaid') {
      const planAnterior = planDesdeSuscripcion(sub)
      await aplicarPlanPerfil(userId, { plan: 'gratis', hasta: null, stripeSubscriptionId: sub.id })

      // Fecha de baja para el win-back del cron (una semana después). Solo se
      // registra con `deleted`, que llega una vez por suscripción: `updated` en
      // `unpaid` puede repetirse durante los reintentos y duplicaría el aviso.
      if (evento.type === 'customer.subscription.deleted') {
        try {
          await sbAdmin().from('plan_avisos').insert({
            user_id: userId,
            clave: `baja:${new Date().toISOString().slice(0, 10)}`,
            // El plan va en `tipo` para que el email pueda nombrarlo.
            tipo: planAnterior || 'baja',
            canal: 'sistema',
          })
        } catch {
          /* migración pendiente: sin fila no hay win-back, pero la baja se aplica */
        }
      }

      return NextResponse.json({ recibido: true, plan: 'gratis' })
    }
    // El metadata manda; si falta (cambio desde el portal), se deduce del
    // `lookup_key` del precio.
    const plan = planDesdeSuscripcion(sub)
    if (plan && (sub.status === 'active' || sub.status === 'trialing')) {
      await aplicarPlanPerfil(userId, {
        plan,
        hasta: periodoHastaUnix((sub as any).current_period_end),
        stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
        stripeSubscriptionId: sub.id,
        // Un particular que contrata un pack pasa a profesional: es la única
        // forma de que reciba de verdad el cupo que está pagando.
        promoverAProfesional: true,
      })
      return NextResponse.json({ recibido: true, plan })
    }
    return NextResponse.json({ recibido: true, status: sub.status })
  }

  // Renovaciones y fallos de cobro de una suscripción.
  //
  // `customer.subscription.updated` no siempre llega en cada renovación, y sin
  // esto el `plan_hasta` de la base se quedaría en el primer periodo: el
  // cliente pagaría el segundo mes y la web le bajaría al plan gratuito. El
  // evento `invoice.paid` es la señal fiable de que el dinero ha entrado.
  if (evento.type === 'invoice.paid' || evento.type === 'invoice.payment_failed') {
    const invoice = evento.data.object as any
    const subId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id || invoice.parent?.subscription_details?.subscription
    if (!subId) {
      return NextResponse.json({ recibido: true, ignorado: 'factura sin suscripción' })
    }
    try {
      const sub = await stripe.subscriptions.retrieve(String(subId))
      const userId = userIdDesdeStripe(sub)
      const plan = planDesdeSuscripcion(sub)
      const hasta = periodoHastaUnix((sub as any).current_period_end)

      if (evento.type === 'invoice.payment_failed') {
        // Dunning: se marca el primer fallo del ciclo y se avisa una sola vez.
        // El acceso NO se corta aquí: `plan_hasta` sigue mandando y el cron
        // diario recuerda a los 3 y 7 días.
        if (userId) {
          const marcado = await marcarPagoFallido(userId)
          if (marcado) {
            await avisarPagoFallido(userId, plan, hasta)
            // El cron diario también mira este fallo; se deja la marca para no
            // mandar dos veces el aviso del día 1.
            try {
              await sbAdmin().from('plan_avisos').insert({
                user_id: userId,
                clave: `pago_fallido_1d:${marcado.slice(0, 10)}`,
                tipo: 'pago_fallido_1d',
                canal: 'email',
              })
            } catch {
              /* migración pendiente */
            }
          }
        }
        return NextResponse.json({ recibido: true, status: sub.status, factura: evento.type })
      }

      // invoice.paid: renovación (o primer cobro). Sin esto, el segundo mes
      // pagado podía dejar `plan_hasta` en el primer periodo.
      if (userId && plan && (sub.status === 'active' || sub.status === 'trialing')) {
        await aplicarPlanPerfil(userId, {
          plan,
          hasta,
          stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
          stripeSubscriptionId: sub.id,
          promoverAProfesional: true,
        })
        return NextResponse.json({ recibido: true, plan, factura: evento.type })
      }
      return NextResponse.json({ recibido: true, status: sub.status, factura: evento.type })
    } catch (e: any) {
      console.error('[stripe/webhook] factura de suscripción:', e?.message || e)
      return NextResponse.json({ recibido: true, error: 'suscripción no recuperable' })
    }
  }

  // Solo nos interesan los pagos completados. El resto se confirma con 200
  // para que Stripe no los reintente eternamente.
  if (!esEventoAcreditable(evento.type)) {
    return NextResponse.json({ recibido: true, ignorado: evento.type })
  }

  const session = evento.data.object as Stripe.Checkout.Session

  if (esCheckoutDePlan(session)) {
    const userId = userIdDesdeStripe(session)
    const plan = planDesdeMetadata(session.metadata as Record<string, string>)
    if (!userId || !plan) {
      return NextResponse.json({ recibido: true, error: 'plan sin usuario' })
    }
    if (session.payment_status && session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
      return NextResponse.json({ recibido: true, pendiente: session.payment_status })
    }
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
    let hasta: string | null = null
    if (subId && stripe) {
      try {
        const sub = await stripe.subscriptions.retrieve(subId)
        hasta = periodoHastaUnix((sub as any).current_period_end)
      } catch { /* period end is extra */ }
    }
    await aplicarPlanPerfil(userId, {
      plan,
      hasta,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      stripeSubscriptionId: subId || null,
      promoverAProfesional: true,
    })
    const codigo = session.metadata?.cupon
    if (codigo) {
      const sbC = sbAdmin()
      const { data: cupon } = await sbC.from('cupones').select('id, usos').eq('codigo', codigo).maybeSingle()
      if (cupon) {
        await sbC.from('cupones_usos').insert({ cupon_id: cupon.id, user_id: userId })
        await sbC.from('cupones').update({ usos: (cupon.usos || 0) + 1 }).eq('id', cupon.id)
      }
    }
    return NextResponse.json({ recibido: true, plan })
  }

  // Toda la decisión (pagado, usuario, paquete e importe) vive en una función
  // pura y testeada: aquí solo se ejecuta.
  const decision = decidirAccionPago(session)

  if (decision.accion === 'esperar') {
    return NextResponse.json({ recibido: true, pendiente: decision.motivo })
  }
  if (decision.accion === 'descartar') {
    // 200 a propósito: reintentar no lo arregla. Queda en el log para revisarlo
    // a mano — el dinero está en Stripe, no perdido.
    console.error('[stripe/webhook] descartado:', decision.motivo, session.id)
    return NextResponse.json({ recibido: true, error: decision.motivo })
  }

  const { userId, creditos, importeEur } = decision

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    // 500 a propósito: Stripe reintentará cuando la config esté bien.
    console.error('[stripe/webhook] faltan credenciales de Supabase')
    return NextResponse.json({ error: 'Config missing' }, { status: 500 })
  }

  const sb = createClient(supabaseUrl, serviceKey)

  // Enlace al recibo/factura para enseñárselo al usuario en su historial.
  let facturaUrl: string | null = null
  try {
    if (session.invoice) {
      const facturaId = typeof session.invoice === 'string' ? session.invoice : session.invoice.id
      if (facturaId) {
        const factura = await stripe.invoices.retrieve(facturaId)
        facturaUrl = factura.hosted_invoice_url || factura.invoice_pdf || null
      }
    }
  } catch (e: any) {
    // La factura es un extra: si falla, el crédito se acredita igual.
    console.warn('[stripe/webhook] no se pudo leer la factura:', e?.message || e)
  }

  const paymentIntent =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || null

  const { data, error } = await sb.rpc('acreditar_pago_stripe', {
    p_user_id: userId,
    p_creditos: creditos,
    p_session_id: session.id,
    p_payment_intent: paymentIntent,
    p_importe_eur: importeEur,
    p_factura_url: facturaUrl,
  })

  if (error) {
    // 500 para que Stripe reintente: el usuario ha pagado y tiene que recibir
    // sus créditos sí o sí.
    console.error('[stripe/webhook] error al acreditar:', error.message, session.id)
    return NextResponse.json({ error: 'No se pudo acreditar' }, { status: 500 })
  }

  if (data && data.ok === false) {
    console.error('[stripe/webhook] RPC rechazó el abono:', data.error, session.id)
    return NextResponse.json({ error: data.error }, { status: 500 })
  }

  // El cliente de Stripe se guarda la primera vez para reutilizarlo en las
  // suscripciones y en el portal: una sola ficha por vendedor.
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id
  if (customerId) {
    try {
      await sb
        .from('perfiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId)
        .is('stripe_customer_id', null)
    } catch {
      /* best-effort: el pago ya está acreditado */
    }
  }

  // Aviso al admin, si Telegram está configurado.
  const BOT = process.env.TELEGRAM_BOT_TOKEN
  const CHAT = process.env.TELEGRAM_CHAT_ID
  if (BOT && CHAT && !data?.duplicado) {
    try {
      await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT,
          text:
            `💳 Pago con Stripe confirmado\n\n` +
            `📦 ${creditos} créditos — ${((session.amount_total || 0) / 100).toFixed(2)} €\n` +
            `👤 ${session.customer_details?.email || userId}\n` +
            `🧾 ${session.id}`,
        }),
      })
    } catch {
      // Nunca fallar el webhook por una notificación.
    }
  }

  return NextResponse.json({ recibido: true, ...(data || {}) })
}
