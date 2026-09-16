import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'

/**
 * Obtiene datos de múltiples perfiles (bypass RLS).
 * Usado desde el admin para cargar perfiles en tab de verificación.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const body = await request.json()
    const { userIds } = body

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'userIds requerido' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: perfiles, error } = await supabaseAdmin
      .from('perfiles')
      .select('id, nombre, telefono, cedula_numero, pago_movil_telefono, pago_movil_cedula, pago_movil_banco')
      .in('id', userIds.slice(0, 100)) // max 100 para evitar query muy larga

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, perfiles })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
