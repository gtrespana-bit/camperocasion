import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/require-auth'
import { isValidUUID } from '@/lib/validation'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req)
    if ('response' in auth) return auth.response
    const userId = auth.user.id

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }
    const { convId } = body
    if (!isValidUUID(convId)) {
      return NextResponse.json({ error: 'Conversación inválida' }, { status: 400 })
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data: conv, error: convError } = await sb
      .from('conversaciones')
      .select('user1_id, user2_id, producto_id')
      .eq('id', convId)
      .maybeSingle()

    if (convError || !conv || !conv.producto_id) {
      return NextResponse.json({ productoOwnerId: null, puedeResenar: false, yaDejoResena: false })
    }
    if (conv.user1_id !== userId && conv.user2_id !== userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { data: prod, error: prodError } = await sb
      .from('productos')
      .select('user_id, activo, vendido, comprador_id')
      .eq('id', conv.producto_id)
      .maybeSingle()

    if (prodError || !prod) {
      return NextResponse.json({ productoOwnerId: null, puedeResenar: false, yaDejoResena: false })
    }

    const productoOwnerId = prod.user_id
    const esVendedor = userId === productoOwnerId
    const esComprador = userId === prod.comprador_id
    const productoVendido = prod.vendido === true

    if (!esComprador || esVendedor || !productoVendido) {
      return NextResponse.json({
        productoOwnerId,
        productoId: conv.producto_id,
        productoVendido,
        puedeResenar: false,
        yaDejoResena: false,
        esVendedor,
      })
    }

    const { count } = await sb
      .from('resenas')
      .select('id', { count: 'exact', head: true })
      .eq('comprador_id', userId)
      .eq('vendedor_id', productoOwnerId)
      .eq('producto_id', conv.producto_id)

    const yaDejoResena = (count ?? 0) > 0
    return NextResponse.json({
      productoOwnerId,
      productoId: conv.producto_id,
      productoVendido,
      puedeResenar: !yaDejoResena,
      yaDejoResena,
    })
  } catch {
    return NextResponse.json({ error: 'No se pudo consultar el estado de la reseña' }, { status: 500 })
  }
}
