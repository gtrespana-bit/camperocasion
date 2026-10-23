/**
 * Prueba por usuario: fechas reales, gracia y avisos.
 *
 * Este módulo es puro (sin base de datos ni red) a propósito: decide QUÉ aviso
 * toca y CUÁNDO, y se puede probar con fechas fijas. El cron y los emails solo
 * ejecutan esa decisión.
 *
 * Antes la prueba se calculaba en cada petición como `creado_en + 30 días` con
 * un interruptor global. Eso tenía dos problemas:
 *  · apagar el interruptor cortaba la prueba a quien ya estaba dentro;
 *  · no se podía dar una prueba distinta a una cuenta concreta.
 * Ahora las fechas se guardan en `perfiles` y el interruptor solo decide si se
 * concede una prueba NUEVA.
 */
import {
  DIAS_GRACIA_TRIAL,
  DIAS_MES_GRATIS_DEFAULT,
  PLAN_PRUEBA,
  periodoTrial,
  type PlanPago,
} from '@/lib/planes-anuncios'

export { DIAS_GRACIA_TRIAL }

const DIA_MS = 24 * 60 * 60 * 1000

/**
 * Win-back: cuánto se espera desde que se pierde el cupo (fin de la gracia o
 * baja del pack) y cuánto dura la ventana para enviarlo.
 *
 * Sin ventana, la primera ejecución del cron tras un despliegue mandaría un
 * correo a todas las cuentas que alguna vez hicieron la prueba. Con 30 días,
 * solo alcanza a quien acaba de perder el plan.
 */
export const DIAS_ESPERA_WINBACK = 7
export const DIAS_VENTANA_WINBACK = 30

function aFecha(valor?: Date | string | null): Date | null {
  if (!valor) return null
  const fecha = valor instanceof Date ? valor : new Date(valor)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

function diasHasta(desde: Date, hasta: Date): number {
  const ms = hasta.getTime() - desde.getTime()
  return ms <= 0 ? 0 : Math.ceil(ms / DIA_MS)
}

export interface EstadoTrial {
  /** true = alguna vez tuvo fechas de prueba (aunque ya hayan pasado). */
  iniciado: boolean
  inicio: Date | null
  hasta: Date | null
  /** Días naturales que quedan de prueba (0 el último día o si ya terminó). */
  diasRestantes: number
  enPrueba: boolean
  enGracia: boolean
  graciaHasta: Date | null
  /** Días de gracia que quedan (0 el último día o si ya terminó). */
  diasGraciaRestantes: number
}

/**
 * Calcula el estado de la prueba.
 *
 * Prioridad de fuentes:
 *  1. fechas guardadas en el perfil (`trial_iniciado_en` / `trial_hasta`);
 *  2. compatibilidad: profesionales de antes de la migración, calculadas desde
 *     `creado_en` y el ajuste global (solo si el ajuste está activo).
 *
 * Un pack de pago vigente siempre gana: no se está «en prueba» aunque queden
 * días.
 */
export function estadoTrial(opts: {
  tipo?: string | null
  trialIniciadoEn?: Date | string | null
  trialHasta?: Date | string | null
  creadoEn?: Date | string | null
  mesGratisActivo?: boolean
  diasGratis?: number
  planPagoVigente?: boolean
  ahora?: Date
}): EstadoTrial {
  const ahora = opts.ahora ?? new Date()

  // La fuente de verdad del cálculo vive en `planes-anuncios` para que el
  // cupo, la página de precios y los avisos no puedan discrepar.
  const { inicio, hasta } = periodoTrial(opts)

  const pago = Boolean(opts.planPagoVigente)
  // La prueba es una ventaja de las cuentas profesionales; un particular que
  // vuelve a serlo no sigue «en prueba» aunque conserve fechas antiguas.
  const profesional = opts.tipo === 'camperizador' || opts.tipo === 'profesional'
  const enPrueba = Boolean(
    profesional && !pago && hasta && hasta.getTime() >= ahora.getTime(),
  )
  const graciaHasta = hasta ? new Date(hasta.getTime() + DIAS_GRACIA_TRIAL * DIA_MS) : null
  const enGracia = Boolean(
    profesional &&
      !pago &&
      hasta &&
      !enPrueba &&
      graciaHasta &&
      graciaHasta.getTime() >= ahora.getTime(),
  )

  return {
    iniciado: Boolean(inicio || hasta),
    inicio,
    hasta,
    diasRestantes: enPrueba && hasta ? diasHasta(ahora, hasta) : 0,
    enPrueba,
    enGracia,
    graciaHasta,
    diasGraciaRestantes: enGracia && graciaHasta ? diasHasta(ahora, graciaHasta) : 0,
  }
}

/**
 * ¿Puede empezar una prueba ahora?
 *
 * Solo si el admin la tiene encendida, no tiene pack de pago y no la ha usado
 * nunca. `estadoTrial` devuelve fechas también para los profesionales
 * anteriores a la migración, así que nadie puede repetirla por cambiar de tipo.
 */
export function trialDisponible(opts: {
  tipo?: string | null
  trialIniciadoEn?: Date | string | null
  trialHasta?: Date | string | null
  creadoEn?: Date | string | null
  mesGratisActivo: boolean
  diasGratis?: number
  planPagoVigente?: boolean
  ahora?: Date
}): boolean {
  if (!opts.mesGratisActivo) return false
  if (opts.planPagoVigente) return false
  if (opts.trialIniciadoEn) return false
  return !estadoTrial(opts).hasta
}

/** Fechas que se guardan al empezar la prueba. */
export function calcularTrial(opts?: {
  ahora?: Date
  dias?: number
  plan?: PlanPago
}): { inicio: Date; hasta: Date; plan: PlanPago } {
  const ahora = opts?.ahora ?? new Date()
  const dias = Number(opts?.dias) > 0 ? Number(opts?.dias) : DIAS_MES_GRATIS_DEFAULT
  return {
    inicio: ahora,
    hasta: new Date(ahora.getTime() + dias * DIA_MS),
    plan: opts?.plan ?? PLAN_PRUEBA,
  }
}

export type AvisoPlanTipo =
  | 'trial_10d'
  | 'trial_3d'
  | 'trial_ultimo_dia'
  | 'trial_gracia'
  | 'gracia_ultimo_dia'
  | 'pago_fallido_1d'
  | 'pago_fallido_3d'
  | 'pago_fallido_7d'
  | 'winback'

export interface AvisoPlanPendiente {
  tipo: AvisoPlanTipo
  /** Clave idempotente: misma prueba o mismo impago no se avisa dos veces. */
  clave: string
}

function claveFecha(prefijo: string, fecha: Date | null): string {
  const dia = fecha ? fecha.toISOString().slice(0, 10) : 'sin-fecha'
  return `${prefijo}:${dia}`
}

/**
 * Avisos que toca enviar hoy.
 *
 * Los umbrales son «<=» y no «=» a propósito: si un día el cron no corre (un
 * deploy, un fallo de red), el aviso se envía al día siguiente en vez de
 * perderse para siempre. La clave idempotente evita repetirlo.
 *
 * De la prueba se manda como mucho un aviso por pasada, del más urgente al
 * menos: último día > 3 días > 10 días.
 */
export function avisosPlanPendientes(opts: {
  ahora?: Date
  trial?: EstadoTrial
  pagoPendienteDesde?: Date | string | null
  planPagoVigente?: boolean
  /**
   * Fecha en la que perdió el cupo: fin de la gracia de la prueba o baja del
   * pack. Si no se pasa, no se plantea win-back.
   */
  winbackDesde?: Date | string | null
  /** Claves ya enviadas (`plan_avisos.clave`). */
  avisados?: Iterable<string>
}): AvisoPlanPendiente[] {
  const ahora = opts.ahora ?? new Date()
  const yaEnviados = new Set(opts.avisados ?? [])
  const pendientes: AvisoPlanPendiente[] = []

  const trial = opts.trial
  if (trial && !opts.planPagoVigente) {
    let aviso: AvisoPlanPendiente | null = null
    if (trial.enPrueba) {
      if (trial.diasRestantes <= 1) {
        aviso = { tipo: 'trial_ultimo_dia', clave: claveFecha('trial_ultimo_dia', trial.hasta) }
      } else if (trial.diasRestantes <= 3) {
        aviso = { tipo: 'trial_3d', clave: claveFecha('trial_3d', trial.hasta) }
      } else if (trial.diasRestantes <= 10) {
        aviso = { tipo: 'trial_10d', clave: claveFecha('trial_10d', trial.hasta) }
      }
    } else if (trial.enGracia) {
      aviso =
        trial.diasGraciaRestantes <= 1
          ? { tipo: 'gracia_ultimo_dia', clave: claveFecha('gracia_ultimo_dia', trial.hasta) }
          : { tipo: 'trial_gracia', clave: claveFecha('trial_gracia', trial.hasta) }
    }
    if (aviso && !yaEnviados.has(aviso.clave)) pendientes.push(aviso)
  }

  // Win-back: una semana después de perder el cupo, y solo una vez por pérdida
  // (la clave lleva la fecha). No se envía a quien sigue en prueba, en gracia
  // o con pack pagado.
  const perdida = aFecha(opts.winbackDesde)
  if (perdida && !opts.planPagoVigente && !trial?.enPrueba && !trial?.enGracia) {
    const dias = Math.floor((ahora.getTime() - perdida.getTime()) / DIA_MS)
    if (dias >= DIAS_ESPERA_WINBACK && dias <= DIAS_ESPERA_WINBACK + DIAS_VENTANA_WINBACK) {
      const clave = claveFecha('winback', perdida)
      if (!yaEnviados.has(clave)) pendientes.push({ tipo: 'winback', clave })
    }
  }

  // Dunning: un aviso por tramo y ciclo de impago. `invoice.paid` limpia la
  // fecha, así que un impago posterior vuelve a empezar de cero.
  // El impago puede ocurrir con el plan aún vigente (renovación fallida), así
  // que aquí no se exige `planPagoVigente`. Quien decide si sigue habiendo
  // suscripción es el cron, mirando `stripe_subscription_id`.
  const desde = aFecha(opts.pagoPendienteDesde)
  if (desde) {
    const dias = Math.floor((ahora.getTime() - desde.getTime()) / DIA_MS)
    const tipo: AvisoPlanTipo =
      dias >= 7 ? 'pago_fallido_7d' : dias >= 3 ? 'pago_fallido_3d' : 'pago_fallido_1d'
    const clave = claveFecha(tipo, desde)
    if (!yaEnviados.has(clave)) pendientes.push({ tipo, clave })
  }

  return pendientes
}

/** Texto corto para push y para la franja del panel. */
export function mensajeAvisoPlan(
  tipo: AvisoPlanTipo,
  ctx?: { plan?: string | null; dias?: number; fecha?: string | null; pausados?: number },
): { titulo: string; cuerpo: string; url: string } {
  const plan = ctx?.plan || 'Plus'
  const dias = ctx?.dias
  switch (tipo) {
    case 'trial_10d':
      return {
        titulo: `Te quedan ${dias ?? 10} días del pack ${plan}`,
        cuerpo: 'Activa tu pack para no perder el cupo ni el escaparate. Sin permanencia.',
        url: '/dashboard?tab=plan',
      }
    case 'trial_3d':
      return {
        titulo: `Tu pack ${plan} termina en ${dias ?? 3} días`,
        cuerpo: 'Activa el plan Profesional antes de que termine. Tus anuncios no se borran.',
        url: '/dashboard?tab=plan',
      }
    case 'trial_ultimo_dia':
      return {
        titulo: `Hoy es el último día de tu prueba ${plan}`,
        cuerpo: `Después tendrás ${DIAS_GRACIA_TRIAL} días de gracia. Activa tu pack para mantener tu stock publicado.`,
        url: '/dashboard?tab=plan',
      }
    case 'trial_gracia':
      return {
        titulo: 'Tu prueba ha terminado: tienes 7 días de gracia',
        cuerpo: 'Activa tu pack para conservar todos tus anuncios activos. No se ha borrado nada.',
        url: '/dashboard?tab=plan',
      }
    case 'gracia_ultimo_dia':
      return {
        titulo: 'Mañana se pausarán los anuncios que sobran',
        cuerpo: 'No se borran: podrás reactivarlos al ampliar el pack o pausar otros.',
        url: '/dashboard?tab=plan',
      }
    case 'pago_fallido_1d':
      return {
        titulo: 'No hemos podido cobrar tu pack',
        cuerpo: 'Actualiza la tarjeta para mantener tu cupo. Tus anuncios siguen activos.',
        url: '/dashboard?tab=plan',
      }
    case 'pago_fallido_3d':
      return {
        titulo: 'Sigue pendiente el cobro de tu pack',
        cuerpo: 'Actualiza el método de pago. Mantenemos tu plan mientras lo resuelves.',
        url: '/dashboard?tab=plan',
      }
    case 'pago_fallido_7d':
      return {
        titulo: 'Último aviso: no hemos podido cobrar tu pack',
        cuerpo: 'Si no se resuelve el pago, tu cuenta volverá al plan gratuito y se pausarán los anuncios que sobran.',
        url: '/dashboard?tab=plan',
      }
    case 'winback':
      return {
        titulo: 'Tu pack terminó hace unos días',
        cuerpo: 'Tus anuncios siguen ahí. Vuelve por 19 €/mes y recupera el cupo cuando quieras.',
        url: '/para-profesionales',
      }
  }
}
