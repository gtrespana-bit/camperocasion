/**
 * Gestoría del cambio de nombre — panel de administración (plan §4.2).
 *
 *   GET  /api/admin/gestoria?estado=nueva|en_gestion|cerrada|todas
 *   POST /api/admin/gestoria { action: 'gestionar'|'cerrar'|'reabrir'|'notas', leadId, notas? }
 *
 * El lead se contacta a mano (teléfono/email) y aquí solo se marca el embudo
 * y se dejan notas de la coordinación con la gestoría partner.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/require-auth'
import { isValidUUID } from '@/lib/validation'
import { normalizarEstadoGestoria, puedeTransicionarGestoria } from '@/lib/gestoria'

const COLUMNAS = `
  id, user_id, producto_id, nombre, email, telefono, provincia, matricula,
  mensaje, estado, notas_admin, creado_en, actualizado_en,
  producto:productos ( id, slug, titulo )
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

    const estadoParam = new URL(request.url).searchParams.get('estado') || 'todas'
    const sb = serviceClient()

    let query = sb
      .from('solicitudes_gestoria')
      .select(COLUMNAS)
      .order('creado_en', { ascending: true }) // FIFO: nadie sin contactar más de lo justo
      .limit(100)

    if (estadoParam !== 'todas') {
      query = query.eq('estado', normalizarEstadoGestoria(estadoParam))
    }

    const { data, error } = await query
    if (error) {
      if (/solicitudes_gestoria/i.test(error.message || '')) {
        return NextResponse.json({ ok: true, leads: [], pendienteMigracion: true })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      { ok: true, leads: data || [] },
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
    const { action, leadId, notas } = body as {
      action?: string
      leadId?: string
      notas?: string
    }

    if (!['gestionar', 'cerrar', 'reabrir', 'notas'].includes(String(action))) {
      return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
    }
    if (!leadId || !isValidUUID(leadId)) {
      return NextResponse.json({ error: 'leadId inválido' }, { status: 400 })
    }

    const sb = serviceClient()

    const cambios: Record<string, unknown> = {
      actualizado_en: new Date().toISOString(),
    }

    if (action !== 'notas') {
      const destino =
        action === 'gestionar' ? 'en_gestion' : action === 'cerrar' ? 'cerrada' : 'en_gestion'

      const { data: lead, error } = await sb
        .from('solicitudes_gestoria')
        .select('id, estado')
        .eq('id', leadId)
        .maybeSingle()

      if (error || !lead) {
        return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
      }
      if (!puedeTransicionarGestoria(lead.estado, destino)) {
        return NextResponse.json(
          { error: `No se puede pasar de "${lead.estado}" a "${destino}"` },
          { status: 409 },
        )
      }
      cambios.estado = destino
    }

    if (typeof notas === 'string') {
      cambios.notas_admin = notas.trim() ? notas.trim().slice(0, 1000) : null
    }

    const { error: updateError } = await sb
      .from('solicitudes_gestoria')
      .update(cambios)
      .eq('id', leadId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('admin/gestoria POST error:', err)
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
