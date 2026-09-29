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
 *   Eventos checkout.session.completed, checkout.session.async_payment_succeeded
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { getStripe, getWebhookSecret } from '@/lib/stripe'
import { decidirAccionPago, esEventoAcreditable } from '@/lib/stripe-pagos'
import { aplicarPlanPerfil, sbAdmin } from '@/lib/planes-servidor'
import { esCheckoutDePlan, planDesdeMetadata, periodoHastaUnix, userIdDesdeStripe } from '@/lib/stripe-planes'

export const dynamic = 'force-dynamic'
// El cuerpo debe llegar tal cual para poder verificar la firma.
export const runtime = 'nodejs'

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
      await aplicarPlanPerfil(userId, { plan: 'gratis', hasta: null, stripeSubscriptionId: sub.id })
      return NextResponse.json({ recibido: true, plan: 'gratis' })
    }
    const plan = planDesdeMetadata(sub.metadata as Record<string, string>)
    if (plan && (sub.status === 'active' || sub.status === 'trialing')) {
      await aplicarPlanPerfil(userId, {
        plan,
        hasta: periodoHastaUnix((sub as any).current_period_end),
        stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
        stripeSubscriptionId: sub.id,
      })
      return NextResponse.json({ recibido: true, plan })
    }
    return NextResponse.json({ recibido: true, status: sub.status })
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
