import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/require-auth'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import {
  isTelegramAdminCallbackAuthorized,
  isTelegramWebhookAuthorized,
} from '@/lib/telegram-webhook-auth'

export const runtime = 'nodejs'

// Webhook: recibe clicks de botones inline en Telegram (APROBAR/RECHAZAR).
// El chat_id del JSON no autentica al emisor: cualquiera puede falsificarlo.
// Telegram debe enviar el secret_token configurado en setWebhook.
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!webhookSecret || !/^[A-Za-z0-9_-]{32,256}$/.test(webhookSecret)) {
    return NextResponse.json({ ok: false, error: 'Webhook not configured' }, { status: 503 })
  }
  if (!isTelegramWebhookAuthorized(
    req.headers.get('x-telegram-bot-api-secret-token'),
    webhookSecret,
  )) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID || !supabaseUrl || !supabaseKey) {
    return NextResponse.json({ ok: false, error: 'Config missing' }, { status: 503 })
  }

  const ip = getClientIp(req)
  const limit = await checkRateLimit('telegram:webhook', ip, { ip })
  if (!limit.ok) return rateLimitResponse(limit.resetIn)

  try {
    const body = await req.json()
    const callback = body.callback_query
    if (!callback) return NextResponse.json({ ok: true })

    const data = callback.data as string
    const chatId = callback.message.chat.id as number
    const senderId = callback.from?.id as number | undefined
    const messageId = callback.message.message_id as number
    const callbackQueryId = callback.id as string

    // Formato: aprobar:<tx_id> o rechazar:<tx_id>
    const [accion, txId] = data.split(':')

    // Verificar chat y persona autorizada. En un chat privado ambos IDs
    // coinciden por defecto; para un grupo hay que definir TELEGRAM_ADMIN_USER_ID.
    if (!isTelegramAdminCallbackAuthorized(
      chatId,
      senderId,
      process.env.TELEGRAM_CHAT_ID,
      process.env.TELEGRAM_ADMIN_USER_ID,
    )) {
      await tgFetch(BOT_TOKEN, '/answerCallbackQuery', { callback_query_id: callbackQueryId, text: 'No autorizado', show_alert: true })
      return NextResponse.json({ ok: false })
    }

    if (accion === 'aprobar' && txId) {
      const result = await procesarAprobacion(txId, supabaseUrl, supabaseKey)
      await tgFetch(BOT_TOKEN, '/answerCallbackQuery', { callback_query_id: callbackQueryId, text: result.alert, show_alert: false })
      await tgFetch(BOT_TOKEN, '/editMessageText', {
        chat_id: chatId, message_id: messageId, text: result.text, parse_mode: 'HTML',
      })
    } else if (accion === 'rechazar' && txId) {
      const result = await procesarRechazo(txId, supabaseUrl, supabaseKey)
      await tgFetch(BOT_TOKEN, '/answerCallbackQuery', { callback_query_id: callbackQueryId, text: result.alert, show_alert: false })
      await tgFetch(BOT_TOKEN, '/editMessageText', {
        chat_id: chatId, message_id: messageId, text: result.text, parse_mode: 'HTML',
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}

// GET: info del webhook (solo administradores; no publicar estado operativo).
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('response' in auth) return auth.response

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  if (!BOT_TOKEN) return NextResponse.json({ ok: false, error: 'Config missing' }, { status: 503 })

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`)
    return NextResponse.json(await res.json(), { status: res.ok ? 200 : 502 })
  } catch {
    return NextResponse.json({ ok: false, error: 'Telegram unavailable' }, { status: 502 })
  }
}

// ---- Helpers ----

function tgFetch(token: string, method: string, body: object) {
  return fetch(`https://api.telegram.org/bot${token}${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function procesarAprobacion(txId: string, url: string, key: string) {
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: tx, error } = await sb
    .from('transacciones_creditos')
    .select('id, user_id, tipo, monto, metodo_pago, estado, creado_en, comprobante_url')
    .eq('id', txId)
    .maybeSingle()
  if (error || !tx) return { alert: '❌ No encontrada', text: '❌ Transacción no encontrada' }

  const { data: result, error: approvalError } = await sb.rpc('aprobar_transaccion', {
    p_transaccion_id: txId,
    p_admin_id: null,
  })

  if (approvalError || !result?.ok) {
    return {
      alert: '❌ No aprobada',
      text: `❌ No se pudo aprobar: ${result?.error || approvalError?.message || 'error interno'}`,
    }
  }

  return {
    alert: `✅ +${tx.monto} créditos aprobados`,
    text: `✅ <b>APROBADO</b>\n+${tx.monto} créditos\nUsuario: ${tx.user_id}\nMétodo: ${tx.metodo_pago || 'N/A'}\n\n<i>Procesado desde Telegram</i>`,
  }
}

async function procesarRechazo(txId: string, url: string, key: string) {
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await sb
    .from('transacciones_creditos')
    .update({ estado: 'rechazado' })
    .eq('id', txId)
    .eq('estado', 'pendiente')
    .eq('tipo', 'compra')
    .select('id')
    .maybeSingle()

  if (error || !data) {
    return {
      alert: '❌ No rechazada',
      text: `❌ La transacción ya fue procesada o no existe: ${txId}`,
    }
  }

  return {
    alert: '❌ Rechazada',
    text: `❌ <b>RECHAZADA</b>\nTransacción: ${txId}\nCréditos NO añadidos\n\n<i>Procesado desde Telegram</i>`,
  }
}
