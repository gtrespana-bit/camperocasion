/**
 * Revisión de reservas con señal (Fase 1.2) — panel de administración.
 *
 *   GET  /api/admin/reservas?estado=pendiente|todas|...
 *   POST /api/admin/reservas { action: 'activar'|'rechazar'|'completar'|'reembolsar'|'cancelar', reservaId, motivo? }
 *
 * Igual que en verificación y homologación, todo pasa por service_role: la RLS
 * de `reservas` no depende del JWT del panel y el navegador no puede activar una
 * reserva (ni escribir en la tabla).
 *
 * Al ACTIVAR se renueva la fecha límite: la reserva verificada da una semana
 * desde la verificación, no desde que el comprador la creó.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'
import { isValidUUID } from '@/lib/validation'
import {
  DIAS_VALIDEZ_RESERVA,
  ESTADOS_RESERVA,
  ESTADOS_VIVOS,
  normalizarEstadoReserva,
  reservaVigente,
} from '@/lib/reservas'
import { notifyUser } from '@/lib/push-notify'

const BUCKET = 'comprobantes-reserva'
const URL_FIRMADA_SEGUNDOS = 300

const COLUMNAS = `
  id, producto_id, comprador_id, vendedor_id, importe, comision, comision_pct,
  metodo_pago, estado, comprobante_url, mensaje, motivo_cancelacion,
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
    const estadoParam = params.get('estado') || 'pendiente'
    const sb = serviceClient()

    let query = sb.from('reservas').select(COLUMNAS).order('creado_en', { ascending: false }).limit(100)
    if (estadoParam === 'vivas') {
      query = query.in('estado', [...ESTADOS_VIVOS])
    } else if (estadoParam !== 'todas') {
      query = query.eq('estado', normalizarEstadoReserva(estadoParam))
    }

    const { data, error } = await query
    if (error) {
      if (/reservas/i.test(error.message || '')) {
        return NextResponse.json({
          ok: true,
          reservas: [],
          stats: { pendientes: 0, vivas: 0, total: 0 },
          pendienteMigracion: true,
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Comprobante con URL firmada para poder revisarlo sin abrir el bucket.
    const reservas = await Promise.all(
      (data || []).map(async (r: any) => {
        // Una reserva vencida se muestra como tal aunque el barrido perezoso no
        // haya pasado todavía: el panel no debe decir "activa" de algo caducado.
        const vigente = reservaVigente(r.estado, r.expira_en)
        if (!r.comprobante_url) return { ...r, comprobante_signed_url: null, vigente }
        const { data: firmada } = await sb.storage
          .from(BUCKET)
          .createSignedUrl(r.comprobante_url, URL_FIRMADA_SEGUNDOS)
        return { ...r, comprobante_signed_url: firmada?.signedUrl || null, vigente }
      }),
    )

    // Contadores de la cabecera (independientes del filtro activo).
    const conteos = await Promise.all(
      ESTADOS_RESERVA.map(e =>
        sb.from('reservas').select('id', { count: 'exact', head: true }).eq('estado', e)),
    )
    const stats = {
      pendientes: conteos[ESTADOS_RESERVA.indexOf('pendiente_pago')]?.count || 0,
      enRevision: conteos[ESTADOS_RESERVA.indexOf('en_revision')]?.count || 0,
      activas: conteos[ESTADOS_RESERVA.indexOf('activa')]?.count || 0,
      completadas: conteos[ESTADOS_RESERVA.indexOf('completada')]?.count || 0,
      vivas: 0,
      total: 0,
    }
    stats.vivas = (stats.pendientes || 0) + (stats.enRevision || 0) + (stats.activas || 0)
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

    const acciones = ['activar', 'rechazar', 'completar', 'reembolsar', 'cancelar']
    if (!acciones.includes(String(action))) {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }
    if (!reservaId || !isValidUUID(reservaId)) {
      return NextResponse.json({ error: 'reservaId inválido' }, { status: 400 })
    }
    if (['rechazar', 'reembolsar', 'cancelar'].includes(String(action)) && !String(motivo || '').trim()) {
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
    const estadoNuevo: Record<string, string> = {
      activar: 'activa',
      rechazar: 'rechazada',
      completar: 'completada',
      reembolsar: 'reembolsada',
      cancelar: 'cancelada',
    }
    const destino = estadoNuevo[String(action)]

    if (!ESTADOS_VIVOS.includes(estadoActual)) {
      return NextResponse.json({ error: `La reserva ya está cerrada (${estadoActual})` }, { status: 409 })
    }
    if (action === 'activar' && !reserva.comprobante_url) {
      return NextResponse.json({ error: 'No hay comprobante que verificar' }, { status: 409 })
    }

    const cambios: Record<string, unknown> = {
      estado: destino,
      revisado_por: auth.user.id,
      revisado_en: ahora.toISOString(),
      actualizado_en: ahora.toISOString(),
      motivo_cancelacion: ['rechazar', 'reembolsar', 'cancelar'].includes(String(action))
        ? String(motivo).slice(0, 500)
        : null,
    }

    // Activar renueva la ventana: la semana cuenta desde la verificación.
    if (action === 'activar') {
      cambios.expira_en = new Date(ahora.getTime() + DIAS_VALIDEZ_RESERVA * 24 * 60 * 60 * 1000).toISOString()
    }

    const { error: updateError } = await sb.from('reservas').update(cambios).eq('id', reservaId)
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const titulo = (reserva as any).producto?.titulo || 'el anuncio'
    const avisos: Record<string, { para: 'comprador' | 'vendedor'; title: string; body: string }> = {
      activar: {
        para: 'comprador',
        title: '✅ Reserva activada',
        body: `${titulo}: tu señal está verificada y el anuncio queda reservado. Contacta con el vendedor para la entrega.`,
      },
      rechazar: {
        para: 'comprador',
        title: 'Comprobante rechazado',
        body: `${titulo}: no hemos podido validar el comprobante. Sube uno nuevo desde tu panel para mantener la reserva.`,
      },
      completar: {
        para: 'vendedor',
        title: 'Operación completada',
        body: `${titulo}: la reserva se ha cerrado como venta. Recuerda descontar la señal del precio.`,
      },
      reembolsar: {
        para: 'comprador',
        title: 'Señal devuelta',
        body: `${titulo}: la reserva se ha cerrado y el vendedor debe devolverte la señal.`,
      },
      cancelar: {
        para: 'comprador',
        title: 'Reserva cancelada',
        body: `${titulo}: la reserva se ha cancelado y el anuncio vuelve a estar disponible.`,
      },
    }
    const aviso = avisos[String(action)]
    if (aviso) {
      const destinatario = aviso.para === 'comprador' ? reserva.comprador_id : reserva.vendedor_id
      notifyUser(sb, destinatario, {
        title: aviso.title,
        body: aviso.body,
        tag: `reserva-${reservaId}`,
        click_url: '/dashboard?tab=reservas',
      }).catch(() => {})
    }

    return NextResponse.json({ ok: true, estado: destino })
  } catch (err: any) {
    console.error('admin/reservas error:', err)
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
