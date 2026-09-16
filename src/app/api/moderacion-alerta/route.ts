import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push-notify'
import { requireUser } from '@/lib/require-auth'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { isValidUUID, sanitizeString } from '@/lib/validation'

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

  if (!['sospechoso', 'prohibido'].includes(body.nivel)) {
    return NextResponse.json({ ok: false, error: 'Nivel inválido' }, { status: 400 })
  }
  if (body.userId !== auth.user.id || !isValidUUID(body.userId)) {
    return NextResponse.json({ ok: false, error: 'Usuario inválido' }, { status: 403 })
  }
  if (typeof body.titulo !== 'string' || !body.titulo.trim()) {
    return NextResponse.json({ ok: false, error: 'Título requerido' }, { status: 400 })
  }

  const titulo = sanitizeString(body.titulo, 200)
  const palabras = Array.isArray(body.palabras)
    ? body.palabras.filter((word: unknown) => typeof word === 'string').slice(0, 20).map((word: string) => sanitizeString(word, 80))
    : []
  const texto = [
    `ALERTA MODERACIÓN — ${String(body.nivel).toUpperCase()}`,
    '',
    `Título: ${titulo}`,
    `Usuario: ${auth.user.email || auth.user.id}`,
    `Palabras: ${palabras.join(', ') || 'N/A'}`,
  ].join('\n')

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const adminEmail = (process.env.ADMIN_EMAILS || 'gtrespana@gmail.com')
    .split(',')[0]
    .trim()
    .toLowerCase()
  const { data: authUsers } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const adminId = authUsers?.users.find((user: any) => user.email?.toLowerCase() === adminEmail)?.id
  const { data: adminProfile } = adminId
    ? await sb.from('perfiles').select('id').eq('id', adminId).maybeSingle()
    : { data: null }

  if (adminProfile) {
    await notifyUser(sb, adminProfile.id, {
      title: '🚨 Alerta de moderación',
      body: `${body.nivel.toUpperCase()}: ${titulo}`,
      tag: `mod-${body.nivel}`,
      icon: '/icon-192.png',
      click_url: '/admin',
    }).catch(() => {})
  }

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
