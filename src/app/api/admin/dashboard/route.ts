import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'

/**
 * Datos agregados para el dashboard del panel admin.
 *
 * Todo se lee con service_role para saltarse RLS y las restricciones de
 * columnas de `perfiles` (p. ej. `credito_balance`, que el JWT del navegador
 * ya no puede leer tras el hardening). También devuelve contadores correctos
 * de moderación/denuncias/verificaciones que RLS filtraría para el cliente.
 */

const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString()

function bucketize(rows: any[], getDate: (r: any) => string | null | undefined, days = 7): number[] {
  const buckets: string[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - (days - 1 - i))
    buckets.push(d.toISOString().slice(0, 10))
  }
  const counts = new Array(days).fill(0)
  rows.forEach((r) => {
    const d = getDate(r)?.slice(0, 10)
    if (!d) return
    const idx = buckets.indexOf(d)
    if (idx >= 0) counts[idx] += 1
  })
  return counts
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const [
      users,
      products,
      active,
      sold,
      pendingMod,
      reports,
      pendVerif,
      verified,
      reviews,
      pendTx,
    ] = await Promise.all([
      sb.from('perfiles').select('id', { count: 'exact', head: true }),
      sb.from('productos').select('id', { count: 'exact', head: true }),
      sb.from('productos').select('id', { count: 'exact', head: true }).eq('activo', true),
      sb.from('productos').select('id', { count: 'exact', head: true }).eq('vendido', true),
      sb.from('productos').select('id', { count: 'exact', head: true }).eq('estado_moderacion', 'pendiente'),
      sb.from('denuncias').select('id', { count: 'exact', head: true }).eq('estado', 'activa'),
      sb.from('solicitudes_verificacion').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      sb.from('perfiles').select('id', { count: 'exact', head: true }).eq('verificado', true),
      sb.from('resenas').select('id', { count: 'exact', head: true }),
      sb.from('transacciones_creditos').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente').eq('tipo', 'compra'),
    ])

    const [recentRes, topRes, usersRes, productsAll, txAll] = await Promise.all([
      sb
        .from('productos')
        .select('id, slug, titulo, precio_usd, imagen_url, visitas, activo, vendido, creado_en, user_id, categoria_id')
        .order('creado_en', { ascending: false })
        .limit(14),
      sb
        .from('productos')
        .select('id, slug, titulo, precio_usd, imagen_url, visitas, activo, creado_en, user_id')
        .order('visitas', { ascending: false })
        .limit(10),
      sb
        .from('perfiles')
        .select('id, nombre, verificado, credito_balance, nivel_confianza, creado_en, estado, ciudad')
        .order('creado_en', { ascending: false })
        .limit(10),
      sb.from('productos').select('id, creado_en').gte('creado_en', daysAgo(7)),
      sb.from('transacciones_creditos').select('id, creado_en').gte('creado_en', daysAgo(7)),
    ])

    // Si alguna consulta de conteo falla, propagamos el error (no queremos un
    // dashboard a medias).
    const countErrors = [users, products, active, sold, pendingMod, reports, pendVerif, verified, reviews, pendTx]
      .map((r) => r.error)
      .filter(Boolean)
    if (countErrors.length) {
      return NextResponse.json({ error: countErrors[0]!.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      counts: {
        users: users.count || 0,
        products: products.count || 0,
        active: active.count || 0,
        sold: sold.count || 0,
        pendingModeration: pendingMod.count || 0,
        activeReports: reports.count || 0,
        pendingVerifications: pendVerif.count || 0,
        pendingTransactions: pendTx.count || 0,
        verified: verified.count || 0,
        reviews: reviews.count || 0,
      },
      recentProducts: recentRes.data || [],
      topProducts: topRes.data || [],
      recentUsers: usersRes.data || [],
      last7Products: bucketize((productsAll.data as any[]) || [], (p: any) => p.creado_en),
      last7Transactions: bucketize((txAll.data as any[]) || [], (p: any) => p.creado_en),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
