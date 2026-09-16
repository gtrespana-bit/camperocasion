import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { enviarRecuperacion } from '@/lib/recuperacion-email'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/password-reset — Solicita el email de recuperación.
 *
 * Reemplaza a `supabase.auth.resetPasswordForEmail()` (que enviaba por el
 * SMTP del Dashboard de Supabase) para que el correo salga por el canal de
 * la propia app (Resend API o SMTP). Responde ok:true incluso si el email
 * no existe, para no revelar qué correos están registrados.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  let body: { email?: string; locale?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const email = (body.email || '').trim().toLowerCase()
  const locale = body.locale === 'en' ? 'en' : 'es'
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'Ingresa un email válido' }, { status: 400 })
  }

  const limit = await checkRateLimit('auth:password-reset', email, { ip })
  if (!limit.ok) return rateLimitResponse(limit.resetIn)

  try {
    const resultado = await enviarRecuperacion(email, locale)
    if (!resultado.ok) {
      return NextResponse.json({ error: resultado.mensaje }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('❌ Error en /api/password-reset:', e?.message || e)
    return NextResponse.json(
      { error: 'Error inesperado. Inténtalo de nuevo.' },
      { status: 500 },
    )
  }
}
