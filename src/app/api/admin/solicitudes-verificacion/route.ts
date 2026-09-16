import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'
import { requireUUIDs } from '@/lib/validation'

/**
 * Listado y gestión de solicitudes de verificación de vendedores.
 *
 * Tras el hardening de RLS, `solicitudes_verificacion` solo es visible para
 * `auth.uid() = user_id OR public.is_admin()`. El panel admin no debe depender
 * del JWT del navegador (que puede no resolver `is_admin()` si la tabla
 * `public.admins` está desincronizada con ADMIN_EMAILS), así que toda la lectura
 * y escritura pasa por el service_role aquí.
 */

// Canónico telefono/dni/banco + dni_foto_*; legados pago_movil_*/cedula_foto_* se mantienen sincronizados
const SOLICITUD_COLUMNS =
  'id, user_id, telefono, dni, banco, dni_foto_frente_url, dni_foto_dorso_url, pago_movil_telefono, pago_movil_cedula, pago_movil_banco, cedula_foto_frente_url, cedula_foto_dorso_url, mensaje, estado, creada_en, revisada_en, rechazo_motivo'

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const params = new URL(request.url).searchParams
    const estado = params.get('estado')

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    let query = sb
      .from('solicitudes_verificacion')
      .select(SOLICITUD_COLUMNS)
      .order('creada_en', { ascending: false })

    if (estado && ['pendiente', 'aprobada', 'rechazada'].includes(estado)) {
      query = query.eq('estado', estado)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, solicitudes: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const body = await request.json()
    // Aceptar tanto canónico (telefono/dni/banco) como legado (pago_movil_*)
    const { action, id, userId, motivo } = body
    const pago_movil_telefono = body.pago_movil_telefono ?? body.telefono
    const pago_movil_cedula = body.pago_movil_cedula ?? body.dni
    const pago_movil_banco = body.pago_movil_banco ?? body.banco

    const uuidCheck = requireUUIDs(body, ['id'])
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    }

    if (!['aprobar', 'rechazar'].includes(action)) {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 })
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    if (action === 'rechazar') {
      if (!motivo || !String(motivo).trim()) {
        return NextResponse.json({ error: 'Motivo de rechazo requerido' }, { status: 400 })
      }
      const { error } = await sb
        .from('solicitudes_verificacion')
        .update({
          estado: 'rechazada',
          rechazo_motivo: String(motivo).slice(0, 1000),
          revisada_en: new Date().toISOString(),
        })
        .eq('id', id)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }

    // acción: aprobar
    const userIdCheck = requireUUIDs(body, ['userId'])
    if (!userIdCheck.valid) {
      return NextResponse.json({ error: userIdCheck.error }, { status: 400 })
    }

    const { error: solError } = await sb
      .from('solicitudes_verificacion')
      .update({ estado: 'aprobada', revisada_en: new Date().toISOString() })
      .eq('id', id)
    if (solError) {
      return NextResponse.json({ error: solError.message }, { status: 500 })
    }

    // Marcar el perfil como verificado y copiar los datos de identidad declarados.
    // Canónico ES: telefono/dni/banco/dni_foto_*. Legados sincronizados por trigger.
    const updateData: Record<string, any> = {
      verificado: true,
      verificado_desde: new Date().toISOString(),
    }
    if (pago_movil_telefono) { updateData.telefono_verificacion = pago_movil_telefono; updateData.pago_movil_telefono = pago_movil_telefono; updateData.telefono = pago_movil_telefono }
    if (pago_movil_cedula) {
      updateData.dni = pago_movil_cedula; updateData.pago_movil_cedula = pago_movil_cedula; updateData.cedula_numero = pago_movil_cedula
    }
    if (pago_movil_banco) { updateData.banco_verificacion = pago_movil_banco; updateData.pago_movil_banco = pago_movil_banco; updateData.banco = pago_movil_banco }

    const { error: perfilError } = await sb
      .from('perfiles')
      .update(updateData)
      .eq('id', userId)
    if (perfilError) {
      return NextResponse.json({ error: perfilError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
