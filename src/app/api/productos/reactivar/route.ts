import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/require-auth'
import { requireUUIDs } from '@/lib/validation'
import { revalidarListadosPublicos } from '@/lib/revalidar'
import { cupoDeUsuario } from '@/lib/planes-servidor'

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

  // Republicar un vendido vuelve a ocupar cupo.
  const { resumen } = await cupoDeUsuario(auth.user.id)
  if (!resumen.puedePublicar) {
    return NextResponse.json(
      {
        error: resumen.max == null
          ? 'No se pudo reactivar el producto.'
          : `Tu plan permite ${resumen.max} anuncio${resumen.max === 1 ? '' : 's'} activo${resumen.max === 1 ? '' : 's'}. Pausa otro o amplía el pack.`,
        codigo: 'CUPO',
        cupo: { max: resumen.max, usados: resumen.usados },
      },
      { status: 403 },
    )
  }

  let { error } = await sb
    .from('productos')
    .update({
      activo: true,
      vendido: false,
      vendido_en: null,
      comprador_id: null,
      pausado_por_plan: false,
      pausado_en: null,
    })
    .eq('id', body.productoId)
    .eq('user_id', auth.user.id)

  if (error) {
    // Compatibilidad si la migración de la fase 2 aún no está aplicada.
    const retry = await sb
      .from('productos')
      .update({ activo: true, vendido: false, vendido_en: null, comprador_id: null })
      .eq('id', body.productoId)
      .eq('user_id', auth.user.id)
    error = retry.error
  }

  if (error) {
    return NextResponse.json({ error: 'No se pudo reactivar el producto' }, { status: 500 })
  }

  // Vuelve a los listados públicos (portada, catálogo y buscador, es/en)
  revalidarListadosPublicos()

  return NextResponse.json({ ok: true })
}
