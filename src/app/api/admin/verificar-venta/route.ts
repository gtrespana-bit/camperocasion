import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireUUIDs } from '@/lib/validation'
import { requireAdmin } from '@/lib/require-auth'

/**
 * Verifica un vendedor desde el admin.
 * Actualiza el perfil (bypass RLS via service key) y copia los datos de pago.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const body = await request.json()
    const { userId, cedula_numero, pago_movil_telefono, pago_movil_cedula, pago_movil_banco } = body

    // Validar UUID
    const uuidCheck = requireUUIDs(body, ['userId'])
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const updateData: Record<string, any> = {
      verificado: true,
      verificado_desde: new Date().toISOString(),
    }

    // Copiar datos de pago al perfil si vienen
    if (cedula_numero) updateData.cedula_numero = cedula_numero
    if (pago_movil_telefono) updateData.pago_movil_telefono = pago_movil_telefono
    if (pago_movil_cedula) updateData.pago_movil_cedula = pago_movil_cedula
    if (pago_movil_banco) updateData.pago_movil_banco = pago_movil_banco

    const { error } = await supabaseAdmin
      .from('perfiles')
      .update(updateData)
      .eq('id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
