import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireUUIDs, sanitizeString } from '@/lib/validation'
import { requireUser, getAdminEmails } from '@/lib/require-auth'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if ('response' in auth) return auth.response
    const sessionUserId = auth.user.id
    const isAdmin = getAdminEmails().includes((auth.user.email || '').toLowerCase())

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const { producto_id, evaluador_id, evaluado_id, puntuacion, comentario } = body
    const uuidCheck = requireUUIDs(body, ['producto_id', 'evaluador_id', 'evaluado_id'])
    if (!uuidCheck.valid) return NextResponse.json({ error: uuidCheck.error }, { status: 400 })

    if (!isAdmin && evaluador_id !== sessionUserId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const puntuacionNum = Number(puntuacion)
    if (!Number.isInteger(puntuacionNum) || puntuacionNum < 1 || puntuacionNum > 5) {
      return NextResponse.json({ error: 'Puntuación inválida' }, { status: 400 })
    }
    const comentarioClean = comentario == null ? null : sanitizeString(String(comentario), 500)

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data: product, error: productError } = await sb
      .from('productos')
      .select('user_id, vendido, comprador_id')
      .eq('id', producto_id)
      .maybeSingle()

    if (productError || !product) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    if (!product.vendido || !product.comprador_id) {
      return NextResponse.json({ error: 'Solo se puede reseñar una venta confirmada' }, { status: 409 })
    }
    if (evaluador_id === evaluado_id) {
      return NextResponse.json({ error: 'No puedes reseñarte a ti mismo' }, { status: 400 })
    }

    const esVendedor = evaluador_id === product.user_id
    const esComprador = evaluador_id === product.comprador_id
    const evaluadoEsperado = esVendedor ? product.comprador_id : esComprador ? product.user_id : null
    if (!evaluadoEsperado || evaluado_id !== evaluadoEsperado) {
      return NextResponse.json({ error: 'La reseña no corresponde a los participantes de la venta' }, { status: 403 })
    }

    const { error } = await sb.from('resenas').insert({
      producto_id,
      vendedor_id: product.user_id,
      comprador_id: evaluador_id,
      puntuacion: puntuacionNum,
      comentario: comentarioClean,
    })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ya existe una reseña para esta venta' }, { status: 409 })
      }
      return NextResponse.json({ error: 'No se pudo guardar la reseña' }, { status: 500 })
    }

    try {
      const { data: reviewer } = await sb
        .from('perfiles')
        .select('nombre')
        .eq('id', evaluador_id)
        .maybeSingle()
      await sb.from('notificaciones_push').insert({
        target_user_id: evaluado_id,
        tipo: 'resena_recibida',
        titulo: `${reviewer?.nombre || 'Un participante'} te dejó una reseña ⭐`,
        cuerpo: 'Puedes consultar tu reputación desde el dashboard.',
        click_url: '/dashboard?tab=reputacion',
      })
    } catch {
      // Notificación secundaria.
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error guardando la reseña' }, { status: 500 })
  }
}
