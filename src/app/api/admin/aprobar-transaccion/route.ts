import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'
import { requireUUIDs } from '@/lib/validation'

/**
 * Aprueba una compra de créditos pendiente.
 *
 * Antes el cliente llamaba `supabase.rpc('aprobar_transaccion', ...)` con el
 * JWT del navegador, pero esa función exige `public.is_admin()` y falla si la
 * tabla `public.admins` no está sincronizada con ADMIN_EMAILS. Aquí se ejecuta
 * con service_role (que la RPC permite explícitamente).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const body = await request.json()
    const uuidCheck = requireUUIDs(body, ['transactionId'])
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data, error } = await sb.rpc('aprobar_transaccion', {
      p_transaccion_id: body.transactionId,
      p_admin_id: (auth as any).user?.id || null,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // La RPC devuelve { ok, error, ... } en jsonb.
    if (data && typeof data === 'object' && 'ok' in data && data.ok === false) {
      return NextResponse.json({ error: data.error || 'No se pudo aprobar' }, { status: 400 })
    }

    return NextResponse.json({ ok: true, data: data || null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
