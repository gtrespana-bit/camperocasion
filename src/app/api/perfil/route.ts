import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/require-auth'
import { sanitizeString } from '@/lib/validation'

const PROFILE_COLUMNS = [
  'id',
  'nombre',
  'telefono',
  'estado',
  'ciudad',
  'foto_perfil_url',
  'verificado',
  'nivel_confianza',
  'badges_automaticos',
  'ultima_actividad',
  'creado_en',
  'credito_balance',
  'emprendedor_dado',
].join(', ')

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

async function getOrCreateProfile(user: any) {
  const sb = getAdminClient()
  let { data: profile, error } = await sb
    .from('perfiles')
    .select(PROFILE_COLUMNS)
    .eq('id', user.id)
    .maybeSingle()

  if (!profile && !error) {
    const { data: created, error: createError } = await sb
      .from('perfiles')
      .insert({
        id: user.id,
        nombre: sanitizeString(user.user_metadata?.nombre || user.email?.split('@')[0] || 'Usuario', 100),
        telefono: sanitizeString(user.user_metadata?.telefono || '', 40),
        estado: sanitizeString(user.user_metadata?.estado || '', 50),
        ciudad: sanitizeString(user.user_metadata?.ciudad || '', 80),
      })
      .select(PROFILE_COLUMNS)
      .maybeSingle()

    profile = created
    error = createError
  }

  return { profile, error }
}

export async function GET(request: NextRequest) {
  const auth = await requireUser(request)
  if ('response' in auth) return auth.response

  try {
    const { profile, error } = await getOrCreateProfile(auth.user)
    if (error) {
      return NextResponse.json({ error: 'No se pudo cargar el perfil' }, { status: 500 })
    }
    return NextResponse.json({ profile: profile || null })
  } catch {
    return NextResponse.json({ error: 'No se pudo cargar el perfil' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser(request)
  if ('response' in auth) return auth.response

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const allowed = ['nombre', 'telefono', 'estado', 'ciudad'] as const
  const updates: Record<string, string> = {}
  for (const field of allowed) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'string') {
        return NextResponse.json({ error: `${field} inválido` }, { status: 400 })
      }
      updates[field] = sanitizeString(body[field], field === 'nombre' ? 100 : field === 'telefono' ? 40 : 80)
    }
  }

  if (updates.nombre !== undefined && updates.nombre.length < 2) {
    return NextResponse.json({ error: 'El nombre debe tener al menos 2 caracteres' }, { status: 400 })
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No hay campos para actualizar' }, { status: 400 })
  }

  try {
    const sb = getAdminClient()
    const { data: profile, error } = await sb
      .from('perfiles')
      .update(updates)
      .eq('id', auth.user.id)
      .select(PROFILE_COLUMNS)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'No se pudo guardar el perfil' }, { status: 500 })
    }
    return NextResponse.json({ profile: profile || null })
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar el perfil' }, { status: 500 })
  }
}
