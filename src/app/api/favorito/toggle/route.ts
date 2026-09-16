/**
 * POST /api/favorito/toggle
 * - Add/remove favorito en Supabase
 * - Si es un nuevo favorito, envía push notification al dueño del producto
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'

// VAPID setup
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:noreply@camperocasion.es`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
}

export async function POST(req: NextRequest) {
  try {
    const { productId, isFavorited, productoTitle } = await req.json()

    if (!productId) {
      return NextResponse.json({ error: 'productId requerido' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Get current user
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }
    const ip = getClientIp(req)
    const limit = await checkRateLimit('favorito:toggle', user.id, { ip })
    if (!limit.ok) return rateLimitResponse(limit.resetIn)

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    if (isFavorited) {
      // Remove favorito
      await supabaseAdmin
        .from('favoritos')
        .delete()
        .eq('user_id', user.id)
        .eq('producto_id', productId)

      return NextResponse.json({ ok: true, action: 'removed' })
    }

    // Add favorito
    const { error: insertError } = await supabaseAdmin
      .from('favoritos')
      .insert({ user_id: user.id, producto_id: productId })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // --- Push notification al dueño del producto ---
    // Get product owner
    const { data: product } = await supabaseAdmin
      .from('productos')
      .select('user_id, titulo, slug')
      .eq('id', productId)
      .single()

    if (product?.user_id) {
      // Get push subscriptions del dueño
      const { data: subs } = await supabaseAdmin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth_key')
        .eq('user_id', product.user_id)

      if (subs?.length) {
        const payload = JSON.stringify({
          title: '❤️ Producto guardado',
          body: `A alguien le gustó "${productoTitle || product.titulo}"`,
          tag: `fav-${productId.slice(0, 8)}`,
          icon: '/icon-192.png',
          click_url: `/producto/${product.slug || productId}`,
        })

        const deadSubs: string[] = []
        await Promise.all(subs.map(async (sub: any) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
              payload,
            )
          } catch (e: any) {
            if (e.statusCode === 410) deadSubs.push(sub.endpoint)
          }
        }))

        // Limpiar dead subs
        if (deadSubs.length > 0) {
          await supabaseAdmin
            .from('push_subscriptions')
            .delete()
            .in('endpoint', deadSubs)
        }
      }
    }

    return NextResponse.json({ ok: true, action: 'added' })
  } catch (e: any) {
    console.error('[favorito/toggle] Error:', e.message)
    return NextResponse.json({ error: 'Internal error: ' + e.message }, { status: 500 })
  }
}
