/**
 * POST /api/productos/reactivar-pausados — republica los anuncios que el
 * sistema pausó al bajar el cupo, hasta el límite del plan actual.
 *
 * Se hace en el servidor y con el cupo recalculado: el navegador no puede
 * decidir cuántos caben. Los anuncios que pausó el propio vendedor no se
 * tocan (esos son una decisión suya y se activan uno a uno).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { revalidarListadosPublicos } from '@/lib/revalidar'
import { cupoDeUsuario, reactivarPausadosPorPlan, sbAdmin } from '@/lib/planes-servidor'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response

  const { resumen } = await cupoDeUsuario(auth.user.id)
  const sb = sbAdmin()

  // Cuántos pausados por cupo hay y cuántos caben ahora.
  const { count: pausados, error } = await sb
    .from('productos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.user.id)
    .eq('activo', false)
    .eq('vendido', false)
    .eq('pausado_por_plan', true)

  if (error) {
    // Migración pendiente: no hay nada que reactivar todavía.
    return NextResponse.json({ ok: true, reactivados: 0, restantes: 0 })
  }
  if (!pausados) {
    return NextResponse.json({ ok: true, reactivados: 0, restantes: 0 })
  }

  const reactivados = await reactivarPausadosPorPlan(
    auth.user.id,
    resumen.plan,
    sb,
  )

  if (reactivados > 0) revalidarListadosPublicos()

  return NextResponse.json({
    ok: true,
    reactivados,
    restantes: Math.max(0, (pausados || 0) - reactivados),
    cupo: { max: resumen.max, usados: resumen.usados },
  })
}
