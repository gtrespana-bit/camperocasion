import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { reenviarConfirmacion } from '@/lib/confirmacion-email'

/**
 * POST /api/reconfirmar — Reenvía el email de confirmación por el SMTP de la
 * app para cuentas existentes que aún no confirmaron su email.
 *
 * Reemplaza a `supabase.auth.resend()` (que enviaba por el SMTP de Supabase,
 * roto cuando la cuenta Zoho dejó de tener acceso SMTP).
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req)

  let body: { email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const email = (body.email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Ingresa un email válido' }, { status: 400 })
  }

  const limit = await checkRateLimit('auth:reconfirmar', email, { ip })
  if (!limit.ok) return rateLimitResponse(limit.resetIn)

  try {
    const resultado = await reenviarConfirmacion(email)
    if (!resultado.ok) {
      return NextResponse.json(
        { error: resultado.mensaje, detalle: (resultado as any).detalle || null },
        { status: 502 },
      )
    }
    // ok:true aunque no exista la cuenta o ya esté confirmada: respuesta
    // idéntica para no revelar si un email está registrado.
    return NextResponse.json({ ok: true, yaRegistrado: !!resultado.yaRegistrado })
  } catch (e: any) {
    console.error('❌ Error en /api/reconfirmar:', e?.message || e)
    return NextResponse.json({ error: 'Error inesperado al reenviar. Inténtalo de nuevo.' }, { status: 500 })
  }
}
