/**
 * Planes profesionales, cupos y ventajas.
 *
 * Particular: 1 anuncio activo (una camper). Quien tiene stock se identifica
 * como profesional y paga un pack, o usa el mes de prueba si el admin lo tiene
 * encendido.
 */

export type TipoVendedor = 'particular' | 'camperizador' | 'profesional'
export type PlanAnuncios = 'gratis' | 'starter' | 'plus' | 'unlimited'

export const PLANES_PRO = [
  {
    id: 'starter' as const,
    nombre: 'Starter',
    precioMes: 9,
    cupo: 5 as number | null,
    fotos: 10,
    destacadosMes: 3,
    prioridadHomologacion: 2,
    eslogan: 'Taller o camperizador con poco stock',
    incluido: [
      '5 anuncios activos a la vez',
      '3 destacados incluidos al mes',
      'Escaparate /tienda/tu-taller',
      'Sello profesional visible',
      'Prioridad en homologación',
      'Estadísticas de visitas',
    ],
  },
  {
    id: 'plus' as const,
    nombre: 'Plus',
    precioMes: 19,
    cupo: 15 as number | null,
    fotos: 20,
    destacadosMes: 5,
    prioridadHomologacion: 1,
    eslogan: 'Compraventa con rotación',
    destacado: true,
    incluido: [
      '15 anuncios activos a la vez',
      '5 destacados incluidos al mes',
      'Hasta 20 fotos por anuncio',
      'Escaparate y sello profesional',
      'Prioridad alta en homologación',
      'Estadísticas de visitas',
    ],
  },
  {
    id: 'unlimited' as const,
    nombre: 'Unlimited Flota',
    precioMes: 39,
    cupo: null as number | null,
    fotos: 30,
    destacadosMes: 15,
    prioridadHomologacion: 0,
    eslogan: 'Sin límite de anuncios activos',
    incluido: [
      'Anuncios activos ilimitados',
      '15 destacados incluidos al mes',
      'Hasta 30 fotos por anuncio',
      'Máxima prioridad en homologación',
      'Escaparate y sello profesional',
      'Estadísticas de visitas',
    ],
  },
] as const

export type PlanPago = (typeof PLANES_PRO)[number]['id']

export const DIAS_MES_GRATIS_DEFAULT = 30
/** Durante el mes gratis se prueba el pack Plus (15 anuncios, 5 destacados). */
export const PLAN_PRUEBA: PlanPago = 'plus'

export function esTipoVendedor(v: unknown): v is TipoVendedor {
  return v === 'particular' || v === 'camperizador' || v === 'profesional'
}

export function esPlanAnuncios(v: unknown): v is PlanAnuncios {
  return v === 'gratis' || v === 'starter' || v === 'plus' || v === 'unlimited'
}

export function esPlanPago(v: unknown): v is PlanPago {
  return v === 'starter' || v === 'plus' || v === 'unlimited'
}

export function esProfesional(tipo: string | null | undefined): boolean {
  return tipo === 'camperizador' || tipo === 'profesional'
}

export function getPlanDef(id: string | null | undefined) {
  return PLANES_PRO.find(p => p.id === id) || null
}

export function mesClave(ahora: Date = new Date()): string {
  const y = ahora.getFullYear()
  const m = String(ahora.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function trialHasta(creadoEn: Date | string, dias: number): Date {
  const d = typeof creadoEn === 'string' ? new Date(creadoEn) : creadoEn
  return new Date(d.getTime() + Math.max(0, dias) * 24 * 60 * 60 * 1000)
}

export function trialVigente(opts: {
  tipo?: string | null
  creadoEn?: Date | string | null
  mesGratisActivo: boolean
  diasGratis?: number
  ahora?: Date
  planPagoVigente?: boolean
}): boolean {
  if (opts.planPagoVigente) return false
  if (!opts.mesGratisActivo) return false
  if (!esProfesional(opts.tipo)) return false
  if (!opts.creadoEn) return false
  const ahora = opts.ahora ?? new Date()
  const hasta = trialHasta(opts.creadoEn, opts.diasGratis ?? DIAS_MES_GRATIS_DEFAULT)
  return ahora.getTime() <= hasta.getTime()
}

/**
 * Plan efectivo: suscripción de pago vigente > mes de prueba > gratis/particular.
 */
export function planEfectivo(opts: {
  tipo?: string | null
  plan?: string | null
  planHasta?: Date | string | null
  creadoEn?: Date | string | null
  mesGratisActivo: boolean
  diasGratis?: number
  ahora?: Date
}): PlanAnuncios {
  const ahora = opts.ahora ?? new Date()
  if (!esProfesional(opts.tipo)) return 'gratis'

  const planHasta = opts.planHasta ? new Date(opts.planHasta) : null
  const pagoVigente =
    esPlanPago(opts.plan) && (!planHasta || planHasta.getTime() >= ahora.getTime())
  if (pagoVigente) return opts.plan as PlanPago

  if (
    trialVigente({
      tipo: opts.tipo,
      creadoEn: opts.creadoEn,
      mesGratisActivo: opts.mesGratisActivo,
      diasGratis: opts.diasGratis,
      ahora,
      planPagoVigente: false,
    })
  ) {
    return PLAN_PRUEBA
  }
  return 'gratis'
}

export function cupoMaximo(plan: PlanAnuncios, tipo?: string | null): number | null {
  if (!esProfesional(tipo)) return 1
  if (plan === 'unlimited') return null
  const def = getPlanDef(plan)
  if (def) return def.cupo
  return 1
}

export function fotosMaximas(plan: PlanAnuncios, tipo?: string | null): number {
  if (!esProfesional(tipo)) return 10
  return getPlanDef(plan)?.fotos ?? 10
}

export function destacadosIncluidosMes(plan: PlanAnuncios, tipo?: string | null): number {
  if (!esProfesional(tipo)) return 0
  return getPlanDef(plan)?.destacadosMes ?? 0
}

export function prioridadHomologacion(plan: PlanAnuncios, tipo?: string | null): number {
  if (!esProfesional(tipo)) return 9
  if (plan === 'gratis') return 5
  return getPlanDef(plan)?.prioridadHomologacion ?? 5
}

export function puedePublicarMas(usados: number, max: number | null): boolean {
  if (max == null) return true
  if (!Number.isFinite(usados) || usados < 0) return max > 0
  return usados < max
}

export function resumenCupo(opts: {
  tipo?: string | null
  plan?: string | null
  planHasta?: Date | string | null
  creadoEn?: Date | string | null
  mesGratisActivo: boolean
  diasGratis?: number
  usados: number
  destacadosUsados?: number
  destacadosPeriodo?: string | null
  ahora?: Date
}) {
  const ahora = opts.ahora ?? new Date()
  const tipo = esTipoVendedor(opts.tipo) ? opts.tipo : 'particular'
  const efectivo = planEfectivo({ ...opts, tipo, ahora })
  const max = cupoMaximo(efectivo, tipo)
  const usados = Math.max(0, Number(opts.usados) || 0)
  const pagoVigente =
    esProfesional(tipo) &&
    esPlanPago(opts.plan) &&
    (!opts.planHasta || new Date(opts.planHasta).getTime() >= ahora.getTime())
  const trial = trialVigente({
    tipo,
    creadoEn: opts.creadoEn,
    mesGratisActivo: opts.mesGratisActivo,
    diasGratis: opts.diasGratis,
    ahora,
    planPagoVigente: pagoVigente,
  })

  const periodo = mesClave(ahora)
  const destUsados =
    opts.destacadosPeriodo === periodo ? Math.max(0, Number(opts.destacadosUsados) || 0) : 0
  const destMax = destacadosIncluidosMes(efectivo, tipo)

  return {
    max,
    usados,
    restantes: max == null ? null : Math.max(0, max - usados),
    puedePublicar: puedePublicarMas(usados, max),
    profesional: esProfesional(tipo),
    tipo,
    plan: efectivo,
    planContratado: esPlanPago(opts.plan) ? opts.plan : 'gratis',
    trial,
    trialHasta: trial && opts.creadoEn
      ? trialHasta(opts.creadoEn, opts.diasGratis ?? DIAS_MES_GRATIS_DEFAULT).toISOString()
      : null,
    fotosMax: fotosMaximas(efectivo, tipo),
    destacadosMes: destMax,
    destacadosUsados: destUsados,
    destacadosRestantes: Math.max(0, destMax - destUsados),
    mesGratisActivo: opts.mesGratisActivo,
  }
}

export function mensajeCupoLleno(resumen: ReturnType<typeof resumenCupo>): string {
  if (resumen.tipo === 'particular') {
    return 'Como particular solo puedes tener 1 anuncio activo (una camper). Márcalo como vendido o páusalo para publicar otra, o identifícate como profesional si tienes stock.'
  }
  if (resumen.plan === 'gratis' && !resumen.trial) {
    return 'Sin pack profesional el cupo es de 1 anuncio activo, igual que un particular. Contrata Starter, Plus o Unlimited o canjea un cupón.'
  }
  return `Has llegado a tu cupo de ${resumen.max} anuncios activos. Amplía el pack o pausa anuncios que ya no estén a la venta.`
}

export function serializarCupo(resumen: ReturnType<typeof resumenCupo>) {
  return {
    ...resumen,
    max: resumen.max,
    restantes: resumen.restantes,
  }
}
