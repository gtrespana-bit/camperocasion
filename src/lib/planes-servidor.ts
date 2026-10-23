import { sbAdmin } from '@/lib/sb-admin'
import {
  DIAS_MES_GRATIS_DEFAULT,
  cupoMaximo,
  diasRestantesTrial,
  esPlanPago,
  esProfesional,
  resumenCupo,
  type PlanPago,
} from '@/lib/planes-anuncios'
import { calcularTrial, estadoTrial, trialDisponible } from '@/lib/planes-prueba'

// Reexportado por compatibilidad: media app importa `sbAdmin` desde aquí.
export { sbAdmin }

export async function leerAjustesPlanes(sb = sbAdmin()) {
  try {
    const { data, error } = await sb
      .from('plataforma_ajustes')
      .select('valor')
      .eq('clave', 'planes')
      .maybeSingle()
    if (error) {
      return { mesGratisActivo: true, diasGratis: DIAS_MES_GRATIS_DEFAULT }
    }
    const valor = (data?.valor || {}) as Record<string, unknown>
    return {
      mesGratisActivo: valor.mes_gratis_activo !== false,
      diasGratis: Number(valor.dias_gratis) > 0 ? Number(valor.dias_gratis) : DIAS_MES_GRATIS_DEFAULT,
    }
  } catch {
    return { mesGratisActivo: true, diasGratis: DIAS_MES_GRATIS_DEFAULT }
  }
}

const PERFIL_PLAN =
  'id, tipo_vendedor, plan_anuncios, plan_hasta, creado_en, destacados_mes_usados, destacados_mes_periodo, stripe_customer_id, stripe_subscription_id, credito_balance'

/**
 * Columnas de la fase 2 (prueba con fechas + dunning).
 *
 * Se leen en una consulta aparte a propósito: si la migración aún no está
 * aplicada, la app sigue funcionando con el cálculo antiguo (prueba desde
 * `creado_en`) en vez de romper el panel y el paywall enteros.
 */
const PERFIL_TRIAL = 'trial_iniciado_en, trial_hasta, trial_plan, pago_pendiente_desde'

type CamposTrial = {
  trial_iniciado_en?: string | null
  trial_hasta?: string | null
  trial_plan?: string | null
  pago_pendiente_desde?: string | null
}

async function leerCamposTrial(sb: any, userId: string): Promise<CamposTrial> {
  try {
    const { data, error } = await sb
      .from('perfiles')
      .select(PERFIL_TRIAL)
      .eq('id', userId)
      .maybeSingle()
    if (error) return {}
    return (data || {}) as CamposTrial
  } catch {
    return {}
  }
}

async function leerPerfilPlan(sb: any, userId: string) {
  const full = await sb.from('perfiles').select(PERFIL_PLAN).eq('id', userId).maybeSingle()
  if (!full.error) {
    return { ...(full.data || {}), ...(await leerCamposTrial(sb, userId)) }
  }
  // Compatibilidad con bases donde aún no existe alguna columna de plan.
  const basic = await sb
    .from('perfiles')
    .select('id, tipo_vendedor, creado_en')
    .eq('id', userId)
    .maybeSingle()
  return { ...(basic.data || {}), ...(await leerCamposTrial(sb, userId)) }
}

async function contarActivos(sb: any, userId: string): Promise<number> {
  const { count } = await sb
    .from('productos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('activo', true)
    .neq('vendido', true)
  return count || 0
}

export async function cupoDeUsuario(userId: string) {
  const sb = sbAdmin()
  const ajustes = await leerAjustesPlanes(sb)
  const perfil = await leerPerfilPlan(sb, userId)
  const usados = await contarActivos(sb, userId)

  return {
    perfil,
    ajustes,
    resumen: resumenCupo({
      tipo: perfil?.tipo_vendedor,
      plan: perfil?.plan_anuncios,
      planHasta: perfil?.plan_hasta,
      creadoEn: perfil?.creado_en,
      trialIniciadoEn: perfil?.trial_iniciado_en,
      trialHasta: perfil?.trial_hasta,
      trialPlan: perfil?.trial_plan,
      mesGratisActivo: ajustes.mesGratisActivo,
      diasGratis: ajustes.diasGratis,
      usados,
      destacadosUsados: perfil?.destacados_mes_usados,
      destacadosPeriodo: perfil?.destacados_mes_periodo,
    }),
  }
}

/**
 * Reactiva anuncios pausados por el sistema al ampliar el pack.
 *
 * No toca los que pausó el vendedor: esos son una decisión suya. Devuelve
 * cuántos ha vuelto a publicar. Si la migración no está aplicada, no hace nada
 * (mejor un pack sin reactivación automática que un webhook en error).
 */
export async function reactivarPausadosPorPlan(
  userId: string,
  plan: string,
  sb = sbAdmin(),
): Promise<number> {
  try {
    const cupo = esPlanPago(plan) ? cupoMaximo(plan, 'profesional') : 1
    const activos = await contarActivos(sb, userId)
    const espacio = cupo == null ? 9999 : Math.max(0, cupo - activos)
    if (espacio <= 0) return 0

    const { data: pausados, error } = await sb
      .from('productos')
      .select('id')
      .eq('user_id', userId)
      .eq('activo', false)
      .eq('vendido', false)
      .eq('pausado_por_plan', true)
      .order('visitas', { ascending: false })
      .limit(espacio)

    if (error || !pausados?.length) return 0

    const ids = pausados.map((p: { id: string }) => p.id)
    const { error: updateError } = await sb
      .from('productos')
      .update({ activo: true, pausado_por_plan: false, pausado_en: null })
      .in('id', ids)
      .eq('user_id', userId)

    if (updateError) {
      // Columna aún no migrada: al menos se publican.
      const { error: fallbackError } = await sb
        .from('productos')
        .update({ activo: true })
        .in('id', ids)
        .eq('user_id', userId)
      if (fallbackError) return 0
    }
    return ids.length
  } catch {
    return 0
  }
}

/**
 * Aplica el pack al perfil. Es el único sitio que escribe `plan_anuncios` y
 * `plan_hasta` desde Stripe/cupones.
 *
 * `promoverAProfesional` existe por un caso real: un particular puede
 * contratar un pack desde la página de precios sin haber cambiado antes su
 * tipo de vendedor. Sin promoverlo, pagaría 19 € y seguiría con el cupo de 1
 * anuncio. Al contratar, el perfil pasa a «profesional» (la identidad es
 * gratuita) y recibe el cupo que acaba de pagar.
 */
export async function aplicarPlanPerfil(
  userId: string,
  opts: {
    plan: string
    hasta?: string | null
    stripeCustomerId?: string | null
    stripeSubscriptionId?: string | null
    promoverAProfesional?: boolean
  },
) {
  const sb = sbAdmin()
  const updates: Record<string, unknown> = {
    plan_anuncios: opts.plan,
    plan_hasta: opts.hasta ?? null,
  }
  if (opts.stripeCustomerId) updates.stripe_customer_id = opts.stripeCustomerId
  if (opts.stripeSubscriptionId) updates.stripe_subscription_id = opts.stripeSubscriptionId

  if (opts.promoverAProfesional && esPlanPago(opts.plan)) {
    const { data } = await sb
      .from('perfiles')
      .select('tipo_vendedor')
      .eq('id', userId)
      .maybeSingle()
    if (data && !esProfesional(data.tipo_vendedor)) {
      updates.tipo_vendedor = 'profesional'
    }
  }

  await sb.from('perfiles').update(updates).eq('id', userId)

  // Dunning: si el pago se ha resuelto, se cierra el aviso. Best-effort para
  // no romper la activación del plan si la migración aún no está aplicada.
  try {
    await sb.from('perfiles').update({ pago_pendiente_desde: null }).eq('id', userId)
  } catch {
    /* columna pendiente de migrar */
  }

  // Quien amplía el pack recupera los anuncios que se pausaron por cupo.
  if (esPlanPago(opts.plan)) {
    await reactivarPausadosPorPlan(userId, opts.plan, sb)
  }
}

/**
 * Marca el primer fallo de cobro de un ciclo. No pisa uno anterior.
 * Devuelve la fecha marcada (ISO) o null si ya estaba marcado / no se pudo.
 */
export async function marcarPagoFallido(userId: string): Promise<string | null> {
  try {
    const sb = sbAdmin()
    const { data } = await sb
      .from('perfiles')
      .select('pago_pendiente_desde')
      .eq('id', userId)
      .maybeSingle()

    // Sin columna (migración pendiente) o ya marcado: no hay nada que hacer.
    if (!data || data.pago_pendiente_desde !== null) return null

    const ahora = new Date().toISOString()
    const { error } = await sb
      .from('perfiles')
      .update({ pago_pendiente_desde: ahora })
      .eq('id', userId)
      .is('pago_pendiente_desde', null)
    return error ? null : ahora
  } catch {
    return null
  }
}

export async function limpiarPagoFallido(userId: string): Promise<void> {
  try {
    await sbAdmin().from('perfiles').update({ pago_pendiente_desde: null }).eq('id', userId)
  } catch {
    /* columna pendiente de migrar */
  }
}

export type ResultadoInicioTrial =
  | { ok: true; hasta: string; inicio: string; dias: number; plan: PlanPago; reactivados: number }
  | { ok: false; codigo: 'NO_DISPONIBLE' | 'YA_ACTIVO' | 'YA_USADA' | 'MIGRACION' | 'ERROR'; error: string }

/**
 * Empieza la prueba desde un clic (página de precios o panel).
 *
 * Se comprueba todo otra vez en el servidor: el navegador solo dice «quiero
 * probar». Si el usuario es particular, se le promociona a profesional para
 * que reciba de verdad el cupo de Plus; la identidad no se cobra y se explica
 * en la UI.
 */
export async function iniciarTrialPerfil(userId: string): Promise<ResultadoInicioTrial> {
  const sb = sbAdmin()
  const ajustes = await leerAjustesPlanes(sb)
  if (!ajustes.mesGratisActivo) {
    return {
      ok: false,
      codigo: 'NO_DISPONIBLE',
      error: 'La prueba gratuita no está disponible ahora mismo. Puedes contratar el plan Profesional por 19 €/mes.',
    }
  }

  const perfil = await leerPerfilPlan(sb, userId)
  if (!perfil) {
    return { ok: false, codigo: 'ERROR', error: 'No encontramos tu perfil.' }
  }

  const planPagoVigente =
    esPlanPago(perfil.plan_anuncios) &&
    (!perfil.plan_hasta || new Date(perfil.plan_hasta).getTime() >= Date.now())
  if (planPagoVigente) {
    return { ok: false, codigo: 'YA_ACTIVO', error: 'Ya tienes un pack activo.' }
  }

  const disponible = trialDisponible({
    tipo: perfil.tipo_vendedor,
    creadoEn: perfil.creado_en,
    trialIniciadoEn: perfil.trial_iniciado_en,
    trialHasta: perfil.trial_hasta,
    mesGratisActivo: ajustes.mesGratisActivo,
    diasGratis: ajustes.diasGratis,
    planPagoVigente,
  })
  if (!disponible) {
    return {
      ok: false,
      codigo: 'YA_USADA',
      error: 'Ya has usado tu prueba. Puedes contratar el plan Profesional por 19 €/mes.',
    }
  }

  const trial = calcularTrial({ dias: ajustes.diasGratis })
  const updates: Record<string, unknown> = {
    trial_iniciado_en: trial.inicio.toISOString(),
    trial_hasta: trial.hasta.toISOString(),
    trial_plan: trial.plan,
  }
  // La prueba da cupo de profesional: sin esto un particular probaría Plus y
  // seguiría viendo el límite de 1 anuncio.
  if (!esProfesional(perfil.tipo_vendedor)) updates.tipo_vendedor = 'profesional'

  const { error } = await sb.from('perfiles').update(updates).eq('id', userId)
  if (error) {
    const msg = error.message || ''
    if (/trial_iniciado_en|trial_hasta|trial_plan|42703|column .* does not exist|schema cache/i.test(msg)) {
      return {
        ok: false,
        codigo: 'MIGRACION',
        error: 'La prueba todavía no está habilitada en este entorno. Inténtalo más tarde.',
      }
    }
    return { ok: false, codigo: 'ERROR', error: 'No se pudo empezar la prueba. Inténtalo de nuevo.' }
  }

  const reactivados = await reactivarPausadosPorPlan(userId, trial.plan, sb)

  return {
    ok: true,
    inicio: trial.inicio.toISOString(),
    hasta: trial.hasta.toISOString(),
    dias: ajustes.diasGratis,
    plan: trial.plan,
    reactivados,
  }
}

/**
 * Estado completo del plan para el panel del vendedor: qué plan tiene, hasta
 * cuándo, cuánto cupo usa y si puede gestionar la suscripción en Stripe.
 *
 * La identidad (`tipo_vendedor`) y el plan son cosas distintas y se devuelven
 * por separado a propósito: la UI debe poder explicarlo sin ambigüedad.
 */
export async function estadoPlanUsuario(userId: string) {
  const sb = sbAdmin()
  const ajustes = await leerAjustesPlanes(sb)
  const perfil = await leerPerfilPlan(sb, userId)
  const usados = await contarActivos(sb, userId)

  const ahora = new Date()
  const planHasta = perfil?.plan_hasta ? new Date(perfil.plan_hasta) : null
  const planPagoVigente =
    esPlanPago(perfil?.plan_anuncios) &&
    (!planHasta || planHasta.getTime() >= ahora.getTime())

  const resumen = resumenCupo({
    tipo: perfil?.tipo_vendedor,
    plan: perfil?.plan_anuncios,
    planHasta: perfil?.plan_hasta,
    creadoEn: perfil?.creado_en,
    trialIniciadoEn: perfil?.trial_iniciado_en,
    trialHasta: perfil?.trial_hasta,
    trialPlan: perfil?.trial_plan,
    mesGratisActivo: ajustes.mesGratisActivo,
    diasGratis: ajustes.diasGratis,
    usados,
    destacadosUsados: perfil?.destacados_mes_usados,
    destacadosPeriodo: perfil?.destacados_mes_periodo,
    ahora,
  })

  const trial = estadoTrial({
    tipo: perfil?.tipo_vendedor,
    creadoEn: perfil?.creado_en,
    trialIniciadoEn: perfil?.trial_iniciado_en,
    trialHasta: perfil?.trial_hasta,
    mesGratisActivo: ajustes.mesGratisActivo,
    diasGratis: ajustes.diasGratis,
    planPagoVigente,
    ahora,
  })

  const trialElegible = trialDisponible({
    tipo: perfil?.tipo_vendedor,
    creadoEn: perfil?.creado_en,
    trialIniciadoEn: perfil?.trial_iniciado_en,
    trialHasta: perfil?.trial_hasta,
    mesGratisActivo: ajustes.mesGratisActivo,
    diasGratis: ajustes.diasGratis,
    planPagoVigente,
    ahora,
  })

  let pausadosPorPlan = 0
  try {
    const { count } = await sb
      .from('productos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('activo', false)
      .eq('vendido', false)
      .eq('pausado_por_plan', true)
    pausadosPorPlan = count || 0
  } catch {
    /* columna pendiente de migrar */
  }

  return {
    tipo: perfil?.tipo_vendedor || 'particular',
    plan: resumen.plan,
    planContratado: resumen.planContratado,
    planHasta: perfil?.plan_hasta || null,
    planPagoVigente,
    suscripcionStripe: Boolean(planPagoVigente && perfil?.stripe_subscription_id),
    gestionable: Boolean(perfil?.stripe_customer_id && process.env.STRIPE_SECRET_KEY),
    creditos: Number(perfil?.credito_balance || 0),
    cupo: resumen,
  }
}
