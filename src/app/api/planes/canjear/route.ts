import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { cuponAplicable, normalizarCodigo, planRegalo } from '@/lib/cupones'
import { esProfesional } from '@/lib/planes-anuncios'
import { aplicarPlanPerfil, sbAdmin } from '@/lib/planes-servidor'

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const codigo = normalizarCodigo(String(body?.codigo || ''))
  if (!codigo) return NextResponse.json({ error: 'Escribe el código' }, { status: 400 })

  const sb = sbAdmin()
  const { data: perfil } = await sb
    .from('perfiles')
    .select('id, tipo_vendedor')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (!esProfesional(perfil?.tipo_vendedor)) {
    return NextResponse.json(
      { error: 'Los cupones de pack son para cuentas profesionales o de camperizador. Cambia tu tipo en el panel.' },
      { status: 400 },
    )
  }

  const { data: cupon } = await sb.from('cupones').select('*').eq('codigo', codigo).maybeSingle()
  if (!cupon) return NextResponse.json({ error: 'Cupón no encontrado' }, { status: 404 })
  const ok = cuponAplicable(cupon)
  if (!ok.ok) return NextResponse.json({ error: ok.error }, { status: 400 })
  if (cupon.tipo !== 'regalo_dias') {
    return NextResponse.json(
      { error: 'Este cupón es de descuento: úsalo al contratar el pack con Stripe.' },
      { status: 400 },
    )
  }

  const { data: ya } = await sb
    .from('cupones_usos')
    .select('id')
    .eq('cupon_id', cupon.id)
    .eq('user_id', auth.user.id)
    .maybeSingle()
  if (ya) return NextResponse.json({ error: 'Ya has usado este cupón.' }, { status: 400 })

  const plan = planRegalo(cupon)
  const hasta = new Date(Date.now() + Number(cupon.dias) * 86400000).toISOString()

  const { error: usoErr } = await sb.from('cupones_usos').insert({ cupon_id: cupon.id, user_id: auth.user.id })
  if (usoErr) return NextResponse.json({ error: 'No se pudo registrar el uso' }, { status: 500 })
  await sb.from('cupones').update({ usos: (cupon.usos || 0) + 1 }).eq('id', cupon.id)
  await aplicarPlanPerfil(auth.user.id, { plan, hasta })

  return NextResponse.json({ ok: true, plan, hasta, dias: cupon.dias })
}
