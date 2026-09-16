import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/require-auth'
import { requireUUIDs } from '@/lib/validation'

export async function POST(req: NextRequest) {
  // Solo el propio destinatario puede marcar sus mensajes como leídos.
  // Antes cualquiera podía marcar (o consultar el count de) mensajes ajenos.
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response
  const destinatario_id = auth.user.id

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const uuidCheck = requireUUIDs(body, ['conversacion_id'])
  if (!uuidCheck.valid) {
    return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
  }
  const conversacion_id = body.conversacion_id

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: conv, error: convError } = await sb
    .from('conversaciones')
    .select('user1_id, user2_id')
    .eq('id', conversacion_id)
    .maybeSingle()
  if (convError || !conv) {
    return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  }
  if (conv.user1_id !== destinatario_id && conv.user2_id !== destinatario_id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // Contar primero
  const { count } = await sb
    .from('mensajes')
    .select('id', { count: 'exact', head: true })
    .eq('conversacion_id', conversacion_id)
    .eq('destinatario_id', destinatario_id)
    .eq('leido', false)

  // Marcar como leidos
  const { error } = await sb
    .from('mensajes')
    .update({ leido: true })
    .eq('conversacion_id', conversacion_id)
    .eq('destinatario_id', destinatario_id)
    .eq('leido', false)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ affected: count })
}
