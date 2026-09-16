import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { notifyUser } from '@/lib/push-notify'
import { requireUUIDs } from '@/lib/validation'
import { requireAdmin } from '@/lib/require-auth'

export async function POST(request: NextRequest) {
  try {
    // Solo admin: verificar sesión real del servidor antes de tocar créditos
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const body = await request.json()
    const { userId, cantidad, motivo } = body

    // Validar UUID
    const uuidCheck = requireUUIDs(body, ['userId'])
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    }

    const cantidadNum = Number(cantidad)
    if (!Number.isInteger(cantidadNum) || cantidadNum < 1 || cantidadNum > 10000) {
      return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    // Operación atómica: balance e histórico se escriben en una sola
    // transacción dentro de PostgreSQL.
    const { data: result, error } = await supabaseAdmin.rpc('agregar_creditos_admin', {
      p_user_id: userId,
      p_cantidad: cantidadNum,
      p_motivo: motivo || 'Manual admin',
    })
    if (error || !result?.ok) {
      return NextResponse.json({ error: result?.error || error?.message || 'No se pudieron agregar créditos' }, { status: 500 })
    }

    const nuevoBalance = result.nuevoBalance

    // Push notification: créditos recibidos
    await notifyUser(supabaseAdmin, userId, {
      title: '💰 Créditos recibidos',
      body: `Recibiste ${cantidadNum} ${cantidadNum === 1 ? 'crédito' : 'créditos'} en tu cuenta CamperOcasión. Nuevo balance: ${nuevoBalance}.`,
      tag: 'creditos',
      icon: '/icon-192.png',
      click_url: '/creditos',
    })

    return NextResponse.json({ ok: true, nuevoBalance })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
