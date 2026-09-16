/**
 * Push notifications helper para la PWA de CamperOcasión.
 * Funciones del lado del servidor para enviar push notifications
 * usando web-push + guardar/borrar subscriptions en Supabase.
 */

import webpush from 'web-push'

// ── VAPID ──────────────────────────────────────────

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || ''

export function isPushConfigured(): boolean {
  return !!(VAPID_PUBLIC && VAPID_PRIVATE && process.env.NEXT_PUBLIC_URL)
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC
}

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    `mailto:noreply@camperocasion.es`,
    VAPID_PUBLIC,
    VAPID_PRIVATE,
  )
}

// ── Enviar push a UNA subscripcion ────────────────

export async function sendPush(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload,
) {
  const data = {
    ...payload,
    timestamp: Date.now(),
  }

  try {
    await webpush.sendNotification(
      subscription as webpush.PushSubscription,
      JSON.stringify(data),
    )
    return true
  } catch (e: any) {
    // Subscription no longer valid (expired, revoked)
    if (e.statusCode === 410) return false
    console.error('Push failed:', e.statusCode, e.message)
    return false
  }
}

// ── Enviar push a TODAS las subscripciones de un usuario ─

export async function sendPushToUser(
  userSubscriptions: Array<{ endpoint: string; p256dh: string; auth_key: string }>,
  payload: PushPayload,
  supabaseAdmin?: any, // Supabase admin client (optional, for cleanup)
) {
  const deadSubscriptions: string[] = []

  for (const sub of userSubscriptions) {
    const webpushSub = {
      endpoint: sub.endpoint,
      keys: { p256dh: sub.p256dh, auth: sub.auth_key },
    }
    const alive = await sendPush(webpushSub, payload)
    if (!alive) {
      deadSubscriptions.push(sub.endpoint)
    }
  }

  // Limpiar subscriptions muertas si tenemos acceso a la DB
  if (supabaseAdmin && deadSubscriptions.length > 0) {
    await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .in('endpoint', deadSubscriptions)
  }

  return userSubscriptions.length > deadSubscriptions.length
}

// ── Tipos ──────────────────────────────────────────

export type PushPayload = {
  title: string
  body: string
  tag?: string
  icon?: string
  badge?: string
  click_url?: string
  actions?: Array<{ action: string; title: string; icon?: string }>
}

