import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireUser } from '@/lib/require-auth'
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit'
import { isValidUUID, validateConversationData } from '@/lib/validation'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireUser(req)
    if ('response' in auth) return auth.response
    const uid = auth.user.id
    const ip = getClientIp(req)
    const limit = await checkRateLimit('conversacion:create', uid, { ip })
    if (!limit.ok) return rateLimitResponse(limit.resetIn)

    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const { vendedorId, productoId, otroUsuarioId } = body
    const validation = validateConversationData({ vendedorId, productoId })
    if (!validation.valid || !isValidUUID(vendedorId) || !isValidUUID(productoId)) {
      return NextResponse.json({ error: validation.error || 'IDs inválidos' }, { status: 400 })
    }
    if (otroUsuarioId !== undefined && !isValidUUID(otroUsuarioId)) {
      return NextResponse.json({ error: 'Usuario de conversación inválido' }, { status: 400 })
    }
    const otroId = otroUsuarioId || vendedorId
    if (otroId === uid) {
      return NextResponse.json({ error: 'No puedes iniciar conversación contigo mismo' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    const { data: product, error: productError } = await supabaseAdmin
      .from('productos')
      .select('user_id, activo, estado_moderacion')
      .eq('id', productoId)
      .maybeSingle()

    if (productError || !product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }
    if (product.user_id !== vendedorId) {
      return NextResponse.json({ error: 'El vendedor no corresponde al producto' }, { status: 400 })
    }
    if (otroUsuarioId && uid !== product.user_id) {
      return NextResponse.json({ error: 'Solo el dueño puede elegir otro participante' }, { status: 403 })
    }
    if (product.estado_moderacion === 'rechazado') {
      return NextResponse.json({ error: 'Este producto no está disponible' }, { status: 410 })
    }
    // Un vendedor puede notificar al comprador después de marcar la venta,
    // pero un comprador no puede abrir conversaciones sobre productos ocultos.
    if (!product.activo && uid !== product.user_id) {
      return NextResponse.json({ error: 'Este producto ya no está disponible' }, { status: 410 })
    }

    const u1 = uid < otroId ? uid : otroId
    const u2 = uid < otroId ? otroId : uid

    const { data: existing } = await supabaseAdmin
      .from('conversaciones')
      .select('id, user1_id, user2_id, producto_id')
      .eq('user1_id', u1)
      .eq('user2_id', u2)
      .eq('producto_id', productoId)
      .maybeSingle()

    if (existing) return NextResponse.json(existing)
    if (otroUsuarioId && uid === product.user_id) {
      return NextResponse.json({ error: 'No existe una conversación previa con ese usuario' }, { status: 403 })
    }

    const { data: newConv, error } = await supabaseAdmin
      .from('conversaciones')
      .insert({ user1_id: u1, user2_id: u2, producto_id: productoId })
      .select('id, user1_id, user2_id, producto_id')
      .maybeSingle()

    if (!error && newConv) return NextResponse.json(newConv)

    // Otra petición pudo ganar la carrera contra el índice único.
    const { data: raced } = await supabaseAdmin
      .from('conversaciones')
      .select('id, user1_id, user2_id, producto_id')
      .eq('user1_id', u1)
      .eq('user2_id', u2)
      .eq('producto_id', productoId)
      .maybeSingle()

    if (raced) return NextResponse.json(raced)
    return NextResponse.json({ error: 'No se pudo crear la conversación' }, { status: 500 })
  } catch {
    return NextResponse.json({ error: 'Error creando conversación' }, { status: 500 })
  }
}
