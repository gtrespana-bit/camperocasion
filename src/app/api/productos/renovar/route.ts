/**
 * POST /api/productos/renovar — "Renovar publicación" (gratis, cada 7 días).
 *
 * Revive el anuncio: resetea creado_en a ahora, con lo que reaparece en
 * "Recién publicado" y en los ordenamientos por fecha. Regla anti-abuso:
 * solo si el anuncio tiene 7+ días sin renovar y sigue activo/sin vender.
 */
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/require-auth'

const DIAS_RENOVACION = 7

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
  if (!productId || typeof productId !== 'string') {
    return NextResponse.json({ error: 'productId requerido' }, { status: 400 })
  }

  const admin = getAdminClient()

  const { data: producto, error: fetchError } = await admin
    .from('productos')
    .select('id, user_id, activo, vendido, creado_en')
    .eq('id', productId)
    .maybeSingle()

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })
  if (!producto) return NextResponse.json({ error: 'Publicación no encontrada' }, { status: 404 })
  if (producto.user_id !== user.id) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  if (!producto.activo || producto.vendido) {
    return NextResponse.json({ error: 'Solo se pueden renovar publicaciones activas' }, { status: 400 })
  }

  const edadMs = Date.now() - new Date(producto.creado_en).getTime()
  const edadDias = Math.floor(edadMs / 864e5)
  if (edadDias < DIAS_RENOVACION) {
    return NextResponse.json(
      { error: `Podrás renovar en ${DIAS_RENOVACION - edadDias} día(s)`, diasRestantes: DIAS_RENOVACION - edadDias },
      { status: 400 },
    )
  }

  const { error: updateError } = await admin
    .from('productos')
    .update({ creado_en: new Date().toISOString() })
    .eq('id', productId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Revalida las páginas donde el orden por fecha cambia al renovar
  try {
    revalidatePath('/')
    revalidatePath('/catalogo')
  } catch { /* revalidate fuera de contexto — no crítico */ }

  return NextResponse.json({ ok: true })
}
