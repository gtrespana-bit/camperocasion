import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/require-auth'
import { requireUUIDs } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if ('response' in auth) return auth.response

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const uuidCheck = requireUUIDs(body, ['productoId'])
  if (!uuidCheck.valid) {
    return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: product, error: productError } = await sb
    .from('productos')
    .select('user_id, vendido, estado_moderacion')
    .eq('id', body.productoId)
    .maybeSingle()

  if (productError || !product) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }
  if (product.user_id !== auth.user.id) {
    return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 })
  }
  if (product.estado_moderacion === 'rechazado') {
    return NextResponse.json({ error: 'Un producto rechazado requiere revisión administrativa' }, { status: 409 })
  }

  const { error } = await sb
    .from('productos')
    .update({ activo: true, vendido: false, vendido_en: null, comprador_id: null })
    .eq('id', body.productoId)
    .eq('user_id', auth.user.id)

  if (error) {
    return NextResponse.json({ error: 'No se pudo reactivar el producto' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
