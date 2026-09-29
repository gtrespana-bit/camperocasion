import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'
import { sbAdmin } from '@/lib/planes-servidor'
import { mapaEmailsDeUsuarios } from '@/lib/admin-usuarios'

/**
 * Lista perfiles del marketplace con el email de auth.users.
 * `perfiles` no tiene columna email — vive en auth.users.
 *
 * Incluye las columnas de pack (`plan_anuncios`, `plan_hasta`) para que la
 * pestaña Usuarios pueda mostrar el estado del pack y regalarlo desde ahí.
 * Si la migración de planes aún no está aplicada, se degrada a la consulta
 * básica en vez de devolver un error que dejaría la pestaña vacía.
 */

const COLUMNAS_BASE =
  'id, nombre, telefono, estado, ciudad, credito_balance, verificado, nivel_confianza, creado_en'
const COLUMNAS_PACK =
  `${COLUMNAS_BASE}, tipo_vendedor, plan_anuncios, plan_hasta, ultima_actividad`

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const supabaseAdmin = sbAdmin()

    let perfiles: any[] | null = null
    const completo = await supabaseAdmin
      .from('perfiles')
      .select(COLUMNAS_PACK)
      .order('creado_en', { ascending: false })
      .limit(500)

    if (completo.error) {
      const basico = await supabaseAdmin
        .from('perfiles')
        .select(COLUMNAS_BASE)
        .order('creado_en', { ascending: false })
        .limit(500)
      if (basico.error) {
        return NextResponse.json({ error: basico.error.message }, { status: 500 })
      }
      perfiles = basico.data
    } else {
      perfiles = completo.data
    }

    const lista = perfiles || []
    const emailById = await mapaEmailsDeUsuarios(supabaseAdmin, lista.map((p) => p.id))

    const usuarios = lista.map((p) => ({
      ...p,
      email: emailById.get(p.id) || null,
    }))

    return NextResponse.json({ ok: true, usuarios })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
