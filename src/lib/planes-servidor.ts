import { createClient } from '@supabase/supabase-js'
import { DIAS_MES_GRATIS_DEFAULT, resumenCupo } from '@/lib/planes-anuncios'

export function sbAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

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
  'id, tipo_vendedor, plan_anuncios, plan_hasta, creado_en, destacados_mes_usados, destacados_mes_periodo, stripe_customer_id, stripe_subscription_id'

export async function cupoDeUsuario(userId: string) {
  const sb = sbAdmin()
  const ajustes = await leerAjustesPlanes(sb)
  let perfil: any = null
  const full = await sb.from('perfiles').select(PERFIL_PLAN).eq('id', userId).maybeSingle()
  if (full.error) {
    const basic = await sb.from('perfiles').select('id, tipo_vendedor, creado_en').eq('id', userId).maybeSingle()
    perfil = basic.data
  } else {
    perfil = full.data
  }
  const { count } = await sb
    .from('productos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('activo', true)
    .neq('vendido', true)

  return {
    perfil,
    ajustes,
    resumen: resumenCupo({
      tipo: perfil?.tipo_vendedor,
      plan: perfil?.plan_anuncios,
      planHasta: perfil?.plan_hasta,
      creadoEn: perfil?.creado_en,
      mesGratisActivo: ajustes.mesGratisActivo,
      diasGratis: ajustes.diasGratis,
      usados: count || 0,
      destacadosUsados: perfil?.destacados_mes_usados,
      destacadosPeriodo: perfil?.destacados_mes_periodo,
    }),
  }
}

export async function aplicarPlanPerfil(
  userId: string,
  opts: {
    plan: string
    hasta?: string | null
    stripeCustomerId?: string | null
    stripeSubscriptionId?: string | null
  },
) {
  const sb = sbAdmin()
  const updates: Record<string, unknown> = {
    plan_anuncios: opts.plan,
    plan_hasta: opts.hasta ?? null,
  }
  if (opts.stripeCustomerId) updates.stripe_customer_id = opts.stripeCustomerId
  if (opts.stripeSubscriptionId) updates.stripe_subscription_id = opts.stripeSubscriptionId
  await sb.from('perfiles').update(updates).eq('id', userId)
}
