import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { emailVerificacionAprobada, emailSubidaNivel } from '@/lib/server-email'

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('response' in auth) return auth.response
  const ip = getClientIp(req)
  const limit = await checkRateLimit('notificacion:send', auth.user.id, { ip })
  if (!limit.ok) return rateLimitResponse(limit.resetIn)
  try {
    const { userId, nuevoNivel, nivelAnterior } = await req.json()
    if (!userId) return NextResponse.json({ ok: false, error: 'Missing userId' }, { status: 400 })

    const sb = (await import('@supabase/supabase-js')).createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: authUsers } = await sb.auth.admin.listUsers()
    const user = authUsers.users.find((u: any) => u.id === userId)
    if (!user?.email) return NextResponse.json({ ok: false, error: 'Email not found' }, { status: 404 })

    const nombre = user.email.split('@')[0]

    if (nuevoNivel && nivelAnterior !== undefined) {
      await emailSubidaNivel(user.email, nombre, nuevoNivel, nivelAnterior)
    } else {
      await emailVerificacionAprobada(user.email, nombre)
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
