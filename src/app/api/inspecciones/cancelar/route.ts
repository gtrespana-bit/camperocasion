/**
 * Cancelación de una inspección por el COMPRADOR (plan §4.1).
 *
 *   POST /api/inspecciones/cancelar { solicitudId }
 *
 * Solo el comprador de la solicitud y solo desde un estado vivo. El admin
 * tiene sus propias acciones en /api/admin/inspecciones (allí también se
 * cancela, con el mismo efecto para el comprador).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/require-auth'
import { isValidUUID } from '@/lib/validation'
import { ESTADOS_INSPECCION_VIVOS, puedeTransicionarInspeccion } from '@/lib/inspecciones'

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if ('response' in auth) return auth.response

    const body = await request.json().catch(() => ({}))
    const { solicitudId } = body as { solicitudId?: string }

    if (!solicitudId || !isValidUUID(solicitudId)) {
      return NextResponse.json({ error: 'solicitudId inválido' }, { status: 400 })
    }

    const sb = serviceClient()

    const { data: inspeccion, error } = await sb
      .from('solicitudes_inspeccion')
      .select('id, comprador_id, estado')
      .eq('id', solicitudId)
      .maybeSingle()

    if (error || !inspeccion) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }

    if (inspeccion.comprador_id !== auth.user.id) {
      return NextResponse.json({ error: 'No es tu solicitud' }, { status: 403 })
    }

    // Si ya no está viva, cancelarla de nuevo es inofensivo pero raro: 409.
    if (!ESTADOS_INSPECCION_VIVOS.includes(inspeccion.estado as never)) {
      return NextResponse.json({ error: 'La solicitud ya está cerrada' }, { status: 409 })
    }

    if (!puedeTransicionarInspeccion(inspeccion.estado, 'cancelada')) {
      return NextResponse.json({ error: 'La solicitud no se puede cancelar ahora mismo' }, { status: 409 })
    }

    const { error: updateError } = await sb
      .from('solicitudes_inspeccion')
      .update({ estado: 'cancelada', actualizado_en: new Date().toISOString() })
      .eq('id', solicitudId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
