/**
 * Reservas con señal (Fase 1.2, confirmación del vendedor) — panel admin.
 *
 *   GET  /api/admin/reservas?estado=vivas|activas|solicitadas|todas
 *   POST /api/admin/reservas { action: 'completar'|'cancelar', reservaId, motivo? }
 *
 * El dinero ya no pasa por la plataforma ni se revisa ningún comprobante: el
 * vendedor confirma la señal desde su dashboard (/api/reservas/confirmar). El
 * admin observa y puede cerrar reservas (completar una venta o cancelar con
 * motivo), igual que en el resto del panel todo pasa por service_role.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'
import { isValidUUID } from '@/lib/validation'
import {
  ESTADOS_PENDIENTES,
  ESTADOS_RESERVA,
  ESTADOS_VIVOS,
  normalizarEstadoReserva,
} from '@/lib/reservas'
import { notifyUser } from '@/lib/push-notify'

const COLUMNAS = `
  id, producto_id, comprador_id, vendedor_id, importe, comision, comision_pct,
  metodo_pago, estado, mensaje, motivo_cancelacion,
  revisado_en, expira_en, creado_en, actualizado_en,
  producto:productos ( id, slug, titulo, precio_usd, imagen_url, user_id )
`

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const params = new URL(request.url).searchParams
    const estadoParam = params.get('estado') || 'solicitadas'
    const sb = serviceClient()

    let query = sb.from('reservas').select(COLUMNAS).order('creado_en', { ascending: false }).limit(100)
    if (estadoParam === 'vivas') {
      query = query.in('estado', [...ESTADOS_PENDIENTES, ...ESTADOS_VIVOS])
    } else if (estadoParam !== 'todas') {
      query = query.eq('estado', normalizarEstadoReserva(estadoParam))
    }

    const { data, error } = await query
    if (error) {
      if (/reservas/i.test(error.message || '')) {
        return NextResponse.json({
          ok: true,
          reservas: [],
          stats: { solicitadas: 0, activas: 0, completadas: 0, total: 0 },
          pendienteMigracion: true,
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const reservas = (data || []).map((r: any) => ({ ...r }))

    // Contadores de la cabecera (independientes del filtro activo).
    const conteos = await Promise.all(
      ESTADOS_RESERVA.map(e =>
        sb.from('reservas').select('id', { count: 'exact', head: true }).eq('estado', e)),
    )
    const stats = {
      solicitadas: conteos[ESTADOS_RESERVA.indexOf('solicitada')]?.count || 0,
      activas: conteos[ESTADOS_RESERVA.indexOf('activa')]?.count || 0,
      completadas: conteos[ESTADOS_RESERVA.indexOf('completada')]?.count || 0,
      vivas: 0,
      total: 0,
    }
    stats.vivas = (stats.solicitadas || 0) + (stats.activas || 0)
    stats.total = conteos.reduce((acc, r) => acc + (r.count || 0), 0)

    return NextResponse.json(
      { ok: true, reservas, stats },
      { headers: { 'Cache-Control': 'no-store, private' } },
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const body = await request.json().catch(() => ({}))
    const { action, reservaId, motivo } = body as { action?: string; reservaId?: string; motivo?: string }

    const acciones = ['completar', 'cancelar']
    if (!acciones.includes(String(action))) {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }
    if (!reservaId || !isValidUUID(reservaId)) {
      return NextResponse.json({ error: 'reservaId inválido' }, { status: 400 })
    }
    if (String(action) === 'cancelar' && !String(motivo || '').trim()) {
      return NextResponse.json({ error: 'Motivo requerido' }, { status: 400 })
    }

    const sb = serviceClient()
    const ahora = new Date()

    const { data: reserva, error } = await sb
      .from('reservas')
      .select(COLUMNAS)
      .eq('id', reservaId)
      .maybeSingle()

    if (error || !reserva) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 })
    }

    const estadoActual = normalizarEstadoReserva(reserva.estado)
    if (!ESTADOS_PENDIENTES.includes(estadoActual) && !ESTADOS_VIVOS.includes(estadoActual)) {
      return NextResponse.json({ error: `La reserva ya está cerrada (${estadoActual})` }, { status: 409 })
    }

    const destino = String(action) === 'completar' ? 'completada' : 'cancelada'
    const cambios: Record<string, unknown> = {
      estado: destino,
      revisado_por: auth.user.id,
      revisado_en: ahora.toISOString(),
      actualizado_en: ahora.toISOString(),
      motivo_cancelacion: String(action) === 'cancelar' ? String(motivo).slice(0, 500) : null,
    }

    const { error: updateError } = await sb.from('reservas').update(cambios).eq('id', reservaId)
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const titulo = (reserva as any).producto?.titulo || 'el anuncio'
    const para = String(action) === 'completar' ? 'vendedor' : 'comprador'
    const textoNotif = String(action) === 'completar'
      ? `${titulo}: la reserva se ha cerrado como venta. Recuerda descontar la señal del precio.`
      : `${titulo}: la reserva se ha cancelado y el anuncio vuelve a estar disponible.`
    const destinatario = para === 'vendedor' ? reserva.vendedor_id : reserva.comprador_id
    notifyUser(sb, destinatario, {
      title: String(action) === 'completar' ? 'Operación completada' : 'Reserva cancelada',
      body: textoNotif,
      tag: `reserva-${reservaId}`,
      click_url: '/dashboard?tab=reservas',
    }).catch(() => {})

    return NextResponse.json({ ok: true, estado: destino })
  } catch (err: any) {
    console.error('admin/reservas error:', err)
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
