/**
 * GET  /api/busquedas-guardadas  → lista las búsquedas del usuario
 * POST /api/busquedas-guardadas  → guarda la búsqueda actual (dedupe)
 * DELETE /api/busquedas-guardadas?id=… → elimina una búsqueda propia
 *
 * "Avísame cuando aparezca": el comprador guarda los filtros activos
 * de /buscar y el cron (/api/cron/busquedas) le notifica cuando haya
 * publicaciones nuevas que coincidan.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function getUser(req: NextRequest) {
  const admin = getAdmin()
  const authHeader = req.headers.get('authorization')
  if (!admin || !authHeader) return { admin, user: null }
  const { data: { user } } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
  return { admin, user: user || null }
}

export async function GET(req: NextRequest) {
  const { admin, user } = await getUser(req)
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await admin
    .from('busquedas_guardadas')
    .select('id, q, categoria, subcategoria, marca, condicion, ubicacion_estado, ubicacion_ciudad, precio_min, precio_max, creada_en')
    .eq('user_id', user.id)
    .order('creada_en', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ busquedas: data || [] })
}

export async function POST(req: NextRequest) {
  const { admin, user } = await getUser(req)
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const limpiar = (v: unknown) => {
    const s = typeof v === 'string' ? v.trim() : ''
    return s || null
  }
  const row = {
    user_id: user.id,
    q: limpiar(body.q),
    categoria: limpiar(body.categoria),
    subcategoria: limpiar(body.subcategoria),
    marca: limpiar(body.marca),
    condicion: limpiar(body.condicion),
    ubicacion_estado: limpiar(body.ubicacion_estado),
    ubicacion_ciudad: limpiar(body.ubicacion_ciudad),
    precio_min: body.precio_min ? Number(body.precio_min) : null,
    precio_max: body.precio_max ? Number(body.precio_max) : null,
  }

  if (!row.q && !row.categoria && !row.subcategoria && !row.marca && !row.ubicacion_estado && !row.ubicacion_ciudad) {
    return NextResponse.json({ error: 'La búsqueda no tiene filtros para guardar' }, { status: 400 })
  }

  // Dedupe: misma combinación ya guardada → devolver la existente
  const { data: existente } = await admin
    .from('busquedas_guardadas')
    .select('id')
    .eq('user_id', user.id)
    .eq('q', row.q)
    .eq('categoria', row.categoria)
    .eq('subcategoria', row.subcategoria)
    .eq('marca', row.marca)
    .eq('ubicacion_ciudad', row.ubicacion_ciudad)
    .eq('ubicacion_estado', row.ubicacion_estado)
    .maybeSingle()

  if (existente) {
    return NextResponse.json({ ok: true, id: existente.id, duplicated: true })
  }

  const { data, error } = await admin
    .from('busquedas_guardadas')
    .insert(row)
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}

export async function DELETE(req: NextRequest) {
  const { admin, user } = await getUser(req)
  if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const { error } = await admin
    .from('busquedas_guardadas')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
