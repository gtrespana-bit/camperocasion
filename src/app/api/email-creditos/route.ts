import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { emailCreditosAgregados } from '@/lib/server-email'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push-notify'

// POST /api/email-creditos — send credit added notification
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('response' in auth) return auth.response
  const ip = getClientIp(req)
  const limit = await checkRateLimit('notificacion:send', auth.user.id, { ip })
  if (!limit.ok) return rateLimitResponse(limit.resetIn)
  try {
    const { userId, cantidad, balanceTotal } = await req.json()
    if (!userId || !cantidad) return NextResponse.json({ ok: false, error: 'Missing fields' }, { status: 400 })

    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: authUsers } = await sb.auth.admin.listUsers()
    const user = authUsers.users.find((u: any) => u.id === userId)
    if (!user?.email) return NextResponse.json({ ok: false, error: 'Email not found' }, { status: 404 })

    const nombre = user.email.split('@')[0]
    await emailCreditosAgregados(user.email, nombre, cantidad, balanceTotal ?? cantidad)

    // Push notification
    await notifyUser(sb, userId, {
      title: '💰 Créditos recibidos',
      body: `${cantidad} créditos fueron agregados a tu cuenta. Balance total: ${balanceTotal ?? cantidad}.`,
      tag: 'creditos-email',
      icon: '/icon-192.png',
      click_url: '/creditos',
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
