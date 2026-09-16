import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUUIDs } from '@/lib/validation'
import { requireAdmin } from '@/lib/require-auth'

export async function POST(req: NextRequest) {
  try {
    // Solo admin con sesión real (antes se confiaba en un email enviado en el body)
    const auth = await requireAdmin(req)
    if ('response' in auth) return auth.response

    const body = await req.json()
    const { productId, action } = body
    
    // Validar UUID
    const uuidCheck = requireUUIDs(body, ['productId'])
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    }

    if (!['aprobar', 'rechazar'].includes(action)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const updateData = action === 'aprobar'
      ? { estado_moderacion: 'aprobado', motivo_moderacion: null }
      : { estado_moderacion: 'rechazado', motivo_moderacion: 'Bloqueado por admin', activo: false }

    const { error } = await sb
      .from('productos')
      .update(updateData)
      .eq('id', productId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
