import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireUUIDs } from '@/lib/validation'
import { requireAdmin } from '@/lib/require-auth'

/**
 * Ajusta créditos de un usuario (sumar o descontar).
 *
 * - "sumar" usa el RPC atómico `agregar_creditos_admin`.
 * - "restar" valida balance suficiente y registra una transacción de tipo
 *   `admin_manual` con monto negativo (ledger auditables).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const body = await request.json()
    const uuidCheck = requireUUIDs(body, ['userId'])
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error }, { status: 400 })
    }

    const cantidad = Number(body.cantidad)
    const tipo = body.tipo === 'restar' ? 'restar' : 'sumar'
    const motivo = body.motivo ? String(body.motivo).slice(0, 500) : (tipo === 'sumar' ? 'Ajuste admin' : 'Descuento admin')

    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 10000) {
      return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 })
    }

    if (tipo !== 'sumar' && tipo !== 'restar') {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    if (tipo === 'sumar') {
      const { data: result, error } = await sb.rpc('agregar_creditos_admin', {
        p_user_id: body.userId,
        p_cantidad: cantidad,
        p_motivo: motivo,
      })
      if (error || !result?.ok) {
        return NextResponse.json({ error: result?.error || error?.message || 'No se pudieron agregar créditos' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, nuevoBalance: result.nuevoBalance, tipo })
    }

    // restar
    const { data: perfil, error: perfilError } = await sb
      .from('perfiles')
      .select('credito_balance')
      .eq('id', body.userId)
      .maybeSingle()

    if (perfilError || !perfil) {
      return NextResponse.json({ error: perfilError?.message || 'Perfil no encontrado' }, { status: 404 })
    }

    const balanceActual = Number(perfil.credito_balance || 0)
    const nuevoBalance = balanceActual - cantidad
    if (nuevoBalance < 0) {
      return NextResponse.json({ error: `Balance insuficiente (${balanceActual})` }, { status: 409 })
    }

    const { error: updateError } = await sb
      .from('perfiles')
      .update({ credito_balance: nuevoBalance })
      .eq('id', body.userId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const { error: txError } = await sb.from('transacciones_creditos').insert({
      user_id: body.userId,
      tipo: 'admin_manual',
      monto: -cantidad,
      estado: 'aprobado',
      motivo_registro: motivo,
    })

    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, nuevoBalance, tipo })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
