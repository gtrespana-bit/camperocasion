import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/require-auth'
import { requireUUIDs } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const auth = await requireUser(request)
  if ('response' in auth) return auth.response

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const check = requireUUIDs(body, ['conversacionId'])
  if (!check.valid) return NextResponse.json({ error: check.error }, { status: 400 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { data: conv, error: convError } = await sb
    .from('conversaciones')
    .select('user1_id, user2_id')
    .eq('id', body.conversacionId)
    .maybeSingle()

  if (convError || !conv) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  if (conv.user1_id !== auth.user.id && conv.user2_id !== auth.user.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { error } = await sb.from('conversaciones').delete().eq('id', body.conversacionId)
  if (error) return NextResponse.json({ error: 'No se pudo eliminar la conversación' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
