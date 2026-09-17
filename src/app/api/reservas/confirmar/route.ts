/**
 * POST /api/reservas/confirmar  { reservaId, accion: 'confirmar' | 'rechazar', motivo? }
 *
 * El VENDEDOR confirma o rechaza una solicitud de reserva. Como el dinero va
 * directo entre comprador y vendedor, es el vendedor quien sabe si la señal ha
 * llegado: al confirmar, la reserva pasa a 'activa', el anuncio se marca
 * reservado y la ventana de 7 días arranca desde ese momento.
 *
 * Reglas de seguridad (escrituras con service_role, el navegador no toca la
 * tabla): solo el vendedor del anuncio (o un admin) puede confirmar/rechazar.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminUser, requireUser } from '@/lib/require-auth'
import { isValidUUID } from '@/lib/validation'
import { DIAS_VALIDEZ_RESERVA, normalizarEstadoReserva } from '@/lib/reservas'
import { notifyUser } from '@/lib/push-notify'
import { notificarAdminTelegram } from '@/lib/telegram-admin'

const COLUMNAS = `
  id, producto_id, comprador_id, vendedor_id, estado, importe,
  producto:productos ( titulo )
`

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
    const accion = String(body?.accion || '')
    const motivo = body?.motivo ? String(body.motivo).slice(0, 500) : null

    if (!['confirmar', 'rechazar'].includes(accion)) {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }
    if (!isValidUUID(reservaId)) {
      return NextResponse.json({ error: 'reservaId inválido' }, { status: 400 })
    }

    const sb = serviceClient()
    const { data: reserva, error } = await sb.from('reservas').select(COLUMNAS).eq('id', reservaId).maybeSingle()

    if (error || !reserva) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    }

    const admin = await isAdminUser(request)
    const esVendedor = reserva.vendedor_id === auth.user.id
    if (!admin && !esVendedor) {
      return NextResponse.json({ error: 'Solo el vendedor puede confirmar esta reserva' }, { status: 403 })
    }

    const estado = normalizarEstadoReserva(reserva.estado)
    if (estado !== 'solicitada') {
      return NextResponse.json({ error: 'Esta solicitud ya no se puede confirmar' }, { status: 409 })
    }

    const ahora = new Date()
    const estadoNuevo = accion === 'confirmar' ? 'activa' : 'rechazada'
    const cambios: Record<string, unknown> = {
      estado: estadoNuevo,
      actualizado_en: ahora.toISOString(),
    }
    // La ventana de 7 días arranca cuando la señal se confirma.
    if (accion === 'confirmar') {
      cambios.expira_en = new Date(ahora.getTime() + DIAS_VALIDEZ_RESERVA * 24 * 60 * 60 * 1000).toISOString()
    }
    if (accion === 'rechazar') {
      cambios.motivo_cancelacion = motivo
    }

    const { error: updateError } = await sb.from('reservas').update(cambios).eq('id', reservaId)
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const titulo = (reserva as any).producto?.titulo || 'tu anuncio'

    if (accion === 'confirmar') {
      notifyUser(sb, reserva.comprador_id, {
        title: '✅ Reserva confirmada',
        body: `${titulo}: el vendedor ha recibido tu señal y el anuncio queda reservado para ti.`,
        tag: `reserva-${reservaId}`,
        click_url: '/dashboard?tab=reservas',
      }).catch(() => {})
      notificarAdminTelegram(`✅ Reserva confirmada\\n${titulo}\\nReserva: ${reservaId}`).catch(() => {})
    } else {
      notifyUser(sb, reserva.comprador_id, {
        title: 'Solicitud de reserva rechazada',
        body: `${titulo}: el vendedor no ha confirmado la reserva${motivo ? ` (${motivo})` : ''}.`,
        tag: `reserva-${reservaId}`,
        click_url: '/dashboard?tab=reservas',
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, estado: estadoNuevo })
  } catch (err: any) {
    console.error('reservas/confirmar error:', err)
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
