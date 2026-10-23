/**
 * GET /api/cron/planes — avisos de prueba/cobro y pausa de anuncios por cupo.
 *
 * Por qué diario y no «cuando toque»: la prueba y el dunning son fechas, no
 * eventos de Stripe. Stripe avisa del primer cobro fallido, pero los
 * recordatorios a 3 y 7 días, el fin de la prueba y el fin de la gracia hay
 * que mirarlos cada día.
 *
 * Qué hace, en orden:
 *  1. Prueba: avisa a 10, 3 y 1 días; al terminar, avisa de los 7 días de
 *     gracia y del último día de gracia.
 *  2. Dunning: recuerda a los 3 y 7 días del primer fallo (el de 1 día lo
 *     manda el webhook en el momento).
 *  3. Cupo: llama a `aplicar_cupo_planes()` y avisa a quien se le han pausado
 *     anuncios, con los títulos, para que no parezca que han desaparecido.
 *
 * Todos los envíos son idempotentes: `plan_avisos` guarda la clave de cada
 * aviso (`trial_3d:2026-11-21`, `pago_fallido_3d:2026-10-22`…). Un cron que
 * corre dos veces (o un redeploy) no duplica correos.
 *
 * Programa: diario a las 09:10 UTC. Requiere `CRON_SECRET`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push-notify'
import { etiquetaPlan } from '@/lib/planes-anuncios'
import {
  DIAS_ESPERA_WINBACK,
  DIAS_GRACIA_TRIAL,
  DIAS_VENTANA_WINBACK,
  avisosPlanPendientes,
  estadoTrial,
  mensajeAvisoPlan,
  type AvisoPlanTipo,
} from '@/lib/planes-prueba'
import {
  enviarEmailAnunciosPausados,
  enviarEmailPagoFallido,
  enviarEmailTrialGracia,
  enviarEmailTrialTermina,
  enviarEmailWinback,
} from '@/email/server-email'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CAMPOS = [
  'id',
  'nombre',
  'tipo_vendedor',
  'plan_anuncios',
  'plan_hasta',
  'creado_en',
  'trial_iniciado_en',
  'trial_hasta',
  'trial_plan',
  'pago_pendiente_desde',
  'stripe_subscription_id',
].join(', ')

type PerfilCron = {
  id: string
  nombre: string | null
  tipo_vendedor: string | null
  plan_anuncios: string | null
  plan_hasta: string | null
  creado_en: string | null
  trial_iniciado_en: string | null
  trial_hasta: string | null
  trial_plan: string | null
  pago_pendiente_desde: string | null
  stripe_subscription_id: string | null
}

type PerfilCronConEmail = PerfilCron & { email: string }

type Pausado = {
  vendedor_id: string
  producto_id: string
  titulo: string | null
  cupo: number
}

/** Emails de auth.users por páginas (no hay consulta directa por lista de ids). */
async function emailsDeUsuarios(admin: any, ids: Set<string>) {
  const mapa = new Map<string, string>()
  if (ids.size === 0) return mapa
  for (let page = 1; page <= 10 && mapa.size < ids.size; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    for (const u of data?.users || []) {
      if (ids.has(u.id) && u.email) mapa.set(u.id, u.email)
    }
    if (!data?.users?.length) break
  }
  return mapa
}

async function clavesAvisadas(admin: any, ids: string[]) {
  const claves = new Map<string, Set<string>>()
  const tamano = 200
  for (let i = 0; i < ids.length; i += tamano) {
    const trozo = ids.slice(i, i + tamano)
    const { data, error } = await admin
      .from('plan_avisos')
      .select('user_id, clave')
      .in('user_id', trozo)
    if (error) break // migración pendiente: se enviará como mucho una vez por ejecución
    for (const row of data || []) {
      if (!claves.has(row.user_id)) claves.set(row.user_id, new Set())
      claves.get(row.user_id)!.add(row.clave)
    }
  }
  return claves
}

function textoEmail(
  tipo: AvisoPlanTipo,
  perfil: PerfilCronConEmail,
  trial: ReturnType<typeof estadoTrial>,
) {
  const plan = etiquetaPlan(perfil.trial_plan || 'plus')
  switch (tipo) {
    case 'trial_10d':
    case 'trial_3d':
    case 'trial_ultimo_dia':
      return enviarEmailTrialTermina(perfil.email, perfil.nombre || '', {
        dias: trial.diasRestantes,
        fechaFin: trial.hasta ? trial.hasta.toISOString() : '',
        plan,
      })
    case 'trial_gracia':
    case 'gracia_ultimo_dia':
      return enviarEmailTrialGracia(perfil.email, perfil.nombre || '', {
        graciaHasta: trial.graciaHasta ? trial.graciaHasta.toISOString() : '',
        graciaDias: DIAS_GRACIA_TRIAL,
      })
    case 'winback':
      return enviarEmailWinback(perfil.email, perfil.nombre || '', {
        plan: etiquetaPlan(perfil.trial_plan || perfil.plan_anuncios || 'plus'),
        fechaFin: trial.hasta ? trial.hasta.toISOString() : null,
      })
    default:
      return enviarEmailPagoFallido(perfil.email, perfil.nombre || '', {
        plan: perfil.plan_anuncios && perfil.plan_anuncios !== 'gratis'
          ? etiquetaPlan(perfil.plan_anuncios)
          : 'tu plan Profesional',
        fechaFin: perfil.plan_hasta,
        diasGracia: DIAS_GRACIA_TRIAL,
      })
  }
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  }
  const admin = createClient(url, key)
  const ahora = new Date()

  // ── 1. Candidatos a aviso ────────────────────────────────────────────────
  const { data: perfiles, error: perfilesError } = await admin
    .from('perfiles')
    .select(CAMPOS)
    .or('trial_hasta.not.is.null,pago_pendiente_desde.not.is.null')
    .limit(3000)

  if (perfilesError) {
    const msg = perfilesError.message || ''
    if (/trial_hasta|pago_pendiente_desde|42703|column .* does not exist|schema cache/i.test(msg)) {
      return NextResponse.json({ ok: true, reason: 'migracion-pendiente' })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const lista = (perfiles || []) as unknown as PerfilCron[]
  const avisadas = await clavesAvisadas(admin, lista.map((p) => p.id))
  const emails = await emailsDeUsuarios(admin, new Set(lista.map((p) => p.id)))

  let emailsEnviados = 0
  let pushEnviados = 0
  let avisos = 0
  const fallos: string[] = []

  for (const perfil of lista) {
    const planPagoVigente =
      (perfil.plan_anuncios === 'starter' ||
        perfil.plan_anuncios === 'plus' ||
        perfil.plan_anuncios === 'unlimited') &&
      (!perfil.plan_hasta || new Date(perfil.plan_hasta).getTime() >= ahora.getTime())

    const trial = estadoTrial({
      tipo: perfil.tipo_vendedor,
      creadoEn: perfil.creado_en,
      trialIniciadoEn: perfil.trial_iniciado_en,
      trialHasta: perfil.trial_hasta,
      planPagoVigente,
      ahora,
    })

    // Fin de la gracia = momento en que se pierde el cupo del pack de prueba.
    // Quien ya tuvo suscripción no pasa por aquí: su baja se registra en
    // `plan_avisos` y se avisa desde la sección 3.
    const graciaFin = trial.hasta
      ? new Date(trial.hasta.getTime() + DIAS_GRACIA_TRIAL * 86400000)
      : null
    const winbackDesde = !perfil.stripe_subscription_id ? graciaFin : null

    const pendientes = avisosPlanPendientes({
      ahora,
      trial,
      pagoPendienteDesde: perfil.stripe_subscription_id ? perfil.pago_pendiente_desde : null,
      planPagoVigente,
      winbackDesde,
      avisados: avisadas.get(perfil.id) || [],
    })
    if (pendientes.length === 0) continue

    const email = emails.get(perfil.id)
    const conEmail = { ...perfil, email }

    for (const aviso of pendientes) {
      avisos++
      const mensaje = mensajeAvisoPlan(aviso.tipo, {
        plan: etiquetaPlan(perfil.plan_anuncios || perfil.trial_plan || 'plus'),
        dias: trial.diasRestantes || trial.diasGraciaRestantes,
      })

      let canal = 'ninguno'
      if (email) {
        try {
          const r = await textoEmail(aviso.tipo, conEmail as PerfilCronConEmail, trial)
          if (r) {
            emailsEnviados++
            canal = 'email'
          }
        } catch (e: any) {
          fallos.push(`${perfil.id}:${aviso.tipo}`)
          console.error('[cron/planes] email:', e?.message || e)
        }
      }

      try {
        await notifyUser(admin, perfil.id, {
          title: mensaje.titulo,
          body: mensaje.cuerpo,
          tag: `plan-${aviso.clave}`,
          icon: '/icon-192.png',
          click_url: mensaje.url,
        })
        pushEnviados++
        if (canal === 'ninguno') canal = 'push'
      } catch {
        /* sin suscripciones push: no es un error */
      }

      // Se marca aunque no haya canal: reintentar todos los días un aviso que
      // no se puede entregar solo llena los logs. El panel sigue mostrando el
      // estado real.
      try {
        await admin.from('plan_avisos').insert({
          user_id: perfil.id,
          clave: aviso.clave,
          tipo: aviso.tipo,
          canal,
        })
      } catch {
        /* migración pendiente */
      }
    }
  }

  // ── 2. Cupo: pausar lo que sobra (no borra nada) ─────────────────────────
  let pausados = 0
  let usuariosPausados = 0
  const { data: filas, error: cupoError } = await admin.rpc('aplicar_cupo_planes', {
    p_ahora: ahora.toISOString(),
  })

  if (cupoError) {
    const msg = cupoError.message || ''
    if (!/aplicar_cupo_planes|function .* does not exist|schema cache|42703/i.test(msg)) {
      console.error('[cron/planes] aplicar_cupo_planes:', msg)
      return NextResponse.json(
        { ok: false, avisos, emails: emailsEnviados, error: msg },
        { status: 500 },
      )
    }
  } else if (filas?.length) {
    pausados = filas.length
    const porUsuario = new Map<string, Pausado[]>()
    for (const fila of filas as Pausado[]) {
      if (!porUsuario.has(fila.vendedor_id)) porUsuario.set(fila.vendedor_id, [])
      porUsuario.get(fila.vendedor_id)!.push(fila)
    }
    usuariosPausados = porUsuario.size

    const ids = [...porUsuario.keys()]
    const emailsPausados = await emailsDeUsuarios(admin, new Set(ids))
    const nombres = new Map<string, string>()
    // Los títulos ya vienen en las filas; el nombre se lee en un solo viaje.
    const { data: perfilesPausados } = await admin
      .from('perfiles')
      .select('id, nombre, plan_anuncios, plan_hasta, tipo_vendedor')
      .in('id', ids)
    for (const p of perfilesPausados || []) nombres.set(p.id, p.nombre || '')

    const clave = `pausados:${ahora.toISOString().slice(0, 10)}`
    const yaAvisados = await clavesAvisadas(admin, ids)

    for (const [userId, filasUsuario] of porUsuario) {
      // Si ya se avisó hoy (dos ejecuciones o un redeploy), no se repite.
      if (yaAvisados.get(userId)?.has(clave)) continue

      const titulos = filasUsuario.map((f) => f.titulo || 'Anuncio sin título')
      const email = emailsPausados.get(userId)
      const cupo = filasUsuario[0]?.cupo ?? 1

      let canal = 'ninguno'
      if (email) {
        try {
          const r = await enviarEmailAnunciosPausados(email, nombres.get(userId) || '', {
            titulos,
            cupo,
          })
          if (r) canal = 'email'
        } catch (e: any) {
          console.error('[cron/planes] email pausados:', e?.message || e)
        }
      }

      try {
        await notifyUser(admin, userId, {
          title: `${titulos.length} anuncio${titulos.length === 1 ? '' : 's'} pausado${titulos.length === 1 ? '' : 's'} por cupo`,
          body: 'No se ha borrado nada. Amplía tu pack o pausa otro para reactivarlos.',
          tag: `pausados-${ahora.toISOString().slice(0, 10)}`,
          icon: '/icon-192.png',
          click_url: '/dashboard?tab=productos',
        })
        if (canal === 'ninguno') canal = 'push'
      } catch {
        /* sin push */
      }

      try {
        await admin.from('plan_avisos').insert({
          user_id: userId,
          clave,
          tipo: 'anuncios_pausados',
          canal,
        })
      } catch {
        /* migración pendiente */
      }
    }
  }

  // ── 3. Win-back de bajas de suscripción ─────────────────────────────────
  // El webhook deja `baja:YYYY-MM-DD` en `plan_avisos` cuando Stripe confirma
  // la baja. Aquí se busca una semana después, con la misma ventana que la
  // prueba: ni se olvida si el cron falla un día, ni se avisa a bajas viejas.
  let winbacks = 0
  const desdeVentana = new Date(
    ahora.getTime() - (DIAS_ESPERA_WINBACK + DIAS_VENTANA_WINBACK + 5) * 86400000,
  ).toISOString()

  const { data: bajas } = await admin
    .from('plan_avisos')
    .select('user_id, clave, tipo')
    .like('clave', 'baja:%')
    .gte('enviado_en', desdeVentana)
    .limit(1000)

  if (bajas?.length) {
    const ids = [...new Set(bajas.map((b: any) => b.user_id as string))]
    const yaAvisados = await clavesAvisadas(admin, ids)
    const emailsBaja = await emailsDeUsuarios(admin, new Set(ids))
    const { data: perfilesBaja } = await admin
      .from('perfiles')
      .select('id, nombre, plan_anuncios, plan_hasta')
      .in('id', ids)
    const porId = new Map<string, any>((perfilesBaja || []).map((p: any) => [p.id, p]))

    for (const baja of bajas as any[]) {
      const fecha = String(baja.clave).slice('baja:'.length)
      const perdida = new Date(`${fecha}T00:00:00Z`)
      if (Number.isNaN(perdida.getTime())) continue

      const dias = Math.floor((ahora.getTime() - perdida.getTime()) / 86400000)
      if (dias < DIAS_ESPERA_WINBACK || dias > DIAS_ESPERA_WINBACK + DIAS_VENTANA_WINBACK) continue

      const perfil = porId.get(baja.user_id)
      if (!perfil) continue
      const planVigente =
        (perfil.plan_anuncios === 'starter' ||
          perfil.plan_anuncios === 'plus' ||
          perfil.plan_anuncios === 'unlimited') &&
        (!perfil.plan_hasta || new Date(perfil.plan_hasta).getTime() >= ahora.getTime())
      if (planVigente) continue

      const clave = `winback:${fecha}`
      if (yaAvisados.get(baja.user_id)?.has(clave)) continue

      const email = emailsBaja.get(baja.user_id)
      let canal = 'ninguno'
      if (email) {
        try {
          const r = await enviarEmailWinback(email, perfil.nombre || '', {
            plan: baja.tipo && baja.tipo !== 'baja' ? etiquetaPlan(baja.tipo) : 'Profesional',
            fechaFin: fecha,
          })
          if (r) {
            emailsEnviados++
            canal = 'email'
          }
        } catch (e: any) {
          fallos.push(`${baja.user_id}:winback`)
          console.error('[cron/planes] email winback:', e?.message || e)
        }
      }

      const mensaje = mensajeAvisoPlan('winback')
      try {
        await notifyUser(admin, baja.user_id, {
          title: mensaje.titulo,
          body: mensaje.cuerpo,
          tag: `plan-${clave}`,
          icon: '/icon-192.png',
          click_url: mensaje.url,
        })
        pushEnviados++
        if (canal === 'ninguno') canal = 'push'
      } catch {
        /* sin suscripciones push: no es un error */
      }

      try {
        await admin.from('plan_avisos').insert({
          user_id: baja.user_id,
          clave,
          tipo: 'winback',
          canal,
        })
      } catch {
        /* migración pendiente */
      }

      avisos++
      winbacks++
    }
  }

  return NextResponse.json({
    ok: true,
    candidatos: lista.length,
    avisos,
    emails: emailsEnviados,
    push: pushEnviados,
    pausados,
    usuariosPausados,
    winbacks,
    fallos: fallos.slice(0, 10),
  })
}
