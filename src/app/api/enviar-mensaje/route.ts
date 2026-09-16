import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { createClient } from '@supabase/supabase-js'
import { validateMessageData, sanitizeString } from '@/lib/validation'
import { requireUser } from '@/lib/require-auth'
import { notifyUser } from '@/lib/push-notify'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req)
    if ('response' in auth) return auth.response
    const remitente_id = auth.user.id

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }
    const { conversacion_id, destinatario_id, contenido } = body

    const validation = validateMessageData({ conversacion_id, remitente_id, destinatario_id, contenido })
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const contenidoSanitizado = sanitizeString(contenido, 5000)
    if (!contenidoSanitizado) {
      return NextResponse.json({ error: 'Contenido requerido' }, { status: 400 })
    }

    const rl = await checkRateLimit('mensaje:create', remitente_id, { ip: getClientIp(req) })
    if (!rl.ok) {
      return NextResponse.json({
        error: `Demasiados mensajes. Espera ${Math.ceil(rl.resetIn / 60000)} min`,
        resetIn: rl.resetIn,
      }, { status: 429 })
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data: conv, error: convError } = await sb
      .from('conversaciones')
      .select('user1_id, user2_id')
      .eq('id', conversacion_id)
      .maybeSingle()

    if (convError || !conv) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }
    if (conv.user1_id !== remitente_id && conv.user2_id !== remitente_id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const destinatarioEsperado = conv.user1_id === remitente_id ? conv.user2_id : conv.user1_id
    if (destinatario_id !== destinatarioEsperado) {
      return NextResponse.json({ error: 'El destinatario no pertenece a la conversación' }, { status: 400 })
    }

    const { data, error } = await sb.from('mensajes').insert({
      conversacion_id,
      remitente_id,
      destinatario_id,
      contenido: contenidoSanitizado,
    }).select().single()

    if (error) return NextResponse.json({ error: 'No se pudo enviar el mensaje' }, { status: 500 })

    try {
      const { data: sender } = await sb
        .from('perfiles')
        .select('nombre')
        .eq('id', remitente_id)
        .maybeSingle()
      const title = `💬 ${sender?.nombre || 'Alguien'} te escribió`
      const preview = contenidoSanitizado.slice(0, 100)
      await sb.from('notificaciones_push').insert({
        target_user_id: destinatario_id,
        tipo: 'mensaje',
        titulo: title,
        cuerpo: preview || 'Nuevo mensaje',
        click_url: '/chat',
      })
      await notifyUser(sb, destinatario_id, {
        title,
        body: preview || 'Nuevo mensaje',
        tag: `chat-${conversacion_id.slice(0, 8)}`,
        icon: '/icon-192.png',
        click_url: `/chat?conversation=${conversacion_id}`,
      })
    } catch {
      // La notificación es secundaria; el mensaje ya fue guardado.
    }

    return NextResponse.json({ ok: true, data })
  } catch {
    return NextResponse.json({ error: 'Error enviando mensaje' }, { status: 500 })
  }
}
