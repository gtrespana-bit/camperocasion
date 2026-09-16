import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('response' in auth) return auth.response
  const ip = getClientIp(req)
  const limit = await checkRateLimit('notificacion:send', auth.user.id, { ip })
  if (!limit.ok) return rateLimitResponse(limit.resetIn)
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID

  if (!BOT_TOKEN || !CHAT_ID) {
    return NextResponse.json({ ok: false, error: 'Config missing' }, { status: 500 })
  }

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 })
  }

  const { mensaje, txId, inlineKeyboard } = body as {
    mensaje: string
    txId?: string
    inlineKeyboard?: Array<Array<{ text: string; callback_data: string }>>
  }

  if (!mensaje) {
    return NextResponse.json({ ok: false, error: 'No message' }, { status: 400 })
  }

  const text = String(mensaje).replace(/<[^>]*>/g, '')

  const payload: Record<string, any> = {
    chat_id: CHAT_ID,
    text: text,
  }

  if (inlineKeyboard && txId) {
    payload.reply_markup = {
      inline_keyboard: inlineKeyboard.map(row =>
        row.map(btn => ({
          text: btn.text,
          callback_data: `${btn.callback_data}:${txId}`,
        }))
      ),
    }
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    return NextResponse.json({ ok: data.ok === true, telegram: data })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
