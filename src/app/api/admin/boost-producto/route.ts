import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireUUIDs } from '@/lib/validation'
import { requireAdmin } from '@/lib/require-auth'
import { revalidarListadosPublicos } from '@/lib/revalidar'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const body = await request.json()
    const { productId } = body

    // Validar UUID
    const uuidCheck = requireUUIDs(body, ['productId'])
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Boost = poner boosteado_en a ahora para que suba al tope
    const { error } = await supabaseAdmin
      .from('productos')
      .update({ boosteado_en: new Date().toISOString() })
      .eq('id', productId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // El anuncio boosteado sube ya en portada y catálogo
    revalidarListadosPublicos()

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
