import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { notifyUser } from '@/lib/push-notify'
import { requireUUIDs } from '@/lib/validation'
import { requireAdmin } from '@/lib/require-auth'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const body = await request.json()
    const { productId, destacado } = body

    // Validar UUID
    const uuidCheck = requireUUIDs(body, ['productId'])
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    }
    if (destacado === undefined || typeof destacado !== 'boolean') {
      return NextResponse.json({ error: 'destacado debe ser boolean' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get product owner before updating
    const { data: product } = await supabaseAdmin
      .from('productos')
      .select('user_id, titulo, slug')
      .eq('id', productId)
      .single()

    const update: any = { destacado }
    if (destacado) {
      update.destacado_hasta = new Date(Date.now() + 48 * 3600000).toISOString()
    } else {
      update.destacado_hasta = null
    }

    const { error } = await supabaseAdmin
      .from('productos')
      .update(update)
      .eq('id', productId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Revalidate ISR cache to show/hide destacado immediately
    revalidatePath('/')
    revalidatePath('/catalogo')

    // Push notification to product owner
    if (product?.user_id && destacado) {
      await notifyUser(supabaseAdmin, product.user_id, {
        title: '⭐ Producto destacado',
        body: `"${product.titulo}" ahora está destacado y llegará a más compradores.`,
        tag: 'destacado',
        icon: '/icon-192.png',
        click_url: `/producto/${product.slug || productId}`,
      })
    }

    return NextResponse.json({ ok: true, update })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
