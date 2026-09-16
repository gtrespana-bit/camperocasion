/**
 * Reservas con señal — API de las partes (Fase 1.2).
 *
 *   GET  /api/reservas?scope=comprador|vendedor   → mis reservas (URLs firmadas)
 *   GET  /api/reservas?productoId=<uuid>          → la reserva de un anuncio
 *   POST /api/reservas  { productoId, importe, metodoPago, mensaje? }
 *
 * Decisiones:
 *  - Las escrituras van con service_role: el navegador no tiene INSERT/UPDATE
 *    sobre `reservas` (políticas + grants de la migración). Así nadie se activa
 *    su propia reserva ni se inventa una señal pagada.
 *  - El comprobante vive en el bucket privado `comprobantes-reserva`; aquí solo
 *    se devuelven URLs firmadas de vida corta a las partes de la reserva.
 *  - Al crear una reserva se "barre" de forma perezosa cualquier reserva
 *    caducada del mismo anuncio (no hay cron): así el anuncio queda libre y el
 *    índice único parcial no bloquea una reserva nueva legítima.
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

const BUCKET = 'comprobantes-reserva'
const URL_FIRMADA_SEGUNDOS = 300

const COLUMNAS = `
  id, producto_id, comprador_id, vendedor_id, importe, comision_pct, metodo_pago,
  estado, comprobante_url, mensaje, motivo_cancelacion, revisado_en, expira_en,
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

/** Caduca las reservas vencidas de un anuncio (barrido perezoso, sin cron). */
async function caducarReservasVencidas(sb: any, productoId: string) {
  const { data } = await sb
    .from('reservas')
    .select('id, estado, expira_en')
    .eq('producto_id', productoId)
    .in('estado', ['pendiente_pago', 'en_revision', 'activa'])

  const vencidas = (data || []).filter((r: any) => !reservaVigente(r.estado, r.expira_en))
  if (vencidas.length === 0) return

  await sb
    .from('reservas')
    .update({ estado: 'expirada', actualizado_en: new Date().toISOString() })
    .in('id', vencidas.map((r: any) => r.id))
}

/** Firma los comprobantes (bucket privado) para las partes de la reserva. */
async function conComprobanteFirmado(sb: any, reservas: any[]) {
  return Promise.all(
    (reservas || []).map(async (r: any) => {
      if (!r.comprobante_url) return { ...r, comprobante_signed_url: null }
      const { data } = await sb.storage
        .from(BUCKET)
        .createSignedUrl(r.comprobante_url, URL_FIRMADA_SEGUNDOS)
      return { ...r, comprobante_signed_url: data?.signedUrl || null }
    }),
  )
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
      // Solo las partes ven los comprobantes; el resto no los necesita.
      const propias = (data || []).filter((r: any) =>
        r.comprador_id === auth.user.id || r.vendedor_id === auth.user.id)
      return NextResponse.json(
        { ok: true, reservas: await conComprobanteFirmado(sb, propias) },
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
      { ok: true, reservas: await conComprobanteFirmado(sb, data || []) },
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

    const { data: reservaViva } = await sb
      .from('reservas')
      .select('id, estado, comprador_id, expira_en')
      .eq('producto_id', productoId)
      .in('estado', ['pendiente_pago', 'en_revision', 'activa'])
      .maybeSingle()

    const veredicto = puedeReservar(producto, reservaViva as any, auth.user.id)
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
        estado: 'pendiente_pago',
        mensaje: mensaje ? String(mensaje).slice(0, 500) : null,
        expira_en: fechaExpiracion(),
      })
      .select('id, estado, importe, expira_en')
      .single()

    if (insertError || !reserva) {
      // El índice único parcial es la última red: dos reservas a la vez.
      if (/duplicate|unique/i.test(insertError?.message || '')) {
        return NextResponse.json({ error: 'Alguien acaba de reservar este anuncio' }, { status: 409 })
      }
      if (/reservas/i.test(insertError?.message || '')) {
        return NextResponse.json(
          { error: 'La reserva con señal aún no está disponible. Inténtalo más tarde.' },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: 'No se pudo crear la reserva' }, { status: 500 })
    }

    // Avisos (best-effort: nunca bloquean la reserva del comprador).
    notifyUser(sb, producto.user_id, {
      title: '¡Tienes una reserva con señal!',
      body: `${producto.titulo}: un comprador quiere reservarlo con ${importeNum} € de señal.`,
      tag: `reserva-${reserva.id}`,
      click_url: `/dashboard?tab=reservas`,
    }).catch(() => {})

    notificarAdminTelegram(
      `🔒 Nueva reserva con señal\n${producto.titulo}\nImporte: ${importeNum} € · Método: ${metodo}\n` +
      `Reserva: ${reserva.id}`,
    ).catch(() => {})

    return NextResponse.json({ ok: true, reserva })
  } catch (err: any) {
    console.error('reservas POST error:', err)
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
