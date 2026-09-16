import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'

/**
 * Listado de publicaciones para el panel admin (todas, sin RLS).
 *
 * La política de SELECT de `productos` solo expone al cliente los productos
 * activos (`activo = true`) más los propios, por lo que el panel no vería
 * pausadas, vendidas ni rechazadas. Aquí se leen todas con service_role.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data, error } = await sb
      .from('productos')
      .select(
        'id, slug, user_id, titulo, descripcion, precio_usd, categoria_id, subcategoria, marca, estado, ubicacion_estado, ubicacion_ciudad, imagen_url, imagenes, metodos_contacto, activo, vendido, vendido_en, comprador_id, estado_moderacion, motivo_moderacion, destacado, destacado_hasta, boosteado_en, visitas, creado_en, actualizado_en',
      )
      .order('creado_en', { ascending: false })
      .limit(1000)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, productos: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
