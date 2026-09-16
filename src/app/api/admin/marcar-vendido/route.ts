import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireUUIDs, isValidUUID } from '@/lib/validation'
import { requireUser, getAdminEmails } from '@/lib/require-auth'

export async function POST(request: NextRequest) {
  try {
    // El dueño del producto (o admin) debe ser la sesión real, no un userId del body
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
    const { productoId, vendidoEn, compradorId } = body

    // Validar UUIDs
    const uuidCheck = requireUUIDs(body, ['productoId'])
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    }

    // compradorId es opcional pero si existe debe ser válido
    if (compradorId && !requireUUIDs({ compradorId }, ['compradorId']).valid) {
      return NextResponse.json({ error: 'compradorId inválido' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data: producto, error: productoError } = await supabaseAdmin
      .from('productos')
      .select('user_id, activo, vendido')
      .eq('id', productoId)
      .maybeSingle()

    if (productoError || !producto) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }
    if (producto.user_id !== sessionUserId && !isAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (producto.vendido) {
      return NextResponse.json({ error: 'El producto ya está marcado como vendido' }, { status: 400 })
    }

    if (compradorId) {
      const u1 = producto.user_id < compradorId ? producto.user_id : compradorId
      const u2 = producto.user_id < compradorId ? compradorId : producto.user_id
      const { data: conversation } = await supabaseAdmin
        .from('conversaciones')
        .select('id')
        .eq('user1_id', u1)
        .eq('user2_id', u2)
        .eq('producto_id', productoId)
        .maybeSingle()
      if (!conversation) {
        return NextResponse.json({ error: 'El comprador no pertenece a una conversación de este producto' }, { status: 400 })
      }
    }

    const lugaresValidos = ['plataforma', 'otra_pagina', 'no_especificado']
    const lugar = lugaresValidos.includes(vendidoEn) ? vendidoEn : 'no_especificado'
    const updateData: Record<string, string | boolean | null> = {
      activo: false,
      vendido: true,
      vendido_en: lugar,
      // Fecha real de venta → alimenta "Vendidos recientemente" en la home
      vendido_fecha: new Date().toISOString(),
    }
    if (compradorId) {
      updateData.comprador_id = compradorId
    }

    const { error } = await supabaseAdmin
      .from('productos')
      .update(updateData)
      .eq('id', productoId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if ('response' in auth) return auth.response
    const sessionUserId = auth.user.id
    const isAdmin = getAdminEmails().includes((auth.user.email || '').toLowerCase())

    const { searchParams } = new URL(request.url)
    const productoId = searchParams.get('productoId')

    if (!productoId || !isValidUUID(productoId)) {
      return NextResponse.json({ error: 'Producto inválido' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data: producto } = await supabaseAdmin
      .from('productos')
      .select('user_id')
      .eq('id', productoId)
      .maybeSingle()

    if (!producto || (producto.user_id !== sessionUserId && !isAdmin)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Buscar conversaciones de este producto

    const { data: conversacionesList }: { data: any[] | null } = await supabaseAdmin
      .from('conversaciones')
      .select('id, user1_id, user2_id')
      .eq('producto_id', productoId)

    if (!conversacionesList || conversacionesList.length === 0) {
      return NextResponse.json({ ok: true, interesados: [] })
    }

    const compradorIds = new Set<string>()
    const conversationIds: string[] = []
    const conversationByBuyer = new Map<string, string>()

    for (const conv of conversacionesList as any[]) {
      const u1: string | null = conv.user1_id || null
      const u2: string | null = conv.user2_id || null
      const ownerId = producto.user_id
      const canSeeConversation = isAdmin || ownerId === sessionUserId
      if (!canSeeConversation) continue
      const buyerId = u1 === ownerId ? u2 : u2 === ownerId ? u1 : null
      if (buyerId && buyerId !== ownerId) {
        compradorIds.add(buyerId)
        conversationIds.push(conv.id)
        conversationByBuyer.set(buyerId, conv.id)
      }
    }

    if (compradorIds.size === 0) {
      return NextResponse.json({ ok: true, interesados: [] })
    }

    const idsArray = Array.from(compradorIds)
    const { data: perfiles } = await supabaseAdmin
      .from('perfiles')
      .select('id, nombre')
      .in('id', idsArray) as { data: { id: string; nombre: string | null }[] | null }

    const { data: ultimosMensajes } = await supabaseAdmin
      .from('mensajes')
      .select('conversacion_id, contenido, creado_en')
      .in('conversacion_id', conversationIds)
      .order('creado_en', { ascending: false }) as { data: { conversacion_id: string; contenido: string | null; creado_en: string }[] | null }

    const ultimoMsgMap = new Map<string, string>()
    for (const m of ultimosMensajes || []) {
      if (!ultimoMsgMap.has(m.conversacion_id)) {
        ultimoMsgMap.set(m.conversacion_id, m.contenido ? m.contenido.substring(0, 60) : '')
      }
    }


    const interesados = (perfiles || []).map((p: any) => ({
      userId: p.id,
      nombre: p.nombre || 'Usuario',
      ultimoMensaje: ultimoMsgMap.get(conversationByBuyer.get(p.id) || '') || '',
    }))

    return NextResponse.json({ ok: true, interesados })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
