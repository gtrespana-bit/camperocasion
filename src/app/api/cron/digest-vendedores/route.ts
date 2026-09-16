/**
 * GET /api/cron/digest-vendedores — email/push semanal al vendedor.
 *
 * "Tus anuncios tuvieron N vistas esta semana" (endowment → retorno).
 * Compara `visitas` acumulado contra visitas_snapshot; la primera
 * corrida solo deja la línea base. Solo notifica si hubo actividad
 * (un "0 vistas" desmotiva y genera bajas).
 *
 * Programa: lunes 13:05 UTC (9:05 am España).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push-notify'
import { enviarDigestVendedor } from '@/email/server-email'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  const admin = createClient(url, key)

  // 1) Publicaciones activas con visitas
  const { data: productos, error } = await admin
    .from('productos')
    .select('id, user_id, titulo, visitas')
    .eq('activo', true)
    .eq('vendido', false)
    .limit(2000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 2) Snapshots existentes (si la tabla aún no está migrada, esta corrida
  // solo deja pasar: la siguiente, con tabla y línea base, ya calculará)
  const { data: snapshots, error: snapError } = await admin
    .from('visitas_snapshot')
    .select('producto_id, visitas')
  if (snapError) {
    const msg = snapError.message || ''
    // PostgREST usa mensajes distintos según la versión: cubrimos el rango
    // (una corrida saltada es preferible a un error semanal repetido).
    if (!msg || /42P01|does not exist|not found|could not find the table|schema cache/i.test(msg)) {
      return NextResponse.json({ ok: true, reason: 'tabla-no-existe' })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
  const previo = new Map<string, number>((snapshots || []).map((s: any) => [s.producto_id, s.visitas]))

  // 3) Delta por usuario (solo productos con snapshot previo = no es corrida 1)
  const porUsuario = new Map<string, { visitas: number; topTitulo: string; topDelta: number }>()
  let baseline = 0

  for (const p of productos || []) {
    const antes = previo.get(p.id)
    if (antes === undefined) { baseline++; continue }
    const delta = Math.max(0, (p.visitas || 0) - antes)
    if (delta <= 0) continue
    const agg = porUsuario.get(p.user_id) || { visitas: 0, topTitulo: p.titulo, topDelta: 0 }
    agg.visitas += delta
    if (delta > agg.topDelta) { agg.topDelta = delta; agg.topTitulo = p.titulo }
    porUsuario.set(p.user_id, agg)
  }

  // 4) Favoritos nuevos por usuario (7 días)
  const desde = new Date(Date.now() - 7 * 864e5).toISOString()
  const { data: favs } = await admin
    .from('favoritos')
    .select('user_id, producto_id, creado_en, productos!inner(user_id)')
    .gte('creado_en', desde)
    .limit(2000)

  const guardadosPorUsuario = new Map<string, number>()
  for (const f of favs || []) {
    const dueno = (f.productos as any)?.user_id
    if (!dueno || dueno === f.user_id) continue
    guardadosPorUsuario.set(dueno, (guardadosPorUsuario.get(dueno) || 0) + 1)
  }

  // 5) Emails (auth.users paginado) + nombres
  const userIds = new Set([...porUsuario.keys(), ...guardadosPorUsuario.keys()])
  const emailPorUser = new Map<string, string>()
  for (let page = 1; page <= 10 && emailPorUser.size < userIds.size; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    for (const u of data?.users || []) if (userIds.has(u.id)) emailPorUser.set(u.id, u.email!)
    if (!data?.users?.length) break
  }
  const { data: perfiles } = await admin
    .from('perfiles')
    .select('id, nombre')
    .in('id', [...userIds])
  const nombrePorUser = new Map<string, string>((perfiles || []).map((p: any) => [p.id, p.nombre || '']))

  // 6) Enviar: email (si SMTP) + push como respaldo
  let enviados = 0
  for (const [userId, agg] of porUsuario) {
    const guardados = guardadosPorUsuario.get(userId) || 0
    if (agg.visitas <= 0 && guardados <= 0) continue
    try {
      const email = emailPorUser.get(userId)
      if (email) {
        await enviarDigestVendedor(email, nombrePorUser.get(userId) || '', { visitas: agg.visitas, guardados, topTitulo: agg.topTitulo })
      }
      await notifyUser(admin, userId, {
        title: '📊 Tus anuncios esta semana',
        body: `${agg.visitas} vistas${guardados > 0 ? ` · ${guardados} guardados` : ''} esta semana`,
        tag: 'digest-semanal',
        icon: '/icon-192.png',
        click_url: '/dashboard',
      })
      enviados++
    } catch { /* un fallo no frena el resto */ }
  }

  // 7) Nueva línea base para todos los activos
  const filas = (productos || []).map((p: any) => ({
    producto_id: p.id,
    visitas: p.visitas || 0,
    actualizado_en: new Date().toISOString(),
  }))
  for (let i = 0; i < filas.length; i += 500) {
    await admin.from('visitas_snapshot').upsert(filas.slice(i, i + 500), { onConflict: 'producto_id' })
  }

  return NextResponse.json({ ok: true, conActividad: porUsuario.size, enviados, baseline })
}
