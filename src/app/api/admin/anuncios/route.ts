import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sanitizeString } from '@/lib/validation'
import { requireAdmin } from '@/lib/require-auth'

/**
 * CRUD de anuncios globales del sitio (banner público).
 *
 * La tabla `anuncios_globales` se crea con la migración
 * supabase/migrations/202608010007_anuncios_globales.sql. Si la tabla no
 * existe todavía, la API devuelve un error legible que el panel muestra.
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
  const { data, error } = await sb
    .from('anuncios_globales')
    .select('*')
    .order('creado_en', { ascending: false })

  if (error) {
    return NextResponse.json({ error: `La tabla anuncios_globales no está disponible: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, anuncios: data || [] })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response

  const body = await request.json().catch(() => ({}))
  const titulo = sanitizeString(String(body.titulo || ''), 120)
  const mensaje = sanitizeString(String(body.mensaje || ''), 500)
  const emoji = sanitizeString(String(body.emoji || '📢'), 8)
  const enlace = body.enlace ? sanitizeString(String(body.enlace), 500) : null
  const enlace_texto = body.enlace_texto ? sanitizeString(String(body.enlace_texto), 80) : null
  const expira_en = body.expira_en && !Number.isNaN(new Date(body.expira_en).getTime()) ? new Date(body.expira_en).toISOString() : null
  const activo = body.activo !== false

  if (!titulo || !mensaje) {
    return NextResponse.json({ error: 'Título y mensaje son obligatorios' }, { status: 400 })
  }

  const sb = getClient()
  const { data, error } = await sb
    .from('anuncios_globales')
    .insert({ titulo, mensaje, emoji, enlace, enlace_texto, expira_en, activo })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: `No se pudo guardar el anuncio: ${error.message}` }, { status: error.code === '42P01' ? 501 : 500 })
  }

  return NextResponse.json({ ok: true, anuncio: data })
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const update: Record<string, any> = {}
  if (body.titulo !== undefined) update.titulo = sanitizeString(String(body.titulo), 120)
  if (body.mensaje !== undefined) update.mensaje = sanitizeString(String(body.mensaje), 500)
  if (body.emoji !== undefined) update.emoji = sanitizeString(String(body.emoji), 8)
  if (body.enlace !== undefined) update.enlace = body.enlace ? sanitizeString(String(body.enlace), 500) : null
  if (body.enlace_texto !== undefined) update.enlace_texto = body.enlace_texto ? sanitizeString(String(body.enlace_texto), 80) : null
  if (body.expira_en !== undefined) update.expira_en = body.expira_en && !Number.isNaN(new Date(body.expira_en).getTime()) ? new Date(body.expira_en).toISOString() : null
  if (body.activo !== undefined) update.activo = body.activo === true
  if (body.titulo !== undefined && !update.titulo) return NextResponse.json({ error: 'Título no puede quedar vacío' }, { status: 400 })
  if (body.mensaje !== undefined && !update.mensaje) return NextResponse.json({ error: 'Mensaje no puede quedar vacío' }, { status: 400 })

  const sb = getClient()
  const { data, error } = await sb
    .from('anuncios_globales')
    .update(update)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  return NextResponse.json({ ok: true, anuncio: data })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response

  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 })

  const sb = getClient()
  const { error } = await sb.from('anuncios_globales').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
