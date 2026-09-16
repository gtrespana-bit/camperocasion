/**
 * POST /api/reservas/cancelar  { reservaId, motivo? }
 *
 * Cancela una reserva viva. Reglas:
 *  - El comprador puede cancelar mientras esté pendiente, en revisión o activa.
 *  - El vendedor puede cancelar; si la reserva estaba ACTIVA (señal verificada),
 *    se marca `reembolsada` porque él debe devolver la señal: el estado deja
 *    constancia de la devolución, que es lo que el comprador necesita para
 *    reclamar si no llega.
 *  - El admin puede cancelar cualquiera (queda marcado quién y por qué).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminUser, requireUser } from '@/lib/require-auth'
import { isValidUUID } from '@/lib/validation'
import { ESTADOS_VIVOS, normalizarEstadoReserva } from '@/lib/reservas'
import { notifyUser } from '@/lib/push-notify'
import { notificarAdminTelegram } from '@/lib/telegram-admin'

const COLUMNAS = 'id, producto_id, comprador_id, vendedor_id, estado, expira_en, producto:productos ( titulo )'

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
    const reservaId = String(body?.reservaId || '')
    const motivo = body?.motivo ? String(body.motivo).slice(0, 500) : null

    if (!isValidUUID(reservaId)) {
      return NextResponse.json({ error: 'reservaId inválido' }, { status: 400 })
    }

    const sb = serviceClient()
    const { data: reserva, error } = await sb.from('reservas').select(COLUMNAS).eq('id', reservaId).maybeSingle()

    if (error || !reserva) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    }

    const admin = await isAdminUser(request)
    const esComprador = reserva.comprador_id === auth.user.id
    const esVendedor = reserva.vendedor_id === auth.user.id
    if (!admin && !esComprador && !esVendedor) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const estado = normalizarEstadoReserva(reserva.estado)
    if (!ESTADOS_VIVOS.includes(estado)) {
      return NextResponse.json({ error: 'Esta reserva ya está cerrada' }, { status: 409 })
    }

    // Si el vendedor cancela una reserva con la señal ya verificada, tiene que
    // devolverla: el estado lo deja por escrito.
    const nuevoEstado = esVendedor && !admin && estado === 'activa' ? 'reembolsada' : 'cancelada'

    const { error: updateError } = await sb
      .from('reservas')
      .update({
        estado: nuevoEstado,
        motivo_cancelacion: motivo,
        revisado_por: admin ? auth.user.id : null,
        revisado_en: admin ? new Date().toISOString() : null,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', reservaId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const titulo = (reserva as any).producto?.titulo || 'tu anuncio'
    const destinatario = esComprador ? reserva.vendedor_id : reserva.comprador_id

    notifyUser(sb, destinatario, {
      title: nuevoEstado === 'reembolsada' ? 'El vendedor ha cancelado la reserva' : 'Reserva cancelada',
      body: nuevoEstado === 'reembolsada'
        ? `${titulo}: el vendedor cancela y debe devolverte la señal.`
        : `${titulo}: la reserva se ha cancelado y el anuncio vuelve a estar disponible.`,
      tag: `reserva-${reservaId}`,
      click_url: '/dashboard?tab=reservas',
    }).catch(() => {})

    if (admin) {
      notificarAdminTelegram(`❌ Reserva cancelada por el equipo\n${titulo}\nReserva: ${reservaId}`).catch(() => {})
    }

    return NextResponse.json({ ok: true, estado: nuevoEstado })
  } catch (err: any) {
    console.error('reservas/cancelar error:', err)
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
