/**
 * Util compartido para enviar push notifications a un usuario.
 * Se usa en los API routes del admin.
 */
import webpush from 'web-push'

function setupVapid() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (pub && priv) {
    webpush.setVapidDetails(`mailto:noreply@camperocasion.es`, pub, priv)
  }
}

export type PushPayload = {
  title: string
  body: string
  tag?: string
  icon?: string
  click_url?: string
  actions?: Array<{ action: string; title: string; icon?: string }>
}

/**
 * Enviar push notification a todas las subscriptions de un usuario.
 * Limpia automáticamente las subscriptions muertas (410).
 */
export async function notifyUser(
  supabaseAdmin: any,
  userId: string,
  payload: PushPayload,
) {
  setupVapid()

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .eq('user_id', userId)

  if (!subs?.length) return

  const deadSubs: string[] = []
  await Promise.all(subs.map(async (sub: any) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        JSON.stringify(payload),
      )
    } catch (e: any) {
      if (e.statusCode === 410) deadSubs.push(sub.endpoint)
    }
  }))

  if (deadSubs.length > 0) {
    await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', deadSubs)
  }
}
