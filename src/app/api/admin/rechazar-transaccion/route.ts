import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/require-auth'
import { requireUUIDs } from '@/lib/validation'

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const uuidCheck = requireUUIDs(body, ['transactionId'])
  if (!uuidCheck.valid) {
    return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data, error } = await sb
    .from('transacciones_creditos')
    .update({ estado: 'rechazado' })
    .eq('id', body.transactionId)
    .eq('estado', 'pendiente')
    .eq('tipo', 'compra')
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'No se pudo rechazar la transacción' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'La transacción no está pendiente o no existe' }, { status: 409 })
  }

  return NextResponse.json({ ok: true })
}
