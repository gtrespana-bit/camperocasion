/**
 * Inspección precompra — API de las partes (plan de confianza §4.1).
 *
 *   GET  /api/inspecciones              → mis solicitudes (como comprador)
 *   GET  /api/inspecciones?productoId=  → las solicitudes de un anuncio (mías)
 *   POST /api/inspecciones { productoId, notas? } → solicitar inspección
 *
 * Igual que en reservas: las escrituras van con service_role porque el
 * navegador no tiene INSERT/UPDATE sobre `solicitudes_inspeccion` (políticas +
 * grants de la migración). El flujo lo conduce el equipo desde el panel; el
 * comprador solo crea y cancela (ver /api/inspecciones/cancelar).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/require-auth'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { isValidUUID } from '@/lib/validation'
import {
  ESTADOS_INSPECCION_VIVOS,
  puedeSolicitarInspeccion,
} from '@/lib/inspecciones'
import { notificarAdminTelegram } from '@/lib/telegram-admin'
import { notifyUser } from '@/lib/push-notify'

const COLUMNAS = `
  id, producto_id, comprador_id, estado, precio, notas, informe,
  revisado_por, creado_en, actualizado_en, completada_en,
  producto:productos ( id, slug, titulo, precio_usd, imagen_url )
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
    const auth = await requireUser(request)
    if ('response' in auth) return auth.response

    const sb = serviceClient()
    const productoId = new URL(request.url).searchParams.get('productoId')

    let query = sb
      .from('solicitudes_inspeccion')
      .select(COLUMNAS)
      .eq('comprador_id', auth.user.id)
      .order('creado_en', { ascending: false })
      .limit(50)

    if (productoId) {
      if (!isValidUUID(productoId)) {
        return NextResponse.json({ error: 'productoId inválido' }, { status: 400 })
      }
      query = query.eq('producto_id', productoId).limit(5)
    }

    const { data, error } = await query
    if (error) {
      // Migración no aplicada: la inspección simplemente no está disponible.
      if (/solicitudes_inspeccion/i.test(error.message || '')) {
        return NextResponse.json({ ok: true, inspecciones: [], pendienteMigracion: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { ok: true, inspecciones: data || [] },
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

    const limit = await checkRateLimit('inspeccion:create', auth.user.id, { ip: getClientIp(request) })
    if (!limit.ok) return rateLimitResponse(limit.resetIn)

    const body = await request.json().catch(() => ({}))
    const { productoId, notas } = body as { productoId?: string; notas?: string }

    if (!productoId || !isValidUUID(productoId)) {
      return NextResponse.json({ error: 'productoId inválido' }, { status: 400 })
    }

    const sb = serviceClient()

    const { data: producto, error: productoError } = await sb
      .from('productos')
      .select('id, titulo, user_id, activo, vendido, estado_moderacion')
      .eq('id', productoId)
      .maybeSingle()

    if (productoError || !producto) {
      return NextResponse.json({ error: 'Anuncio no encontrado' }, { status: 404 })
    }

    const { data: existente } = await sb
      .from('solicitudes_inspeccion')
      .select('id, estado')
      .eq('producto_id', productoId)
      .eq('comprador_id', auth.user.id)
      .in('estado', [...ESTADOS_INSPECCION_VIVOS])
      .maybeSingle()

    const veredicto = puedeSolicitarInspeccion(producto, existente as any, auth.user.id)
    if (!veredicto.ok) {
      return NextResponse.json({ error: veredicto.motivo }, { status: 409 })
    }

    const { data: inspeccion, error: insertError } = await sb
      .from('solicitudes_inspeccion')
      .insert({
        producto_id: productoId,
        comprador_id: auth.user.id,
        estado: 'solicitada',
        notas: notas ? String(notas).slice(0, 500) : null,
      })
      .select('id, estado, creado_en')
      .single()

    if (insertError || !inspeccion) {
      // El índice único parcial es la última red: dos solicitudes a la vez.
      if (/duplicate|unique/i.test(insertError?.message || '')) {
        return NextResponse.json({ error: 'Ya tienes una inspección en marcha para este anuncio' }, { status: 409 })
      }
      if (/solicitudes_inspeccion/i.test(insertError?.message || '')) {
        return NextResponse.json(
          { error: 'La inspección precompra aún no está disponible. Inténtalo más tarde.' },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: 'No se pudo crear la solicitud' }, { status: 500 })
    }

    // Avisos (best-effort: nunca bloquean la solicitud del comprador).
    notifyUser(sb, auth.user.id, {
      title: 'Solicitud de inspección recibida',
      body: 'Te contactaremos con el presupuesto (orientativo 150-250 €).',
      tag: `inspeccion-${inspeccion.id}`,
      click_url: '/dashboard?tab=inspecciones',
    }).catch(() => {})

    notificarAdminTelegram(
      `🔍 Nueva inspección precompra\n${producto.titulo}\nComprador: ${auth.user.email || auth.user.id}\nSolicitud: ${inspeccion.id}`,
    ).catch(() => {})

    return NextResponse.json({ ok: true, inspeccion })
  } catch (err: any) {
    console.error('inspecciones POST error:', err)
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
