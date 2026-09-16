import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response

  const limit = await checkRateLimit('notificacion:send', auth.user.id, { ip: getClientIp(req) })
  if (!limit.ok) return rateLimitResponse(limit.resetIn)

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID

  if (!BOT_TOKEN || !CHAT_ID) {
    return NextResponse.json({ ok: false, error: 'Config missing' }, { status: 500 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 })
  }

  const clean = (value: unknown, max: number) => String(value || '').replace(/[\u0000-\u001f]/g, '').slice(0, max)
  const cedula = clean(body.cedula, 40)
  const telefono = clean(body.telefono, 40)
  const banco = clean(body.banco, 100)
  const nombre = clean(auth.user.email || auth.user.id, 160)

  const texto = [
    'NUEVA SOLICITUD DE VERIFICACIÓN',
    '',
    `Usuario: ${nombre}`,
    `Cédula: ${cedula || 'No disponible'}`,
    `Teléfono: ${telefono || 'No disponible'}`,
    `Banco: ${banco || 'No disponible'}`,
  ].join('\n')

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: texto }),
    })
    const data = await res.json()
    return NextResponse.json({ ok: data.ok === true })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
