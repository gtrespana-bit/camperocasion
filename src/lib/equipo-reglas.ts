/**
 * Reglas puras del equipo de Flota. Módulo aparte para que la UI pueda
 * importar constantes sin arrastrar el cliente de Supabase al navegador.
 */

export const MIEMBROS_MAX = 3
export const ROLES_EQUIPO = ['admin', 'comercial'] as const
export type RolEquipo = (typeof ROLES_EQUIPO)[number]

export const ETIQUETA_ROL: Record<RolEquipo, string> = {
  admin: 'Administrador',
  comercial: 'Comercial',
}

export type MiembroEquipo = {
  id: string
  titular_id: string
  email: string
  miembro_id: string | null
  nombre: string | null
  rol: RolEquipo
  estado: 'invitado' | 'activo' | 'revocado'
  token: string
  creado_en: string
  aceptado_en: string | null
  ultimo_acceso_en: string | null
}

// ── Reglas puras ───────────────────────────────────────────────────────────

export function normalizarEmail(valor: string | null | undefined): string {
  return String(valor ?? '').trim().toLowerCase()
}

/** Validación deliberadamente estricta pero sin regexes exóticas. */
export function emailValido(valor: string | null | undefined): boolean {
  const email = normalizarEmail(valor)
  if (email.length < 5 || email.length > 254) return false
  if (/\s/.test(email)) return false
  const [usuario, dominio, ...resto] = email.split('@')
  if (resto.length > 0 || !usuario || !dominio) return false
  if (!/^[^@]+$/.test(usuario)) return false
  if (!dominio.includes('.')) return false
  if (dominio.startsWith('.') || dominio.endsWith('.') || dominio.includes('..')) return false
  return true
}

export type MotivoNoInvitacion = 'PLAN' | 'LIMITE' | 'EMAIL' | 'DUPLICADO' | 'PROPIO'

export type DecisionInvitacion = {
  ok: boolean
  codigo?: MotivoNoInvitacion
  motivo?: string
}

/**
 * ¿Cabe un asiento más? Se cuentan invitados y activos: una invitación
 * pendiente ya reserva sitio. Los revocados lo liberan.
 */
export function puedeInvitar(opts: {
  plan?: string | null
  ocupados: number
  email?: string | null
  emailsExistentes?: string[]
  emailTitular?: string | null
}): DecisionInvitacion {
  if (opts.plan !== 'unlimited') {
    return {
      ok: false,
      codigo: 'PLAN',
      motivo: 'El equipo con varios comerciales está incluido en Unlimited Flota.',
    }
  }
  const email = normalizarEmail(opts.email)
  if (!emailValido(email)) {
    return { ok: false, codigo: 'EMAIL', motivo: 'Ese email no parece válido.' }
  }
  if (opts.emailTitular && normalizarEmail(opts.emailTitular) === email) {
    return {
      ok: false,
      codigo: 'PROPIO',
      motivo: 'Ese es el email de la cuenta. Invita a otra persona: tú ya eres el titular.',
    }
  }
  if ((opts.emailsExistentes || []).some((e) => normalizarEmail(e) === email)) {
    return {
      ok: false,
      codigo: 'DUPLICADO',
      motivo: 'Ya hay una invitación o un comercial con ese email.',
    }
  }
  if (Math.max(0, opts.ocupados) >= MIEMBROS_MAX) {
    return {
      ok: false,
      codigo: 'LIMITE',
      motivo: `El equipo admite ${MIEMBROS_MAX} comerciales además del titular.`,
    }
  }
  return { ok: true }
}

/** Solo invitados y activos ocupan asiento. */
export function ocupaAsiento(estado: string | null | undefined): boolean {
  return estado === 'invitado' || estado === 'activo'
}

