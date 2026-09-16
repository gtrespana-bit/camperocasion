import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'

/**
 * Contadores ligeros para los badges de navegación del panel admin.
 * Se leen con service_role (sin RLS) para que los contadores de
 * moderación/denuncias/verificación sean correctos.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const [tx, pubs, verif, denies, homol, insp, gest] = await Promise.all([
      sb.from('transacciones_creditos').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente').eq('tipo', 'compra'),
      sb.from('productos').select('id', { count: 'exact', head: true }).eq('estado_moderacion', 'pendiente'),
      sb.from('solicitudes_verificacion').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      sb.from('denuncias').select('id', { count: 'exact', head: true }).eq('estado', 'activa'),
      // Expedientes de homologación esperando revisión (Fase 0.2). Si la
      // migración aún no está aplicada, el contador queda en 0 sin romper el panel.
      sb.from('productos').select('id', { count: 'exact', head: true }).eq('verificacion_homologacion', 'pendiente'),
      // Inspecciones por coordinar y leads de gestoría sin contactar (plan §4).
      // Misma tolerancia: sin la migración, contador a 0.
      sb.from('solicitudes_inspeccion').select('id', { count: 'exact', head: true }).eq('estado', 'solicitada'),
      sb.from('solicitudes_gestoria').select('id', { count: 'exact', head: true }).eq('estado', 'nueva'),
    ])

    const err = [tx, pubs, verif, denies].map((r) => r.error).filter(Boolean)[0]
    if (err) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      counts: {
        transacciones: tx.count || 0,
        publicaciones: pubs.count || 0,
        denuncias: denies.count || 0,
        verificacion: verif.count || 0,
        homologacion: homol.error ? 0 : homol.count || 0,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
