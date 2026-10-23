/**
 * GET/POST/PATCH/DELETE /api/equipo — comerciales de una cuenta Flota.
 *
 * El titular paga una cuota y reparte trabajo. Las reglas que no se negocian:
 *  · Solo `unlimited` (Flota) puede tener equipo, y solo el titular invita.
 *  · El email se verifica al aceptar: el enlace no basta, hay que entrar con
 *    la cuenta invitada.
 *  · Un comercial no ve los tokens de sus compañeros ni puede revocar.
 *  · El cupo y el plan no cambian de dueño: siguen siendo del titular.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { estadoPlanUsuario } from '@/lib/planes-servidor'
import { sbAdmin } from '@/lib/sb-admin'
import {
  ETIQUETA_ROL,
  MIEMBROS_MAX,
  cambiarRol,
  listarEquipo,
  invitarMiembro,
  normalizarEmail,
  ocupaAsiento,
  puedeInvitar,
  resolverCuenta,
  revocarMiembro,
  salirDelEquipo,
  type MiembroEquipo,
  type RolEquipo,
} from '@/lib/equipo'
import { emailInvitacionEquipo } from '@/lib/server-email'

export const dynamic = 'force-dynamic'

function enlaceInvitacion(token: string): string {
  const base = process.env.NEXT_PUBLIC_URL || 'https://camperocasion.online'
  return `${base}/equipo/invitacion/${token}`
}

/** Sin token fuera del titular: es una credencial de un solo uso. */
function publico(m: MiembroEquipo, conToken: boolean) {
  return {
    id: m.id,
    email: m.email,
    nombre: m.nombre,
    rol: m.rol,
    rolEtiqueta: ETIQUETA_ROL[m.rol] || m.rol,
    estado: m.estado,
    creadoEn: m.creado_en,
    aceptadoEn: m.aceptado_en,
    esTu: Boolean(m.aceptado_en),
    ...(conToken ? { token: m.token, enlace: enlaceInvitacion(m.token) } : {}),
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response

  const userId = auth.user.id as string
  const cuenta = await resolverCuenta(userId)
  const estado = await estadoPlanUsuario(userId)
  const miembros = await listarEquipo(cuenta.titularId)

  // Cuántos anuncios lleva cada uno: el titular ve el reparto del cupo.
  const sb = sbAdmin()
  const conteo: Record<string, number> = {}
  for (const m of miembros) {
    if (!m.miembro_id) continue
    const { count } = await sb
      .from('productos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', m.miembro_id)
      .eq('activo', true)
      .neq('vendido', true)
    conteo[m.miembro_id] = count || 0
  }

  return NextResponse.json({
    ok: true,
    rol: cuenta.rol,
    esTitular: cuenta.esTitular,
    titularId: cuenta.titularId,
    plan: estado.plan,
    puedeInvitar: Boolean(cuenta.esTitular && estado.plan === 'unlimited'),
    max: MIEMBROS_MAX,
    ocupados: miembros.filter((m) => ocupaAsiento(m.estado)).length,
    equipoCompleto: miembros.filter((m) => ocupaAsiento(m.estado)).length >= MIEMBROS_MAX,
    cupo: {
      max: estado.cupo.max,
      usados: estado.cupo.usados,
      restantes: estado.cupo.restantes,
    },
    miembros: miembros.map((m) => ({
      ...publico(m, cuenta.esTitular),
      anunciosActivos: m.miembro_id ? conteo[m.miembro_id] || 0 : 0,
      soyYo: m.miembro_id === userId,
    })),
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response
  const userId = auth.user.id as string

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const cuenta = await resolverCuenta(userId)
  if (!cuenta.esTitular) {
    return NextResponse.json(
      { ok: false, error: 'Solo el titular de la cuenta puede invitar comerciales.' },
      { status: 403 },
    )
  }

  const estado = await estadoPlanUsuario(userId)
  const miembros = await listarEquipo(userId)
  const ocupados = miembros.filter((m) => ocupaAsiento(m.estado)).length

  const decision = puedeInvitar({
    plan: estado.plan,
    ocupados,
    email: body?.email,
    emailsExistentes: miembros.map((m) => m.email),
    emailTitular: auth.user.email || null,
  })
  if (!decision.ok) {
    return NextResponse.json(
      { ok: false, codigo: decision.codigo, error: decision.motivo },
      { status: decision.codigo === 'PLAN' ? 403 : 400 },
    )
  }

  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const rl = await checkRateLimit('equipo:invitar', userId, { ip })
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: 'Demasiadas invitaciones seguidas. Espera unos minutos.' },
      { status: 429 },
    )
  }

  const rol: RolEquipo = body?.rol === 'admin' ? 'admin' : 'comercial'
  const creada = await invitarMiembro({
    titularId: userId,
    email: normalizarEmail(body?.email),
    nombre: body?.nombre || null,
    rol,
  })
  if (!creada.ok) {
    return NextResponse.json({ ok: false, codigo: creada.codigo, error: creada.error }, { status: 400 })
  }

  const enlace = enlaceInvitacion(creada.miembro.token)
  let emailEnviado = false
  try {
    emailEnviado = await emailInvitacionEquipo(
      creada.miembro.email,
      creada.miembro.nombre || creada.miembro.email,
      (auth.user.user_metadata?.nombre as string) || 'El titular de la cuenta',
      enlace,
    )
  } catch {
    // El enlace se devuelve igualmente para copiarlo a mano.
    emailEnviado = false
  }

  return NextResponse.json({
    ok: true,
    miembro: publico(creada.miembro, true),
    enlace,
    emailEnviado,
    restantes: Math.max(0, MIEMBROS_MAX - (ocupados + 1)),
  })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response
  const userId = auth.user.id as string

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON inválido' }, { status: 400 })
  }

  const cuenta = await resolverCuenta(userId)
  if (!cuenta.esTitular) {
    return NextResponse.json({ ok: false, error: 'Solo el titular puede cambiar roles.' }, { status: 403 })
  }
  const rol = body?.rol === 'admin' ? 'admin' : body?.rol === 'comercial' ? 'comercial' : null
  if (!rol || !body?.id) {
    return NextResponse.json({ ok: false, error: 'Faltan datos.' }, { status: 400 })
  }

  const ok = await cambiarRol({ titularId: userId, id: String(body.id), rol })
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'No se pudo cambiar el rol.' }, { status: 400 })
  }
  return NextResponse.json({ ok: true, rol })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response
  const userId = auth.user.id as string

  const id = req.nextUrl.searchParams.get('id')
  const salir = req.nextUrl.searchParams.get('salir') === '1'

  // Un comercial puede irse por su cuenta, sin permiso del titular.
  if (salir) {
    const ok = await salirDelEquipo(userId)
    return ok
      ? NextResponse.json({ ok: true, saliste: true })
      : NextResponse.json({ ok: false, error: 'No se pudo salir del equipo.' }, { status: 400 })
  }

  const cuenta = await resolverCuenta(userId)
  if (!cuenta.esTitular) {
    return NextResponse.json({ ok: false, error: 'Solo el titular puede revocar accesos.' }, { status: 403 })
  }
  if (!id) return NextResponse.json({ ok: false, error: 'Falta el id.' }, { status: 400 })

  const ok = await revocarMiembro({ titularId: userId, id })
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false, error: 'No se pudo revocar el acceso.' }, { status: 400 })
}
