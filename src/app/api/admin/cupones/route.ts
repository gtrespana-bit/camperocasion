import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'
import { codigoValido, generarCodigo, normalizarCodigo } from '@/lib/cupones'
import { esPlanPago } from '@/lib/planes-anuncios'
import { leerAjustesPlanes, sbAdmin } from '@/lib/planes-servidor'
import { getStripe } from '@/lib/stripe'

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('response' in auth) return auth.response
  const sb = sbAdmin()
  const [{ data: cupones }, ajustes] = await Promise.all([
    sb.from('cupones').select('*').order('creado_en', { ascending: false }).limit(200),
    leerAjustesPlanes(sb),
  ])
  return NextResponse.json({ ok: true, cupones: cupones || [], ajustes })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('response' in auth) return auth.response
  const body = await req.json().catch(() => ({}))
  const sb = sbAdmin()

  if (body.ajustes) {
    const mes = body.ajustes.mesGratisActivo !== false
    const dias = Math.min(365, Math.max(1, Number(body.ajustes.diasGratis) || 30))
    await sb.from('plataforma_ajustes').upsert({
      clave: 'planes',
      valor: { mes_gratis_activo: mes, dias_gratis: dias },
      actualizado_en: new Date().toISOString(),
    })
    return NextResponse.json({ ok: true, ajustes: { mesGratisActivo: mes, diasGratis: dias } })
  }

  if (body.id && body.activo === false) {
    await sb.from('cupones').update({ activo: false }).eq('id', body.id)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req)
  if ('response' in auth) return auth.response
  const body = await req.json().catch(() => ({}))
  const tipo = body.tipo === 'descuento' ? 'descuento' : 'regalo_dias'
  let codigo = normalizarCodigo(String(body.codigo || generarCodigo()))
  if (!codigoValido(codigo)) {
    return NextResponse.json({ error: 'Código inválido (letras, números, guión; 3–32).' }, { status: 400 })
  }

  const fila: Record<string, unknown> = {
    codigo,
    tipo,
    activo: true,
    max_usos: body.maxUsos == null || body.maxUsos === '' ? null : Math.max(1, Number(body.maxUsos)),
    valido_desde: body.validoDesde || null,
    valido_hasta: body.validoHasta || null,
    notas: typeof body.notas === 'string' ? body.notas.slice(0, 500) : null,
  }

  if (tipo === 'regalo_dias') {
    const dias = Math.min(365, Math.max(1, Number(body.dias) || 30))
    const plan = esPlanPago(body.plan) ? body.plan : 'plus'
    fila.dias = dias
    fila.plan = plan
  } else {
    const porcentaje = Number(body.porcentaje)
    const meses = Math.min(24, Math.max(1, Number(body.mesesDescuento) || 1))
    if (!Number.isFinite(porcentaje) || porcentaje < 1 || porcentaje > 100) {
      return NextResponse.json({ error: 'Porcentaje 1–100' }, { status: 400 })
    }
    fila.porcentaje = porcentaje
    fila.meses_descuento = meses
    fila.plan = esPlanPago(body.plan) ? body.plan : null
    const stripe = getStripe()
    if (stripe) {
      try {
        const sc = await stripe.coupons.create({
          percent_off: porcentaje,
          duration: meses === 1 ? 'once' : 'repeating',
          ...(meses > 1 ? { duration_in_months: meses } : {}),
          name: codigo,
        })
        fila.stripe_coupon_id = sc.id
      } catch (e: any) {
        console.error('[admin/cupones] stripe', e?.message)
        return NextResponse.json({ error: 'No se pudo crear el cupón en Stripe: ' + (e?.message || '') }, { status: 502 })
      }
    }
  }

  const sb = sbAdmin()
  const { data, error } = await sb.from('cupones').insert(fila).select().maybeSingle()
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      return NextResponse.json({ error: 'Ese código ya existe' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, cupon: data })
}
