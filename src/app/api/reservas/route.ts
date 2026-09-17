/**
 * Reservas con señal — API de las partes (Fase 1.2, confirmación del vendedor).
 *
 *   GET  /api/reservas?scope=comprador|vendedor   → mis reservas
 *   GET  /api/reservas?productoId=<uuid>          → la reserva de un anuncio
 *   POST /api/reservas  { productoId, importe, metodoPago, mensaje? }
 *
 * Decisiones:
 *  - Las escrituras van con service_role: el navegador no tiene INSERT/UPDATE
 *    sobre `reservas` (políticas + grants de la migración). Así nadie se activa
 *    su propia reserva ni se inventa una señal pagada.
 *  - El comprador crea una SOLICITUD (no bloquea el anuncio). El vendedor la
 *    CONFIRMA cuando recibe la señal (ver /api/reservas/confirmar): solo
 *    entonces el anuncio queda reservado. Ya no hay comprobantes ni revisión
 *    del equipo sobre un dinero que la plataforma no ve.
 *  - Al crear una solicitud se "barre" de forma perezosa cualquier reserva
 *    caducada del mismo anuncio (no hay cron): así el índice único parcial no
 *    bloquea una solicitud nueva legítima.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/require-auth'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { isValidUUID } from '@/lib/validation'
import {
  comisionDe,
  fechaExpiracion,
  importeSeñalValido,
  puedeReservar,
  reservaVigente,
  sugerirImporteSeñal,
} from '@/lib/reservas'
import { notificarAdminTelegram } from '@/lib/telegram-admin'
import { notifyUser } from '@/lib/push-notify'

const COLUMNAS = `
  id, producto_id, comprador_id, vendedor_id, importe, comision_pct, metodo_pago,
  estado, mensaje, motivo_cancelacion, revisado_en, expira_en,
  creado_en, actualizado_en,
  producto:productos ( id, slug, titulo, precio_usd, imagen_url )
`

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/** Caduca las solicitudes/reservas vencidas de un anuncio (barrido perezoso). */
async function caducarReservasVencidas(sb: any, productoId: string) {
  const { data } = await sb
    .from('reservas')
    .select('id, estado, expira_en')
    .eq('producto_id', productoId)
    .in('estado', ['solicitada', 'activa'])

  const vencidas = (data || []).filter((r: any) => !reservaVigente(r.estado, r.expira_en))
  if (vencidas.length === 0) return

  await sb
    .from('reservas')
    .update({ estado: 'expirada', actualizado_en: new Date().toISOString() })
    .in('id', vencidas.map((r: any) => r.id))
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if ('response' in auth) return auth.response

    const sb = serviceClient()
    const params = new URL(request.url).searchParams
    const productoId = params.get('productoId')
    const scope = params.get('scope') || 'comprador'

    if (productoId) {
      if (!isValidUUID(productoId)) {
        return NextResponse.json({ error: 'productoId inválido' }, { status: 400 })
      }
      const { data, error } = await sb
        .from('reservas')
        .select(COLUMNAS)
        .eq('producto_id', productoId)
        .order('creado_en', { ascending: false })
        .limit(5)
      if (error) {
        // Migración no aplicada: el anuncio simplemente no se puede reservar.
        if (/reservas/i.test(error.message || '')) {
          return NextResponse.json({ ok: true, reservas: [], pendienteMigracion: true })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      // Sin comprobantes: cualquier parte puede ver la reserva de su anuncio.
      return NextResponse.json(
        { ok: true, reservas: data || [] },
        { headers: { 'Cache-Control': 'no-store, private' } },
      )
    }

    const columna = scope === 'vendedor' ? 'vendedor_id' : 'comprador_id'
    const { data, error } = await sb
      .from('reservas')
      .select(COLUMNAS)
      .eq(columna, auth.user.id)
      .order('creado_en', { ascending: false })
      .limit(50)

    if (error) {
      if (/reservas/i.test(error.message || '')) {
        return NextResponse.json({ ok: true, reservas: [], pendienteMigracion: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { ok: true, reservas: data || [] },
      { headers: { 'Cache-Control': 'no-store, private' } },
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if ('response' in auth) return auth.response

    const limit = await checkRateLimit('reserva:create', auth.user.id, { ip: getClientIp(request) })
    if (!limit.ok) return rateLimitResponse(limit.resetIn)

    const body = await request.json().catch(() => ({}))
    const { productoId, importe, metodoPago, mensaje } = body as {
      productoId?: string
      importe?: number | string
      metodoPago?: string
      mensaje?: string
    }

    if (!productoId || !isValidUUID(productoId)) {
      return NextResponse.json({ error: 'productoId inválido' }, { status: 400 })
    }

    const importeNum = Number(importe) || sugerirImporteSeñal(null)
    if (!importeSeñalValido(importeNum)) {
      return NextResponse.json({ error: 'Importe de señal fuera de rango' }, { status: 400 })
    }
    const metodo = ['bizum', 'transferencia', 'efectivo', 'otro'].includes(String(metodoPago))
      ? String(metodoPago)
      : 'bizum'

    const sb = serviceClient()

    const { data: producto, error: productoError } = await sb
      .from('productos')
      .select('id, titulo, user_id, activo, vendido, reservado, estado_moderacion')
      .eq('id', productoId)
      .maybeSingle()

    if (productoError || !producto) {
      return NextResponse.json({ error: 'Anuncio no encontrado' }, { status: 404 })
    }

    await caducarReservasVencidas(sb, productoId)

    const { data: reservaActiva } = await sb
      .from('reservas')
      .select('id, estado, comprador_id, expira_en')
      .eq('producto_id', productoId)
      .eq('estado', 'activa')
      .maybeSingle()

    const veredicto = puedeReservar(producto, reservaActiva as any, auth.user.id)
    if (!veredicto.ok) {
      return NextResponse.json({ error: veredicto.motivo }, { status: 409 })
    }

    const { data: reserva, error: insertError } = await sb
      .from('reservas')
      .insert({
        producto_id: productoId,
        comprador_id: auth.user.id,
        vendedor_id: producto.user_id,
        importe: importeNum,
        comision_pct: 0,
        comision: comisionDe(importeNum),
        metodo_pago: metodo,
        estado: 'solicitada',
        mensaje: mensaje ? String(mensaje).slice(0, 500) : null,
        expira_en: fechaExpiracion(),
      })
      .select('id, estado, importe, expira_en')
      .single()

    if (insertError || !reserva) {
      // El índice único parcial es la última red: dos solicitudes a la vez.
      if (/duplicate|unique/i.test(insertError?.message || '')) {
        return NextResponse.json({ error: 'Ya tienes una solicitud en este anuncio' }, { status: 409 })
      }
      if (/reservas/i.test(insertError?.message || '')) {
        return NextResponse.json(
          { error: 'La reserva con señal aún no está disponible. Inténtalo más tarde.' },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: 'No se pudo crear la reserva' }, { status: 500 })
    }

    // Aviso al VENDEDOR: es él quien debe confirmar al recibir la señal.
    notifyUser(sb, producto.user_id, {
      title: '🔔 Petición de reserva con señal',
      body: `${producto.titulo}: un comprador quiere reservarlo con ${importeNum} € de señal. Confirma la reserva cuando recibas el pago.`,
      tag: `reserva-${reserva.id}`,
      click_url: '/dashboard?tab=reservas',
    }).catch(() => {})

    notifyUser(sb, auth.user.id, {
      title: 'Solicitud de reserva enviada',
      body: `${producto.titulo}: paga la señal al vendedor y, cuando la reciba, confirmará la reserva.`,
      tag: `reserva-${reserva.id}`,
      click_url: '/dashboard?tab=reservas',
    }).catch(() => {})

    notificarAdminTelegram(
      `🔔 Petición de reserva con señal\\n${producto.titulo}\\nImporte: ${importeNum} € · Método: ${metodo}\\n` +
      `Reserva: ${reserva.id}`,
    ).catch(() => {})

    return NextResponse.json({ ok: true, reserva })
  } catch (err: any) {
    console.error('reservas POST error:', err)
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
