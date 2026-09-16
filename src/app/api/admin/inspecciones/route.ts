/**
 * Inspección precompra — panel de administración (plan §4.1).
 *
 *   GET  /api/admin/inspecciones?estado=solicitada|vivas|todas|...
 *   POST /api/admin/inspecciones { action: 'presupuestar'|'marcar_pagada'|'marcar_en_curso'|'completar'|'cancelar', solicitudId, precio?, notas? }
 *
 * Todo con service_role: el panel conduce el flujo concierge completo
 * (presupuestar → pago directo confirmado → en curso → completada) y el
 * comprador recibe push con cada cambio. El comprador solo puede crear y
 * cancelar (ver /api/inspecciones).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/require-auth'
import { isValidUUID } from '@/lib/validation'
import {
  ACCIONES_ADMIN_INSPECCION,
  ESTADOS_INSPECCION_VIVOS,
  accionAdminValida,
  puedeTransicionarInspeccion,
  precioInspeccionValido,
} from '@/lib/inspecciones'
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

/** Email y teléfono del comprador para que el equipo pueda contactarlo. */
async function conContactos(sb: any, filas: any[]) {
  const ids = [...new Set((filas || []).map((f: any) => f.comprador_id).filter(Boolean))]
  const contactos: Record<string, { email?: string; nombre?: string; telefono?: string }> = {}
  await Promise.all(
    ids.slice(0, 50).map(async (id: string) => {
      try {
        const { data } = await sb.auth.admin.getUserById(id)
        if (data?.user) {
          const { data: perfil } = await sb
            .from('perfiles')
            .select('nombre, telefono')
            .eq('id', id)
            .maybeSingle()
          contactos[id] = {
            email: data.user.email || undefined,
            nombre: perfil?.nombre || undefined,
            telefono: perfil?.telefono || undefined,
          }
        }
      } catch {
        // Sin contacto el panel sigue funcionando; se coordinará por el chat.
      }
    }),
  )
  return (filas || []).map((f: any) => ({ ...f, comprador: contactos[f.comprador_id] || null }))
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const estadoParam = new URL(request.url).searchParams.get('estado') || 'vivas'
    const sb = serviceClient()

    let query = sb
      .from('solicitudes_inspeccion')
      .select(COLUMNAS)
      .order('creado_en', { ascending: true }) // FIFO: la más vieja primero
      .limit(100)

    if (estadoParam === 'vivas') {
      query = query.in('estado', [...ESTADOS_INSPECCION_VIVOS])
    } else if (estadoParam !== 'todas') {
      query = query.eq('estado', estadoParam)
    }

    const { data, error } = await query
    if (error) {
      if (/solicitudes_inspeccion/i.test(error.message || '')) {
        return NextResponse.json({ ok: true, inspecciones: [], pendienteMigracion: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { ok: true, inspecciones: await conContactos(sb, data || []) },
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
    const { action, solicitudId, precio, notas } = body as {
      action?: string
      solicitudId?: string
      precio?: number | string
      notas?: string
    }

    if (!accionAdminValida(action)) {
      return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
    }
    if (!solicitudId || !isValidUUID(solicitudId)) {
      return NextResponse.json({ error: 'solicitudId inválido' }, { status: 400 })
    }

    const destino = ACCIONES_ADMIN_INSPECCION[action]
    const sb = serviceClient()

    const { data: inspeccion, error } = await sb
      .from('solicitudes_inspeccion')
      .select('id, comprador_id, estado')
      .eq('id', solicitudId)
      .maybeSingle()

    if (error || !inspeccion) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }

    if (!puedeTransicionarInspeccion(inspeccion.estado, destino)) {
      return NextResponse.json(
        { error: `No se puede pasar de "${inspeccion.estado}" a "${destino}"` },
        { status: 409 },
      )
    }

    const cambios: Record<string, unknown> = {
      estado: destino,
      revisado_por: auth.user.id,
      actualizado_en: new Date().toISOString(),
    }

    if (action === 'presupuestar') {
      if (!precioInspeccionValido(precio)) {
        return NextResponse.json({ error: 'Precio fuera de rango (100-400 €)' }, { status: 400 })
      }
      cambios.precio = Number(precio)
    }
    if (action === 'completar') {
      cambios.completada_en = new Date().toISOString()
    }
    if (typeof notas === 'string') {
      cambios.notas = notas.trim() ? notas.trim().slice(0, 500) : null
    }

    const { error: updateError } = await sb
      .from('solicitudes_inspeccion')
      .update(cambios)
      .eq('id', solicitudId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // El comprador sigue el estado desde su dashboard; un aviso por cada paso.
    notifyUser(sb, inspeccion.comprador_id, {
      title: 'Tu inspección se ha actualizado',
      body:
        action === 'presupuestar'
          ? `Presupuesto listo: ${Number(precio)} €. Revisa tu dashboard.`
          : `Estado: ${destino.replace('_', ' ')}.`,
      tag: `inspeccion-${solicitudId}`,
      click_url: '/dashboard?tab=inspecciones',
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('admin/inspecciones POST error:', err)
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
