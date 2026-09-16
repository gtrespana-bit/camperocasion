import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/require-auth'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response

  const params = new URL(request.url).searchParams
  const estado = params.get('estado')
  const limit = Math.min(Math.max(Number(params.get('limit') || 200), 1), 500)

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  let query = sb
    .from('transacciones_creditos')
    .select('id, user_id, tipo, monto, precio_usd, metodo_pago, estado, creado_en, comprobante_url')
    .eq('tipo', 'compra')
    .order('creado_en', { ascending: false })
    .limit(limit)

  if (estado && ['pendiente', 'aprobado', 'rechazado'].includes(estado)) {
    query = query.eq('estado', estado)
  }

  let { data, error } = await query
  // Compatibilidad con bases que aún no tienen la columna nueva. La
  // migración la agrega, pero el panel no debe quedar inutilizado durante el
  // despliegue gradual.
  if (error && /precio_usd/i.test(error.message || '')) {
    let legacyQuery = sb
      .from('transacciones_creditos')
      .select('id, user_id, tipo, monto, metodo_pago, estado, creado_en, comprobante_url')
      .eq('tipo', 'compra')
      .order('creado_en', { ascending: false })
      .limit(limit)
    if (estado && ['pendiente', 'aprobado', 'rechazado'].includes(estado)) {
      legacyQuery = legacyQuery.eq('estado', estado)
    }
    const legacy = await legacyQuery
    data = (legacy.data || []).map(item => ({ ...item, precio_usd: null }))
    error = legacy.error
  }
  if (error) {
    return NextResponse.json({ error: 'No se pudieron cargar las transacciones' }, { status: 500 })
  }

  return NextResponse.json({ transacciones: data || [] })
}
