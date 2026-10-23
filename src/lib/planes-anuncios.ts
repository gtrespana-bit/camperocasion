/**
 * Planes profesionales, cupos y ventajas.
 *
 * Particular: 1 anuncio activo (una camper). Quien tiene stock se identifica
 * como profesional y paga un pack, o usa el mes de prueba si el admin lo tiene
 * encendido.
 */

export type TipoVendedor = 'particular' | 'camperizador' | 'profesional'
export type PlanAnuncios = 'gratis' | 'plus'
/** Periodicidad de cobro de un pack. El anual equivale a 10 mensualidades. */
export type Periodicidad = 'mensual' | 'anual'

export const PLANES_PRO = [
  {
    id: 'plus' as const,
    nombre: 'Profesional',
    precioMes: 19,
    /** 10 meses: 2 gratis frente al pago mensual. */
    precioAnual: 190,
    cupo: 15 as number | null,
    fotos: 20,
    destacadosMes: 5,
    prioridadHomologacion: 1,
    eslogan: 'Para quien vende campers de forma habitual',
    paraQuien: 'Compraventas, camperizadores y talleres',
    destacado: true,
    incluido: [
      '15 anuncios activos a la vez',
      '5 destacados incluidos al mes',
      'Hasta 20 fotos por anuncio',
      'Escaparate /tienda/tu-taller',
      'Estadísticas completas y comparativa de mercado',
      'Importar stock desde CSV',
      'Prioridad alta en homologación',
      'Soporte por email',
    ],
  },
] as const

export type PlanPago = (typeof PLANES_PRO)[number]['id']

export const DIAS_MES_GRATIS_DEFAULT = 30
/** Durante el mes gratis se prueba el plan Profesional (15 anuncios, 5 destacados). */
export const PLAN_PRUEBA: PlanPago = 'plus'
/**
 * Días de acceso tras terminar la prueba antes de pausar anuncios.
 * Debe coincidir con el intervalo de `aplicar_cupo_planes()` en SQL.
 */
export const DIAS_GRACIA_TRIAL = 7

/**
 * Plan gratuito. No es un "tipo de cuenta": es el plan por defecto de
 * cualquier vendedor (particular o profesional) que aún no paga un pack.
 */
export const PLAN_GRATIS = {
  id: 'gratis' as const,
  nombre: 'Gratis',
  precioMes: 0,
  precioAnual: 0,
  cupo: 1 as number | null,
  fotos: 10,
  destacadosMes: 0,
  eslogan: 'Publica tu camper',
  paraQuien: 'Una camper, sin comisiones por venta',
  incluido: [
    '1 anuncio activo',
    '10 fotos por anuncio',
    'Chat con compradores',
    'Estadísticas básicas',
  ],
} as const

/** Etiqueta humana y consistente en toda la app. */
export function etiquetaPlan(plan: string | null | undefined): string {
  if (plan === 'plus') return 'Profesional'
  // Valores heredados de la escalera anterior: se muestran tal cual para no
  // mentir si algún perfil antiguo los conserva en la base.
  if (plan === 'starter') return 'Starter (heredado)'
  if (plan === 'unlimited') return 'Unlimited Flota (heredado)'
  return 'Gratis'
}

/**
 * Precio de un pack para una periodicidad. Fuente única de verdad: el
 * checkout y la página de precios usan esta función, nunca un número suelto.
 */
export function precioPlan(
  plan: PlanPago,
  periodicidad: Periodicidad = 'mensual',
): number {
  const def = getPlanDef(plan)
  if (!def) return 0
  return periodicidad === 'anual' ? def.precioAnual : def.precioMes
}

/** Equivalente mensual del precio anual (para comparar sin engañar). */
export function precioMensualEquivalente(plan: PlanPago): number {
  const def = getPlanDef(plan)
  if (!def) return 0
  return Math.round((def.precioAnual / 12) * 100) / 100
}

/** Descuento real del anual frente a 12 mensualidades, en porcentaje entero. */
export function descuentoAnualPct(plan: PlanPago): number {
  const def = getPlanDef(plan)
  if (!def || def.precioMes <= 0) return 0
  return Math.round((1 - def.precioAnual / (def.precioMes * 12)) * 100)
}

/** Días naturales que quedan de mes de prueba (0 si ya terminó). */
export function diasRestantesTrial(opts: {
  creadoEn?: Date | string | null
  diasGratis?: number
  ahora?: Date
}): number {
  if (!opts.creadoEn) return 0
  const ahora = opts.ahora ?? new Date()
  const hasta = trialHasta(opts.creadoEn, opts.diasGratis ?? DIAS_MES_GRATIS_DEFAULT)
  const ms = hasta.getTime() - ahora.getTime()
  return ms <= 0 ? 0 : Math.ceil(ms / 86400000)
}

export function esTipoVendedor(v: unknown): v is TipoVendedor {
  return v === 'particular' || v === 'camperizador' || v === 'profesional'
}

export function esPlanAnuncios(v: unknown): v is PlanAnuncios {
  return v === 'gratis' || v === 'plus'
}

/** Un único plan de pago: Profesional (id interno `plus`). */
export function esPlanPago(v: unknown): v is PlanPago {
  return v === 'plus'
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

/**
 * Fechas de la prueba.
 *
 * Los perfiles nuevos guardan `trial_iniciado_en` / `trial_hasta` y esas fechas
 * mandan: apagar el interruptor global no corta una prueba en curso. Los
 * perfiles anteriores a la migración se siguen calculando desde `creado_en`
 * (solo si el ajuste está encendido) para no cambiarles el estado de golpe.
 */
export function periodoTrial(opts: {
  tipo?: string | null
  creadoEn?: Date | string | null
  trialIniciadoEn?: Date | string | null
  trialHasta?: Date | string | null
  mesGratisActivo?: boolean
  diasGratis?: number
}): { inicio: Date | null; hasta: Date | null } {
  const dias =
    Number(opts.diasGratis) > 0 ? Number(opts.diasGratis) : DIAS_MES_GRATIS_DEFAULT
  const guardadoHasta = opts.trialHasta ? new Date(opts.trialHasta) : null
  const guardadoInicio = opts.trialIniciadoEn ? new Date(opts.trialIniciadoEn) : null

  if (guardadoHasta && !Number.isNaN(guardadoHasta.getTime())) {
    return {
      inicio:
        guardadoInicio && !Number.isNaN(guardadoInicio.getTime())
          ? guardadoInicio
          : new Date(guardadoHasta.getTime() - dias * 86400000),
      hasta: guardadoHasta,
    }
  }

  if (opts.mesGratisActivo === false) return { inicio: null, hasta: null }
  if (!esProfesional(opts.tipo)) return { inicio: null, hasta: null }
  if (!opts.creadoEn) return { inicio: null, hasta: null }

  const alta = new Date(opts.creadoEn)
  if (Number.isNaN(alta.getTime())) return { inicio: null, hasta: null }
  return { inicio: alta, hasta: trialHasta(alta, dias) }
}

export function trialVigente(opts: {
  tipo?: string | null
  creadoEn?: Date | string | null
  trialIniciadoEn?: Date | string | null
  trialHasta?: Date | string | null
  mesGratisActivo: boolean
  diasGratis?: number
  ahora?: Date
  planPagoVigente?: boolean
}): boolean {
  if (opts.planPagoVigente) return false
  if (!esProfesional(opts.tipo)) return false
  const ahora = opts.ahora ?? new Date()
  const { hasta } = periodoTrial(opts)
  if (!hasta) return false
  return ahora.getTime() <= hasta.getTime()
}

/** Días de gracia tras la prueba: el plan sigue vigente para no cortar en seco. */
export function trialGraciaVigente(opts: {
  tipo?: string | null
  creadoEn?: Date | string | null
  trialIniciadoEn?: Date | string | null
  trialHasta?: Date | string | null
  mesGratisActivo: boolean
  diasGratis?: number
  ahora?: Date
  planPagoVigente?: boolean
}): boolean {
  if (opts.planPagoVigente) return false
  if (!esProfesional(opts.tipo)) return false
  const ahora = opts.ahora ?? new Date()
  const { hasta } = periodoTrial(opts)
  if (!hasta) return false
  const finGracia = hasta.getTime() + DIAS_GRACIA_TRIAL * 86400000
  return ahora.getTime() > hasta.getTime() && ahora.getTime() <= finGracia
}

/**
 * Plan efectivo: suscripción de pago vigente > prueba > gracia > gratis.
 * El plan que se prueba es `trialPlan` (por defecto Profesional).
 */
export function planEfectivo(opts: {
  tipo?: string | null
  plan?: string | null
  planHasta?: Date | string | null
  creadoEn?: Date | string | null
  trialIniciadoEn?: Date | string | null
  trialHasta?: Date | string | null
  trialPlan?: string | null
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

  const enPrueba = trialVigente({ ...opts, ahora, planPagoVigente: false })
  const enGracia = trialGraciaVigente({ ...opts, ahora, planPagoVigente: false })
  if (enPrueba || enGracia) {
    return esPlanPago(opts.trialPlan) ? (opts.trialPlan as PlanPago) : PLAN_PRUEBA
  }
  return 'gratis'
}

export function cupoMaximo(plan: PlanAnuncios, tipo?: string | null): number | null {
  if (!esProfesional(tipo)) return 1
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
  trialIniciadoEn?: Date | string | null
  trialHasta?: Date | string | null
  trialPlan?: string | null
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
    trialIniciadoEn: opts.trialIniciadoEn,
    trialHasta: opts.trialHasta,
    mesGratisActivo: opts.mesGratisActivo,
    diasGratis: opts.diasGratis,
    ahora,
    planPagoVigente: pagoVigente,
  })
  const gracia = trialGraciaVigente({
    tipo,
    creadoEn: opts.creadoEn,
    trialIniciadoEn: opts.trialIniciadoEn,
    trialHasta: opts.trialHasta,
    mesGratisActivo: opts.mesGratisActivo,
    diasGratis: opts.diasGratis,
    ahora,
    planPagoVigente: pagoVigente,
  })
  const periodo = periodoTrial({ ...opts, tipo })

  const periodoMes = mesClave(ahora)
  const destUsados =
    opts.destacadosPeriodo === periodoMes
      ? Math.max(0, Number(opts.destacadosUsados) || 0)
      : 0
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
    trialGracia: gracia,
    trialHasta: periodo.hasta ? periodo.hasta.toISOString() : null,
    trialInicio: periodo.inicio ? periodo.inicio.toISOString() : null,
    graciaHasta: gracia && periodo.hasta
      ? new Date(periodo.hasta.getTime() + DIAS_GRACIA_TRIAL * 86400000).toISOString()
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
    return 'Como particular solo puedes tener 1 anuncio activo (una camper). Márcalo como vendido o páusalo para publicar otra. Si tienes stock, contrata un pack: al confirmarse el pago tu cuenta pasa a profesional automáticamente.'
  }
  if (resumen.plan === 'gratis' && !resumen.trial) {
    return 'Sin plan Profesional el cupo es de 1 anuncio activo, igual que un particular. Contrata el plan Profesional o canjea un cupón.'
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
