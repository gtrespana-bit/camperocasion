import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sanitizeString } from '@/lib/validation'
import { requireAdmin } from '@/lib/require-auth'

/**
 * CRUD de categorías (administrativo).
 *
 * GET: listado con conteo de publicaciones.
 * POST: crear categoría.
 * PATCH: renombrar.
 * DELETE: solo si no tiene publicaciones asociadas.
 */
function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response

  const sb = getClient()
  const { data: categorias, error } = await sb
    .from('categorias')
    .select('id, nombre')
    .order('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const ids = (categorias || []).map((c) => c.id)
  const counts: Record<number, number> = {}
  if (ids.length) {
    const { data: productos, error: countError } = await sb
      .from('productos')
      .select('categoria_id')
      .in('categoria_id', ids)

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 })
    }
    ;(productos || []).forEach((p) => {
      if (p.categoria_id != null) counts[p.categoria_id] = (counts[p.categoria_id] || 0) + 1
    })
  }

  return NextResponse.json({
    ok: true,
    categorias: (categorias || []).map((c) => ({ ...c, count: counts[c.id] || 0 })),
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response

  const body = await request.json().catch(() => ({}))
  const nombre = sanitizeString(String(body.nombre || ''), 60).toLowerCase()
  if (!nombre || nombre.length < 2) {
    return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 })
  }

  const sb = getClient()
  const { data, error } = await sb.from('categorias').insert({ nombre }).select('id, nombre').maybeSingle()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'La categoría ya existe' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, categoria: data })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response

  const id = new URL(request.url).searchParams.get('id')
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }
  const body = await request.json().catch(() => ({}))
  const nombre = sanitizeString(String(body.nombre || ''), 60).toLowerCase()
  if (!nombre || nombre.length < 2) {
    return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 })
  }

  const sb = getClient()
  const { data, error } = await sb
    .from('categorias')
    .update({ nombre })
    .eq('id', id)
    .select('id, nombre')
    .maybeSingle()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'La categoría ya existe' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  return NextResponse.json({ ok: true, categoria: data })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response

  const id = new URL(request.url).searchParams.get('id')
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const sb = getClient()
  const { count } = await sb
    .from('productos')
    .select('id', { count: 'exact', head: true })
    .eq('categoria_id', id)

  if ((count || 0) > 0) {
    return NextResponse.json({ error: 'No se puede eliminar: la categoría tiene publicaciones' }, { status: 409 })
  }

  const { error } = await sb.from('categorias').delete().eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
