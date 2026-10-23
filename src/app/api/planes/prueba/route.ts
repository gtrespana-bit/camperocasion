/**
 * POST /api/planes/prueba — empieza la prueba de 30 días desde un clic.
 *
 * Por qué existe: antes la prueba se activaba sola al registrarse como
 * profesional y se calculaba desde el alta. Un particular que tenía stock no
 * podía probar Plus sin cambiar antes su tipo, y quien entraba a mirar
 * consumía la prueba sin usarla.
 *
 * Todas las comprobaciones viven en `iniciarTrialPerfil` (servidor). Aquí solo
 * se autentica, se limita el ritmo y se traduce el resultado a HTTP.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { iniciarTrialPerfil } from '@/lib/planes-servidor'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const rl = await checkRateLimit('planes:prueba', auth.user.id, { ip })
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'Demasiados intentos. Espera un momento.' },
      { status: 429 },
    )
  }

  const resultado = await iniciarTrialPerfil(auth.user.id)
  if (!resultado.ok) {
    const status =
      resultado.codigo === 'YA_ACTIVO' || resultado.codigo === 'YA_USADA'
        ? 409
        : resultado.codigo === 'NO_DISPONIBLE'
          ? 403
          : resultado.codigo === 'MIGRACION'
            ? 503
            : 500
    return NextResponse.json(
      { ok: false, codigo: resultado.codigo, error: resultado.error },
      { status },
    )
  }

  return NextResponse.json({ ...resultado, ok: true })
}
