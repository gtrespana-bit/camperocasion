import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/require-auth'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if ('response' in auth) return auth.response

    const { searchParams } = new URL(req.url)
    const tabla = searchParams.get('tabla')
    const usuario = searchParams.get('usuario')
    const operacion = searchParams.get('operacion')
    const limite = parseInt(searchParams.get('limite') || '50')
    const dias = parseInt(searchParams.get('dias') || '30')

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let query = sb
      .from('auditoria')
      .select('*')
      .gte('fecha_registro', new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString())
      .order('fecha_registro', { ascending: false })
      .limit(limite)

    if (tabla) {
      query = query.eq('tabla_afectada', tabla)
    }

    if (usuario) {
      query = query.eq('usuario_id', usuario)
    }

    if (operacion) {
      query = query.eq('operacion', operacion)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching auditoria:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      data,
      total: data?.length || 0,
      filtros: { tabla, usuario, operacion, dias }
    })
  } catch (e: any) {
    console.error('Error en auditoria:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
