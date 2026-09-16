/**
 * GET /api/cron/busquedas — alertas de búsquedas guardadas.
 *
 * Para cada búsqueda guardada busca publicaciones NUEVAS (desde su
 * ultima_revision, con ventana de 1 h a 7 días) que coincidan con los
 * filtros y envía push al usuario. Actualiza ultima_revision en todas
 * las procesadas.
 *
 * Programa: cada 6 h (vercel.json). Seguridad: Bearer CRON_SECRET,
 * igual que clean-rate-limits.
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

  const { data: busquedas, error } = await admin
    .from('busquedas_guardadas')
    .select('id, user_id, q, categoria, subcategoria, marca, condicion, ubicacion_estado, ubicacion_ciudad, precio_min, precio_max, ultima_revision')
    .limit(500)

  // Tabla aún no migrada → sin error, nada que hacer
  if (error) {
    const msg = error.message || ''
    const noMigrada = /42P01|does not exist|not found|could not find the table|schema cache/i.test(msg)
    if (noMigrada) return NextResponse.json({ ok: true, checked: 0, reason: 'tabla-no-existe' })
    return NextResponse.json({ error: msg || 'error desconocido' }, { status: 500 })
  }

  const ahora = Date.now()
  let notificados = 0

  for (const b of busquedas || []) {
    // Ventana: desde la última revisión, jamás más de 7 días ni menos de 1 h
    const desde = new Date(Math.max(
      Math.min(new Date(b.ultima_revision).getTime() || 0, ahora - 3600e3),
      ahora - 7 * 864e5,
    )).toISOString()

    let sq = admin
      .from('productos')
      .select('id, slug, titulo')
      .eq('activo', true)
      .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado')
      .gte('creado_en', desde)
      .limit(3)

    try {
      if (b.q) sq = sq.textSearch('search_vector', String(b.q), { config: 'spanish', type: 'plain' })
      if (b.categoria) {
        const { data: catRow } = await admin.from('categorias').select('id').eq('nombre', b.categoria).maybeSingle()
        if (catRow) sq = sq.eq('categoria_id', catRow.id)
      }
      if (b.subcategoria) sq = sq.eq('subcategoria', b.subcategoria)
      if (b.marca) sq = sq.eq('marca', b.marca)
      if (b.condicion) sq = sq.eq('estado', b.condicion)
      if (b.ubicacion_ciudad) sq = sq.eq('ubicacion_ciudad', b.ubicacion_ciudad)
      else if (b.ubicacion_estado) sq = sq.eq('ubicacion_estado', b.ubicacion_estado)
      if (b.precio_min) sq = sq.gte('precio_usd', Number(b.precio_min))
      if (b.precio_max) sq = sq.lte('precio_usd', Number(b.precio_max))

      const { data: nuevos, error: qError } = await sq
      if (qError) throw qError

      if (nuevos && nuevos.length > 0) {
        const etiqueta = b.q || b.subcategoria || b.categoria || 'tu búsqueda'
        const params = new URLSearchParams()
        if (b.q) params.set('q', b.q)
        if (b.categoria) params.set('categoria', b.categoria)
        if (b.subcategoria) params.set('subcategoria', b.subcategoria)
        if (b.marca) params.set('marca', b.marca)
        if (b.ubicacion_ciudad) params.set('ciudad', b.ubicacion_ciudad)
        else if (b.ubicacion_estado) params.set('estado', b.ubicacion_estado)

        await notifyUser(admin, b.user_id, {
          title: '🔔 Hay novedades para tu búsqueda',
          body: nuevos.length === 1
            ? `"${nuevos[0].titulo}" coincide con "${etiqueta}"`
            : `${nuevos.length} publicaciones nuevas coinciden con "${etiqueta}"`,
          tag: `busqueda-${b.id.slice(0, 8)}`,
          icon: '/icon-192.png',
          click_url: `/buscar?${params.toString()}`,
        })
        notificados++
      }
    } catch (e: any) {
      // Una búsqueda rota (p. ej. sintaxis tsquery) no debe frenar el resto
      console.error('[cron/busquedas] búsqueda fallida', b.id, e?.message)
    } finally {
      await admin
        .from('busquedas_guardadas')
        .update({ ultima_revision: new Date(ahora).toISOString() })
        .eq('id', b.id)
    }
  }

  return NextResponse.json({ ok: true, checked: busquedas?.length || 0, notificados })
}
