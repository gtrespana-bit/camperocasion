/**
 * Equipo de Unlimited Flota: varios comerciales, una cuota.
 *
 * Reglas del producto:
 *  · Solo el plan Flota (`unlimited`) puede invitar. Starter y Plus son de una
 *    persona; si necesitan dos comerciales, el salto de precio ya está
 *    justificado por el cupo.
 *  · El titular paga, invita y revoca. El comercial publica y ve su stock.
 *  · **El plan y el cupo son de la cuenta**, no del usuario: los anuncios de
 *    los tres comerciales suman contra los mismos 15/∞ y comparten los
 *    destacados. Por eso `cupoDeUsuario()` cuenta sobre `idsDeCuenta()`.
 *  · Un usuario pertenece como mucho a un equipo activo, y el titular no
 *    puede ser miembro de sí mismo.
 *
 * El módulo separa lo puro (validar email, decidir si cabe un asiento) de lo
 * que habla con la base, para poder probar las reglas sin Supabase.
 */
import { sbAdmin } from '@/lib/sb-admin'
import {
  MIEMBROS_MAX,
  ROLES_EQUIPO,
  emailValido,
  normalizarEmail,
  ocupaAsiento,
  puedeInvitar,
} from '@/lib/equipo-reglas'
import type { MiembroEquipo, RolEquipo } from '@/lib/equipo-reglas'

export {
  ETIQUETA_ROL,
  MIEMBROS_MAX,
  ROLES_EQUIPO,
  emailValido,
  normalizarEmail,
  ocupaAsiento,
  puedeInvitar,
} from '@/lib/equipo-reglas'
export type { DecisionInvitacion, MiembroEquipo, MotivoNoInvitacion, RolEquipo } from '@/lib/equipo-reglas'

// ── Cuenta efectiva ────────────────────────────────────────────────────────

export type Cuenta = {
  titularId: string
  esTitular: boolean
  rol: RolEquipo | null
  /** Titular + comerciales activos. Siempre incluye al usuario actual. */
  ids: string[]
  miembroId: string | null
}

const COLUMNAS =
  'id, titular_id, email, miembro_id, nombre, rol, estado, token, creado_en, aceptado_en, ultimo_acceso_en'

/**
 * Resuelve la cuenta a la que pertenece `userId`. Tolerante a que la
 * migración no esté aplicada: en ese caso cada usuario es su propia cuenta.
 */
export async function resolverCuenta(userId: string, sb = sbAdmin()): Promise<Cuenta> {
  const propia: Cuenta = { titularId: userId, esTitular: true, rol: null, ids: [userId], miembroId: null }
  try {
    const { data: membresia, error } = await sb
      .from('equipo_miembros')
      .select('id, titular_id, rol')
      .eq('miembro_id', userId)
      .eq('estado', 'activo')
      .maybeSingle()
    if (error || !membresia) return propia

    const { data: companeros } = await sb
      .from('equipo_miembros')
      .select('miembro_id')
      .eq('titular_id', membresia.titular_id)
      .eq('estado', 'activo')

    const ids = new Set<string>([membresia.titular_id, userId])
    for (const c of companeros || []) {
      if (c.miembro_id) ids.add(c.miembro_id as string)
    }
    return {
      titularId: membresia.titular_id as string,
      esTitular: false,
      rol: (membresia.rol as RolEquipo) || 'comercial',
      ids: [...ids],
      miembroId: membresia.id as string,
    }
  } catch {
    return propia
  }
}

/** Atajo para las consultas que deben abarcar todo el equipo. */
export async function idsDeCuenta(userId: string, sb = sbAdmin()): Promise<string[]> {
  return (await resolverCuenta(userId, sb)).ids
}

// ── Operaciones de equipo ──────────────────────────────────────────────────

export async function listarEquipo(titularId: string, sb = sbAdmin()): Promise<MiembroEquipo[]> {
  try {
    const { data, error } = await sb
      .from('equipo_miembros')
      .select(COLUMNAS)
      .eq('titular_id', titularId)
      .neq('estado', 'revocado')
      .order('creado_en', { ascending: true })
    if (error) return []
    return (data || []) as unknown as MiembroEquipo[]
  } catch {
    return []
  }
}

export async function invitarMiembro(opts: {
  titularId: string
  email: string
  nombre?: string | null
  rol?: RolEquipo
  sb?: any
}): Promise<{ ok: true; miembro: MiembroEquipo } | { ok: false; codigo: string; error: string }> {
  const sb = opts.sb || sbAdmin()
  const email = normalizarEmail(opts.email)
  const rol: RolEquipo = ROLES_EQUIPO.includes((opts.rol || 'comercial') as RolEquipo)
    ? ((opts.rol || 'comercial') as RolEquipo)
    : 'comercial'

  try {
    const { data, error } = await sb
      .from('equipo_miembros')
      .insert({
        titular_id: opts.titularId,
        email,
        nombre: opts.nombre?.trim().slice(0, 80) || null,
        rol,
        estado: 'invitado',
      })
      .select(COLUMNAS)
      .single()

    if (error) {
      if (error.code === '23505' || /duplicate|unique/i.test(error.message || '')) {
        return { ok: false, codigo: 'DUPLICADO', error: 'Ya hay una invitación o un comercial con ese email.' }
      }
      if (/check_violation|máximo 3/i.test(`${error.code} ${error.message}`)) {
        return { ok: false, codigo: 'LIMITE', error: `El equipo admite ${MIEMBROS_MAX} comerciales además del titular.` }
      }
      return { ok: false, codigo: 'DB', error: 'No se pudo crear la invitación.' }
    }
    return { ok: true, miembro: data as unknown as MiembroEquipo }
  } catch {
    return { ok: false, codigo: 'DB', error: 'No se pudo crear la invitación.' }
  }
}

export async function revocarMiembro(opts: {
  titularId: string
  id: string
  sb?: any
}): Promise<boolean> {
  const sb = opts.sb || sbAdmin()
  const { error } = await sb
    .from('equipo_miembros')
    .update({ estado: 'revocado' })
    .eq('id', opts.id)
    .eq('titular_id', opts.titularId)
  return !error
}

/** El propio comercial puede irse; el titular no puede abandonar su cuenta. */
export async function salirDelEquipo(userId: string, sb = sbAdmin()): Promise<boolean> {
  const { error } = await sb
    .from('equipo_miembros')
    .update({ estado: 'revocado' })
    .eq('miembro_id', userId)
    .eq('estado', 'activo')
  return !error
}

export async function cambiarRol(opts: {
  titularId: string
  id: string
  rol: RolEquipo
  sb?: any
}): Promise<boolean> {
  if (!ROLES_EQUIPO.includes(opts.rol)) return false
  const sb = opts.sb || sbAdmin()
  const { error } = await sb
    .from('equipo_miembros')
    .update({ rol: opts.rol })
    .eq('id', opts.id)
    .eq('titular_id', opts.titularId)
    .eq('estado', 'activo')
  return !error
}

export type ResultadoAceptar =
  | { ok: true; titularId: string; rol: RolEquipo }
  | { ok: false; codigo: 'NO_EXISTE' | 'YA_USADA' | 'EMAIL' | 'SESION' | 'DB'; error: string }

/**
 * Acepta una invitación. Se comprueba en el servidor que el email de la
 * sesión coincide con el invitado: si no, cualquiera con el enlace podría
 * entrar en el equipo.
 */
export async function aceptarInvitacion(opts: {
  token: string
  userId: string
  email: string | null | undefined
  sb?: any
}): Promise<ResultadoAceptar> {
  const sb = opts.sb || sbAdmin()
  const token = String(opts.token || '').trim()
  if (!token) return { ok: false, codigo: 'NO_EXISTE', error: 'Invitación no válida.' }

  try {
    const { data, error } = await sb
      .from('equipo_miembros')
      .select(COLUMNAS)
      .eq('token', token)
      .maybeSingle()
    if (error || !data) return { ok: false, codigo: 'NO_EXISTE', error: 'La invitación no existe o ha caducado.' }

    const invitacion = data as unknown as MiembroEquipo
    if (invitacion.estado === 'activo') {
      return { ok: false, codigo: 'YA_USADA', error: 'Esta invitación ya se ha usado.' }
    }
    if (invitacion.estado !== 'invitado') {
      return { ok: false, codigo: 'NO_EXISTE', error: 'La invitación no existe o ha caducado.' }
    }

    const emailSesion = normalizarEmail(opts.email)
    if (!emailSesion || emailSesion !== normalizarEmail(invitacion.email)) {
      return {
        ok: false,
        codigo: 'EMAIL',
        error: `Esta invitación es para ${invitacion.email}. Entra con esa cuenta para aceptarla.`,
      }
    }

    const { error: errorUpdate } = await sb
      .from('equipo_miembros')
      .update({
        miembro_id: opts.userId,
        estado: 'activo',
        aceptado_en: new Date().toISOString(),
        ultimo_acceso_en: new Date().toISOString(),
      })
      .eq('id', invitacion.id)
      .eq('estado', 'invitado')

    if (errorUpdate) {
      if (errorUpdate.code === '23505' || /duplicate|unique/i.test(errorUpdate.message || '')) {
        return {
          ok: false,
          codigo: 'DB',
          error: 'Esa cuenta ya pertenece a otro equipo. Sal de él antes de aceptar esta invitación.',
        }
      }
      if (/maximum|máximo/i.test(errorUpdate.message || '')) {
        return { ok: false, codigo: 'DB', error: 'El equipo ya está completo.' }
      }
      return { ok: false, codigo: 'DB', error: 'No se pudo aceptar la invitación.' }
    }

    return { ok: true, titularId: invitacion.titular_id, rol: invitacion.rol }
  } catch {
    return { ok: false, codigo: 'DB', error: 'No se pudo aceptar la invitación.' }
  }
}
