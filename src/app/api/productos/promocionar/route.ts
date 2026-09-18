/**
 * POST /api/productos/promocionar — destacar o boostear un anuncio con créditos.
 *
 * Antes el panel llamaba directamente a las RPC `usar_destacado` y `usar_boost`
 * desde el navegador. El cobro funcionaba, pero la portada y el catálogo (que
 * son ISR) se quedaban con el estado anterior: el usuario pagaba 1-10 créditos
 * y su anuncio no aparecía destacado ni arriba hasta que expiraba la ventana de
 * caché. Cobrar y no enseñar el resultado es la peor combinación posible en una
 * función de pago, así que el cobro pasa por el servidor y aquí se invalidan
 * las páginas afectadas.
 *
 * Las RPC siguen siendo SECURITY DEFINER y siguen comprobando propiedad y saldo:
 * este endpoint no sustituye esas comprobaciones, solo las acompaña.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/require-auth'
import { revalidarListadosPublicos, revalidarFichaProducto } from '@/lib/revalidar'

const HORAS_DESTACADO = [12, 24, 48] as const

function getAdminClient(): any {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response
  const user = auth.user

  const body = await req.json().catch(() => ({}))
  const productId = body?.productId
  const tipo = body?.tipo // 'destacado' | 'boost'
  const horas = Number(body?.horas)

  if (!productId || typeof productId !== 'string') {
    return NextResponse.json({ error: 'productId requerido' }, { status: 400 })
  }
  if (tipo !== 'destacado' && tipo !== 'boost') {
    return NextResponse.json({ error: 'Tipo de promoción no válido' }, { status: 400 })
  }
  if (tipo === 'destacado' && !HORAS_DESTACADO.includes(horas as any)) {
    return NextResponse.json({ error: 'Duración no válida' }, { status: 400 })
  }

  const admin = getAdminClient()

  const { data: producto, error: fetchError } = await admin
    .from('productos')
    .select('id, user_id, slug, activo, vendido')
    .eq('id', productId)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!producto) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 })
  if (producto.user_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  if (!producto.activo || producto.vendido) {
    return NextResponse.json({ error: 'Solo se pueden promocionar publicaciones activas' }, { status: 400 })
  }

  const { data: result, error } = tipo === 'destacado'
    ? await admin.rpc('usar_destacado', { p_producto_id: productId, p_user_id: user.id, p_horas: horas })
    : await admin.rpc('usar_boost', { p_producto_id: productId, p_user_id: user.id })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!result?.ok) {
    return NextResponse.json({ error: result?.error || 'No se pudo aplicar la promoción' }, { status: 400 })
  }

  // El anuncio ya sale promocionado en portada, catálogo, buscador y su ficha.
  revalidarListadosPublicos()
  revalidarFichaProducto(producto.slug)

  return NextResponse.json({ ok: true, balance: result.balance, hasta: result.hasta })
}
