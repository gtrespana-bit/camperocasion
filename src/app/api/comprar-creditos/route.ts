import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'
import { getSessionUser } from '@/lib/require-auth'
import {
  getPaqueteByCreditos,
  isValidPaquete,
  isValidMetodoPago,
  isValidComprobanteUrl,
  getPrecioByCreditos,
} from '@/lib/creditos'

// POST /api/comprar-creditos
// Fase 3 Bloque D: hardened
// - User viene de sesión (no de body)
// - Créditos validados contra allowlist servidor
// - Precio ignorado del cliente, se deriva del paquete
// - Método y comprobante validados
export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: 'Config missing' }, { status: 500 })
  }

  // ── Auth: exigir sesión válida (getUser valida JWT con Supabase) ──
  const sessionUser = await getSessionUser(req)
  if (!sessionUser) {
    return NextResponse.json({ ok: false, error: 'No autorizado. Inicia sesión.' }, { status: 401 })
  }
  const userId = sessionUser.id

  const sb = createClient(supabaseUrl, serviceKey)

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 })
  }

  // Solo aceptamos creditos, metodoPago y comprobanteUrl del cliente.
  // userId y precioUsd del cliente se IGNORAN por seguridad.
  const { creditos, metodoPago, comprobanteUrl } = body

  // ── Validaciones ──
  if (creditos === undefined || creditos === null) {
    return NextResponse.json({ ok: false, error: 'Falta cantidad de créditos' }, { status: 400 })
  }

  const creditosNum = Number(creditos)
  if (!Number.isFinite(creditosNum) || !Number.isInteger(creditosNum)) {
    return NextResponse.json({ ok: false, error: 'Créditos debe ser entero válido' }, { status: 400 })
  }

  if (!isValidPaquete(creditosNum)) {
    return NextResponse.json(
      { ok: false, error: `Paquete de ${creditosNum} créditos no válido. Paquetes permitidos: 2, 15, 40, 100` },
      { status: 400 }
    )
  }

  const paquete = getPaqueteByCreditos(creditosNum)!
  const precioUsdServer = paquete.precio // Fuente única servidor

  if (!metodoPago || typeof metodoPago !== 'string') {
    return NextResponse.json({ ok: false, error: 'Método de pago requerido' }, { status: 400 })
  }

  if (!isValidMetodoPago(metodoPago)) {
    return NextResponse.json({ ok: false, error: 'Método de pago no permitido' }, { status: 400 })
  }

  if (!comprobanteUrl || typeof comprobanteUrl !== 'string') {
    return NextResponse.json({ ok: false, error: 'Comprobante requerido' }, { status: 400 })
  }

  if (!isValidComprobanteUrl(comprobanteUrl)) {
    return NextResponse.json(
      { ok: false, error: 'URL de comprobante no válida. Debe ser de nuestro almacenamiento.' },
      { status: 400 }
    )
  }

  // ── Rate limiting: max 12/hora por usuario (Fase 2) ──
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const rl = await checkRateLimit('creditos:comprar', userId, { ip })
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: `Demasiados intentos. Espera ${Math.ceil(rl.resetIn / 60000)} min` },
      { status: 429 }
    )
  }

  // ── Guardar como pendiente con datos validados servidor ──
  const { data: tx, error: txErr } = await sb
    .from('transacciones_creditos')
    .insert({
      user_id: userId,
      tipo: 'compra',
      monto: paquete.creditos, // desde servidor
      precio_usd: precioUsdServer,
      metodo_pago: metodoPago,
      comprobante_url: comprobanteUrl,
      estado: 'pendiente',
    })
    .select()
    .single()

  if (txErr) {
    return NextResponse.json({ ok: false, error: txErr.message }, { status: 500 })
  }

  // Notificar a Telegram con botones
  const BOT = process.env.TELEGRAM_BOT_TOKEN
  const CHAT = process.env.TELEGRAM_CHAT_ID

  if (BOT && CHAT) {
    try {
      await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT,
          text: `🛒 Nueva compra de créditos\n\n📦 ${paquete.creditos} créditos — ${precioUsdServer} € (validado servidor)\n💳 ${metodoPago}\n👤 ${userId} (${sessionUser.email || 'sin email'})\n\nRevisa comprobante y aprueba:`,
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Aprobar', callback_data: `aprobar:${tx.id}` },
                { text: '❌ Rechazar', callback_data: `rechazar:${tx.id}` },
              ],
            ],
          },
        }),
      })
    } catch {
      // No fallar la compra si Telegram falla
    }
  }

  return NextResponse.json({ ok: true, transaccionId: tx.id, creditos: paquete.creditos, precioUsd: precioUsdServer })
}
