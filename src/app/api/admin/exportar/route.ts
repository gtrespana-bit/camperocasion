import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'

/**
 * Exportación de datos del admin (productos, reseñas, verificaciones y
 * denuncias). Se lee con service_role para no perder filas por RLS ni fallar
 * por restricciones de columnas.
 */

const DATASETS = ['productos', 'resenas', 'solicitudes', 'denuncias'] as const
type Dataset = (typeof DATASETS)[number]

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const body = await request.json()
    const dataset = body?.dataset as Dataset
    if (!DATASETS.includes(dataset)) {
      return NextResponse.json({ error: 'dataset inválido' }, { status: 400 })
    }

    // `since` opcional: ISO date string para filtrar por fecha de registro.
    const since = typeof body?.since === 'string' && body.since ? body.since : null

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    let query: any
    switch (dataset) {
      case 'productos':
        query = sb
          .from('productos')
          .select('id, slug, user_id, titulo, descripcion, precio_usd, categoria_id, subcategoria, marca, estado, ubicacion_estado, ubicacion_ciudad, imagen_url, activo, vendido, estado_moderacion, motivo_moderacion, destacado, boosteado_en, visitas, creado_en')
          .order('creado_en', { ascending: false })
          .limit(5000)
        break
      case 'resenas':
        query = sb
          .from('resenas')
          .select('id, producto_id, vendedor_id, comprador_id, puntuacion, comentario, creado_en')
          .order('creado_en', { ascending: false })
          .limit(5000)
        break
      case 'solicitudes':
        query = sb
          .from('solicitudes_verificacion')
          .select('id, user_id, estado, pago_movil_telefono, pago_movil_cedula, pago_movil_banco, rechazo_motivo, creada_en, revisada_en')
          .order('creada_en', { ascending: false })
          .limit(5000)
        break
      case 'denuncias':
        query = sb
          .from('denuncias')
          .select('id, producto_id, reportante_id, motivo, descripcion, estado, creada_en')
          .order('creada_en', { ascending: false })
          .limit(5000)
        break
    }

    if (since) {
      query = query.gte('creada_en', since)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, rows: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
