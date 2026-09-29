/**
 * Regalar un pack a un usuario concreto desde el panel admin.
 *
 * Hasta ahora el tiempo gratis solo se podía dar por dos vías indirectas: el
 * «mes de prueba» global (días desde el alta, para todos) o un cupón que el
 * usuario tenía que canjear (y que además exigía ser profesional). No había
 * forma de decir «a este camperizador dale 3 meses de Plus porque me ha
 * traído 5 anuncios».
 *
 * Este módulo es el cálculo, sin tocar ni base de datos ni red, para poder
 * probarlo: dado el estado actual del perfil y lo que teclea el admin,
 * devuelve el plan y la fecha de fin resultantes.
 */

import { esPlanPago, type PlanPago } from '@/lib/planes-anuncios'

/** `gratis` = quitar el pack (volver a la cuenta sin suscripción). */
export type PlanRegalable = PlanPago | 'gratis'

/** extender = suma los días al final del periodo vigente; reemplazar = cuenta desde ahora. */
export type ModoRegalo = 'extender' | 'reemplazar'

export const DIAS_REGALO_MAX = 3650
export const DIAS_REGALO_RAPIDOS = [7, 15, 30, 90, 180, 365] as const

export function esPlanRegalable(valor: unknown): valor is PlanRegalable {
  return valor === 'gratis' || esPlanPago(valor)
}

export function esModoRegalo(valor: unknown): valor is ModoRegalo {
  return valor === 'extender' || valor === 'reemplazar'
}

/** Días enteros válidos para un regalo (0 solo cuando se quita el pack). */
export function diasRegaloValidos(valor: unknown, plan: PlanRegalable): number {
  const dias = Math.trunc(Number(valor))
  if (plan === 'gratis') return 0
  if (!Number.isFinite(dias) || dias < 1) return 0
  return Math.min(DIAS_REGALO_MAX, dias)
}

export interface ResultadoRegalo {
  /** Pack que queda en el perfil. */
  plan: PlanRegalable
  /** Fecha de fin resultante (`null` si se queda sin pack). */
  planHasta: Date | null
  /** Días que se suman realmente desde el final vigente (0 si se reemplaza). */
  diasSumados: number
  /** Fecha de fin que tenía antes, si la tenía. */
  hastaAnterior: Date | null
  /** true = se han sumado los días al final de un pack vigente del mismo tipo. */
  extendido: boolean
}

/**
 * Calcula el resultado de regalar `dias` de `plan`.
 *
 * - Sin pack vigente o con «reemplazar»: empieza a contar ahora.
 * - Con el mismo pack vigente y «extender»: suma los días al final, que es lo
 *   que espera cualquiera que diga «dale un mes más».
 */
export function calcularRegaloPlan(opts: {
  planActual?: string | null
  hastaActual?: string | Date | null
  plan: PlanRegalable
  dias: number
  modo: ModoRegalo
  ahora?: Date
}): ResultadoRegalo {
  const ahora = opts.ahora ?? new Date()
  const hastaAnterior = opts.hastaActual ? new Date(opts.hastaActual) : null
  const hastaValida =
    hastaAnterior && !Number.isNaN(hastaAnterior.getTime()) ? hastaAnterior : null

  if (opts.plan === 'gratis') {
    return {
      plan: 'gratis',
      planHasta: null,
      diasSumados: 0,
      hastaAnterior: hastaValida,
      extendido: false,
    }
  }

  const dias = diasRegaloValidos(opts.dias, opts.plan)
  if (!dias) {
    return {
      plan: opts.plan,
      planHasta: hastaValida,
      diasSumados: 0,
      hastaAnterior: hastaValida,
      extendido: false,
    }
  }

  const mismoPackVigente =
    opts.planActual === opts.plan &&
    esPlanPago(opts.planActual) &&
    !!hastaValida &&
    hastaValida.getTime() > ahora.getTime()

  const base = opts.modo === 'extender' && mismoPackVigente ? hastaValida! : ahora
  const planHasta = new Date(base.getTime() + dias * 86400000)

  return {
    plan: opts.plan,
    planHasta,
    diasSumados: opts.modo === 'extender' && mismoPackVigente ? dias : 0,
    hastaAnterior: hastaValida,
    extendido: opts.modo === 'extender' && mismoPackVigente,
  }
}

/** Días que quedan de pack (null si no hay fecha o ya venció). */
export function diasRestantesDePlan(
  planHasta: string | Date | null | undefined,
  ahora: Date = new Date(),
): number | null {
  if (!planHasta) return null
  const hasta = new Date(planHasta)
  if (Number.isNaN(hasta.getTime())) return null
  const dias = Math.ceil((hasta.getTime() - ahora.getTime()) / 86400000)
  return dias > 0 ? dias : null
}

export function etiquetaPlan(plan: string | null | undefined): string {
  if (plan === 'starter') return 'Starter'
  if (plan === 'plus') return 'Plus'
  if (plan === 'unlimited') return 'Unlimited'
  return 'Sin pack'
}

/** ¿Tiene el usuario un pack de pago vigente ahora mismo? */
export function planVigente(
  plan: string | null | undefined,
  planHasta: string | Date | null | undefined,
  ahora: Date = new Date(),
): boolean {
  if (!esPlanPago(plan)) return false
  if (!planHasta) return true
  const hasta = new Date(planHasta)
  return !Number.isNaN(hasta.getTime()) && hasta.getTime() > ahora.getTime()
}

export function textoResumenRegalo(resultado: ResultadoRegalo): string {
  if (resultado.plan === 'gratis') return 'Pack retirado: la cuenta vuelve al plan gratuito.'
  const hasta = resultado.planHasta
  const fecha = hasta
    ? hasta.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'
  return `${etiquetaPlan(resultado.plan)} hasta el ${fecha}${resultado.extendido ? ' (días sumados al final)' : ''}`
}
