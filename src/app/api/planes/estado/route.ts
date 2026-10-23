/**
 * GET /api/planes/estado — todo lo que el panel necesita para enseñar el plan:
 * identidad del vendedor, pack efectivo, cupo usado, días de prueba, créditos
 * y si la suscripción se puede gestionar en Stripe.
 *
 * Se calcula en el servidor a partir de `perfiles`, no del JWT del navegador.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { estadoPlanUsuario } from '@/lib/planes-servidor'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response

  try {
    const estado = await estadoPlanUsuario(auth.user.id)
    return NextResponse.json({ ok: true, ...estado })
  } catch (e: any) {
    console.error('[planes/estado]', e?.message || e)
    return NextResponse.json({ ok: false, error: 'No se pudo cargar tu plan' }, { status: 500 })
  }
}
