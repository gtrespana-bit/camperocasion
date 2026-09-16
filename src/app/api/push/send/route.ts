import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { requireAdmin } from '@/lib/require-auth'

// VAPID setup
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:noreply@camperocasion.online',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

export async function POST(req: NextRequest) {
  try {
    // Solo admin: antes cualquiera podía enviar push a cualquier usuario
    // (spam / phishing disfrazado de CamperOcasión).
    const auth = await requireAdmin(req)
    if ('response' in auth) return auth.response

    const ip = getClientIp(req)
    const limit = await checkRateLimit('notificacion:send', auth.user.id, { ip })
    if (!limit.ok) return rateLimitResponse(limit.resetIn)
    const { targetUserId, titulo, cuerpo, click_url } = await req.json()

    if (!targetUserId || !titulo) {
      return NextResponse.json({ error: 'targetUserId y titulo son requeridos' }, { status: 400 })
    }

    // Verificar config
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Config missing' }, { status: 503 })
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Obtener subscriptions del usuario
    const { data: subs } = await sb
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth_key')
      .eq('user_id', targetUserId)

    if (!subs?.length) {
      return NextResponse.json({ sent: 0, reason: 'no subscriptions' })
    }

    const payload = {
      title: titulo,
      body: cuerpo || titulo,
      tag: `msg-${targetUserId.slice(0, 8)}`,
      icon: '/icon-192.png',
      click_url: click_url || '/chat',
    }

    const deadSubs: string[] = []

    await Promise.all(subs.map(async (sub: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          JSON.stringify(payload),
        )
      } catch (e: any) {
        if (e.statusCode === 410) deadSubs.push(sub.endpoint)
        console.error('Push send error:', e.statusCode, e.message)
      }
    }))

    // Limpieza de subscriptions muertas
    if (deadSubs.length > 0) {
      await sb.from('push_subscriptions').delete().in('endpoint', deadSubs)
    }

    return NextResponse.json({ sent: subs.length - deadSubs.length })
  } catch (e: any) {
    console.error('push/send error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
