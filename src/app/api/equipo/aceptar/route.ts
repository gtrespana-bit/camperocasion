/**
 * POST /api/equipo/aceptar — un comercial acepta la invitación de una cuenta
 * Unlimited Flota.
 *
 * El email de la sesión debe coincidir con el invitado. Además se rechazan:
 *  · cuentas con su propia suscripción de pago (pagarían dos veces por lo
 *    mismo: primero deben darse de baja);
 *  · titulares que ya tienen comerciales a su cargo (un usuario no puede
 *    estar en dos equipos).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { estadoPlanUsuario, sbAdmin } from '@/lib/planes-servidor'
import {
  aceptarInvitacion,
  listarEquipo,
  ocupaAsiento,
  resolverCuenta,
} from '@/lib/equipo'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const token = String(body?.token || '').trim()
  if (!token) return NextResponse.json({ ok: false, error: 'Falta la invitación.' }, { status: 400 })

  const userId = auth.user.id as string
  const cuenta = await resolverCuenta(userId)
  if (!cuenta.esTitular) {
    return NextResponse.json(
      { ok: false, error: 'Ya formas parte de un equipo. Sal de él antes de aceptar otra invitación.' },
      { status: 409 },
    )
  }

  const estado = await estadoPlanUsuario(userId)
  if (estado.suscripcionStripe && estado.planPagoVigente) {
    return NextResponse.json(
      {
        ok: false,
        codigo: 'SUSCRIPCION',
        error:
          'Tu cuenta tiene una suscripción de pago activa. Cancélala antes de unirte a un equipo, o usa otra cuenta: el pack del equipo ya cubre tus anuncios.',
      },
      { status: 409 },
    )
  }

  const propios = await listarEquipo(userId)
  if (propios.some((m) => ocupaAsiento(m.estado))) {
    return NextResponse.json(
      {
        ok: false,
        codigo: 'TITULAR',
        error:
          'Tu cuenta tiene comerciales a su cargo. Revócalos antes de unirte a otro equipo: una cuenta no puede estar en los dos lados.',
      },
      { status: 409 },
    )
  }

  const resultado = await aceptarInvitacion({
    token,
    userId,
    email: auth.user.email,
  })
  if (!resultado.ok) {
    const status = resultado.codigo === 'EMAIL' || resultado.codigo === 'YA_USADA' ? 409 : 400
    return NextResponse.json({ ok: false, codigo: resultado.codigo, error: resultado.error }, { status })
  }

  // Un comercial publica como profesional: la identidad es gratis y así sus
  // anuncios llevan el sello y el escaparate del equipo.
  try {
    const sb = sbAdmin()
    await sb
      .from('perfiles')
      .update({ tipo_vendedor: 'profesional' })
      .eq('id', userId)
      .eq('tipo_vendedor', 'particular')
  } catch {
    /* el alta ya está hecha; el tipo se puede cambiar en el perfil */
  }

  return NextResponse.json({
    ok: true,
    titularId: resultado.titularId,
    rol: resultado.rol,
    siguiente: '/dashboard?tab=equipo',
  })
}
