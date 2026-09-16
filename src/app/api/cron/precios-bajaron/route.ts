/**
 * GET /api/cron/precios-bajaron — aviso de bajada de precio.
 *
 * Para cada historial_precios de las últimas 24 h con precio a la baja,
 * notifica (push) a quienes guardaron el producto en favoritos.
 * Aversión a la pérdida convertida en retorno del comprador.
 *
 * Programa: diario 14:41 UTC (10:41 am España).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push-notify'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  const admin = createClient(url, key)

  const desde = new Date(Date.now() - 24 * 3600e3).toISOString()

  const { data: cambios, error } = await admin
    .from('historial_precios')
    .select('id, producto_id, precio_anterior, precio_nuevo, productos!inner(id, slug, titulo, user_id, activo)')
    .gte('creado_en', desde)
    .limit(200)

  if (error) {
    const msg = error.message || ''
    // Tabla sin migrar u opinión de schema distinta: saltar sin error
    if (!msg || /42P01|does not exist|not found|could not find the table|schema cache/i.test(msg)) {
      return NextResponse.json({ ok: true, reason: 'tabla-no-existe' })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // usuario → lista de productos que le interesan y bajaron
  const porUsuario = new Map<string, { titulo: string; slug: string; nuevo: number; anterior: number }[]>()

  for (const c of cambios || []) {
    const prod = c.productos as any
    if (!prod || !prod.activo) continue
    if (Number(c.precio_nuevo) >= Number(c.precio_anterior)) continue // solo bajadas

    const { data: favs } = await admin
      .from('favoritos')
      .select('user_id')
      .eq('producto_id', c.producto_id)
      .limit(200)

    for (const f of favs || []) {
      if (f.user_id === prod.user_id) continue // el dueño ya lo sabe
      const lista = porUsuario.get(f.user_id) || []
      lista.push({ titulo: prod.titulo, slug: prod.slug || prod.id, nuevo: Number(c.precio_nuevo), anterior: Number(c.precio_anterior) })
      porUsuario.set(f.user_id, lista)
    }
  }

  let notificados = 0
  for (const [userId, lista] of porUsuario) {
    const primeros = lista.slice(0, 3)
    const body = primeros.length === 1
      ? `"${primeros[0].titulo}" bajó a $${primeros[0].nuevo}`
      : `${lista.length} productos que guardaste bajaron de precio`
    try {
      await notifyUser(admin, userId, {
        title: '📉 Bajó de precio',
        body,
        tag: 'precio-bajo',
        icon: '/icon-192.png',
        click_url: `/producto/${primeros[0].slug}`,
      })
      notificados++
    } catch { /* seguir con el resto */ }
  }

  return NextResponse.json({ ok: true, cambios: cambios?.length || 0, notificados })
}
