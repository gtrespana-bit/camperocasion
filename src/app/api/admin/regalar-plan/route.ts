import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-auth'
import { requireUUIDs, sanitizeString } from '@/lib/validation'
import { sbAdmin } from '@/lib/planes-servidor'
import { mapaEmailsDeUsuarios } from '@/lib/admin-usuarios'
import {
  calcularRegaloPlan,
  diasRegaloValidos,
  diasRestantesDePlan,
  esModoRegalo,
  esPlanRegalable,
  etiquetaPlan,
  planVigente,
  textoResumenRegalo,
} from '@/lib/planes-regalo'
import { emailPlanRegalado } from '@/lib/server-email'

/**
 * Regalar (o retirar) un pack a un usuario concreto.
 *
 * `POST` aplica el cambio sobre `perfiles.plan_anuncios` / `plan_hasta` —los
 * mismos campos que escribe Stripe— y lo deja anotado en `planes_regalos`, la
 * bitácora de regalos que se ve en la pestaña «Planes y cupones».
 *
 * A diferencia del canje de cupones, aquí **no** se exige que la cuenta sea
 * profesional: si el admin decide regalarle un pack a un particular para que
 * pruebe, se le concede (y con `marcarProfesional` se le cambia también el
 * tipo de cuenta, que es lo que hace que el cupo se aplique de verdad).
 *
 * `GET` devuelve quién tiene pack ahora mismo y los últimos regalos, para
 * poder controlarlo desde el panel sin abrir la base de datos.
 */

export const dynamic = 'force-dynamic'

const PACKS_VIGENTES = ['starter', 'plus', 'unlimited']

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const body = await request.json().catch(() => ({}))
    const uuidCheck = requireUUIDs(body, ['userId'])
    if (!uuidCheck.valid) {
      return NextResponse.json({ error: uuidCheck.error || 'userId inválido' }, { status: 400 })
    }

    if (!esPlanRegalable(body.plan)) {
      return NextResponse.json(
        { error: 'Pack inválido (starter, plus, unlimited o gratis para retirarlo)' },
        { status: 400 },
      )
    }
    const plan = body.plan
    const modo = esModoRegalo(body.modo) ? body.modo : 'extender'
    const dias = diasRegaloValidos(body.dias, plan)
    if (plan !== 'gratis' && dias < 1) {
      return NextResponse.json({ error: 'Días inválidos (1 – 3650)' }, { status: 400 })
    }
    const motivo = body.motivo ? sanitizeString(String(body.motivo), 300) : null
    const marcarProfesional = body.marcarProfesional === true

    const sb = sbAdmin()
    const { data: perfil, error: perfilError } = await sb
      .from('perfiles')
      .select('id, nombre, plan_anuncios, plan_hasta, tipo_vendedor')
      .eq('id', body.userId)
      .maybeSingle()

    if (perfilError) {
      return NextResponse.json({ error: perfilError.message }, { status: 500 })
    }
    if (!perfil) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const resultado = calcularRegaloPlan({
      planActual: perfil.plan_anuncios,
      hastaActual: perfil.plan_hasta,
      plan,
      dias,
      modo,
    })

    const updates: Record<string, unknown> = {
      plan_anuncios: resultado.plan,
      plan_hasta: resultado.planHasta ? resultado.planHasta.toISOString() : null,
    }
    // Un pack solo sirve de algo si la cuenta puede tener stock: si el admin
    // regala uno a un particular, se le pasa a profesional (salvo que lo pida
    // explícitamente sin cambiar el tipo).
    const cambiaTipo = marcarProfesional && plan !== 'gratis' && perfil.tipo_vendedor === 'particular'
    if (cambiaTipo) updates.tipo_vendedor = 'profesional'

    const { error: updateError } = await sb.from('perfiles').update(updates).eq('id', body.userId)
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // La bitácora es lo que justifica el regalo seis meses después.
    const { error: logError } = await sb.from('planes_regalos').insert({
      user_id: body.userId,
      plan,
      dias: plan === 'gratis' ? 0 : dias,
      modo,
      motivo,
      plan_hasta_resultante: resultado.planHasta ? resultado.planHasta.toISOString() : null,
      admin_email: auth.user.email || null,
    })
    if (logError) {
      // El regalo ya está aplicado: no se aborta, solo se avisa.
      console.error('[admin/regalar-plan] bitácora:', logError.message)
    }

    let emailEnviado = false
    if (plan !== 'gratis') {
      try {
        const emails = await mapaEmailsDeUsuarios(sb, [body.userId])
        const email = emails.get(body.userId)
        if (email) {
          const hastaTexto = resultado.planHasta
            ? resultado.planHasta.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
            : '—'
          emailEnviado = await emailPlanRegalado(
            email,
            perfil.nombre || 'camper',
            etiquetaPlan(plan),
            hastaTexto,
            dias,
          )
        }
      } catch (e: any) {
        console.error('[admin/regalar-plan] email:', e?.message)
      }
    }

    return NextResponse.json({
      ok: true,
      plan: resultado.plan,
      planHasta: resultado.planHasta ? resultado.planHasta.toISOString() : null,
      dias,
      extendido: resultado.extendido,
      cambiaTipo,
      emailEnviado,
      resumen: textoResumenRegalo(resultado),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request)
    if ('response' in auth) return auth.response

    const sb = sbAdmin()
    const [vigentesRes, regalosRes] = await Promise.all([
      sb
        .from('perfiles')
        .select('id, nombre, plan_anuncios, plan_hasta, tipo_vendedor, creado_en')
        .in('plan_anuncios', PACKS_VIGENTES)
        .order('plan_hasta', { ascending: false })
        .limit(300),
      sb
        .from('planes_regalos')
        .select('*')
        .order('creado_en', { ascending: false })
        .limit(50),
    ])

    if (vigentesRes.error) {
      return NextResponse.json({ error: vigentesRes.error.message }, { status: 500 })
    }

    const regalos = regalosRes.error ? [] : regalosRes.data || []
    const packs = (vigentesRes.data || []).filter((p) => planVigente(p.plan_anuncios, p.plan_hasta))

    const ids = new Set<string>([...packs.map((p) => p.id), ...regalos.map((r: any) => r.user_id)])
    const emails = await mapaEmailsDeUsuarios(sb, ids)

    const nombres = new Map<string, string>()
    for (const p of packs) nombres.set(p.id, p.nombre || '')
    const idsSinNombre = Array.from(ids).filter((id) => !nombres.has(id))
    if (idsSinNombre.length) {
      const { data } = await sb.from('perfiles').select('id, nombre').in('id', idsSinNombre)
      for (const p of data || []) nombres.set(p.id, p.nombre || '')
    }

    const resumen = {
      starter: packs.filter((p) => p.plan_anuncios === 'starter').length,
      plus: packs.filter((p) => p.plan_anuncios === 'plus').length,
      unlimited: packs.filter((p) => p.plan_anuncios === 'unlimited').length,
      total: packs.length,
    }

    return NextResponse.json({
      ok: true,
      resumen,
      packs: packs.slice(0, 100).map((p) => ({
        id: p.id,
        nombre: p.nombre || 'Sin nombre',
        email: emails.get(p.id) || null,
        plan: p.plan_anuncios,
        planEtiqueta: etiquetaPlan(p.plan_anuncios),
        planHasta: p.plan_hasta,
        diasRestantes: diasRestantesDePlan(p.plan_hasta),
        tipoVendedor: p.tipo_vendedor,
        creadoEn: p.creado_en,
      })),
      regalos: regalos.map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        nombre: nombres.get(r.user_id) || 'Sin nombre',
        email: emails.get(r.user_id) || null,
        plan: r.plan,
        planEtiqueta: etiquetaPlan(r.plan),
        dias: r.dias,
        modo: r.modo,
        motivo: r.motivo,
        planHasta: r.plan_hasta_resultante,
        adminEmail: r.admin_email,
        creadoEn: r.creado_en,
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
