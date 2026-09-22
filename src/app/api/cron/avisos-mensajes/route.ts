/**
 * GET /api/cron/avisos-mensajes — avisa por email de mensajes sin leer.
 *
 * Por qué existe: recibir un mensaje solo generaba notificación in-app y push.
 * El push únicamente llega a quien aceptó notificaciones del navegador, así
 * que un vendedor que no vuelve a entrar en la web no se entera de que tiene
 * un comprador esperando. En este sector el comprador escribe a cinco
 * vendedores a la vez y compra al primero que contesta.
 *
 * El aviso es DIFERIDO (ver `src/lib/avisos-mensajes.ts`): solo se avisa de lo
 * que sigue sin leer pasados unos minutos, agrupando por conversación. Quien
 * estaba en la web y ya respondió no recibe nada.
 *
 * Programa: cada 10 minutos. Requiere `CRON_SECRET`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { agruparAvisos, HORAS_MAXIMO_AVISO, type MensajePendiente } from '@/lib/avisos-mensajes'
import { enviarEmailMensaje } from '@/email/server-email'

export const dynamic = 'force-dynamic'

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

  // Solo la ventana útil: más atrás de eso ya no se avisa.
  const desde = new Date(Date.now() - HORAS_MAXIMO_AVISO * 3600e3).toISOString()

  const { data: mensajes, error } = await admin
    .from('mensajes')
    .select('id, conversacion_id, remitente_id, destinatario_id, contenido, creado_en, leido, aviso_email_en, producto_id')
    .eq('leido', false)
    .is('aviso_email_en', null)
    .gte('creado_en', desde)
    .order('creado_en', { ascending: false })
    .limit(500)

  if (error) {
    const msg = error.message || ''
    // La migración puede no estar aplicada aún: mejor saltar la pasada que
    // llenar los logs de errores cada diez minutos.
    if (/aviso_email_en|42703|column .* does not exist|schema cache/i.test(msg)) {
      return NextResponse.json({ ok: true, reason: 'migracion-pendiente' })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const avisos = agruparAvisos((mensajes || []) as MensajePendiente[])
  if (avisos.length === 0) return NextResponse.json({ ok: true, avisados: 0 })

  // Datos necesarios, en consultas agrupadas (nada de N+1 dentro del bucle).
  const destinatarios = [...new Set(avisos.map((a) => a.destinatarioId))]
  const remitentes = [...new Set(avisos.map((a) => a.remitenteId))]

  const { data: perfiles } = await admin
    .from('perfiles')
    .select('id, nombre, email_avisos_mensajes')
    .in('id', [...new Set([...destinatarios, ...remitentes])])

  const nombrePorUser = new Map<string, string>()
  const aceptaEmail = new Map<string, boolean>()
  for (const p of perfiles || []) {
    nombrePorUser.set(p.id, p.nombre || 'un usuario')
    // Si la columna no existiera todavía, `undefined !== false` → se respeta
    // el valor por defecto (avisar).
    aceptaEmail.set(p.id, (p as { email_avisos_mensajes?: boolean }).email_avisos_mensajes !== false)
  }

  // Título del anuncio para dar contexto ("te escriben sobre X").
  const convIds = [...new Set(avisos.map((a) => a.conversacionId))]
  const { data: convs } = await admin
    .from('conversaciones')
    .select('id, producto_id, productos(titulo)')
    .in('id', convIds)
  const productoPorConv = new Map<string, string>()
  for (const c of convs || []) {
    const titulo = (c.productos as { titulo?: string } | null)?.titulo
    if (titulo) productoPorConv.set(c.id, titulo)
  }

  // Emails (auth.users va paginado).
  const emailPorUser = new Map<string, string>()
  const pendientes = new Set(destinatarios)
  for (let page = 1; page <= 10 && emailPorUser.size < pendientes.size; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    for (const u of data?.users || []) {
      if (pendientes.has(u.id) && u.email) emailPorUser.set(u.id, u.email)
    }
    if (!data?.users?.length) break
  }

  let enviados = 0
  let omitidos = 0
  const marcados: string[] = []

  for (const aviso of avisos) {
    const email = emailPorUser.get(aviso.destinatarioId)
    const quiere = aceptaEmail.get(aviso.destinatarioId) !== false

    // Si el usuario no quiere estos emails o no tenemos dirección, se marcan
    // igualmente como avisados: de lo contrario el cron los reevaluaría cada
    // diez minutos durante 24 horas sin llegar a hacer nada.
    if (!email || !quiere) {
      omitidos++
      marcados.push(...aviso.mensajeIds)
      continue
    }

    try {
      await enviarEmailMensaje(
        email,
        nombrePorUser.get(aviso.destinatarioId) || '',
        nombrePorUser.get(aviso.remitenteId) || 'Un comprador',
        productoPorConv.get(aviso.conversacionId) || 'tu anuncio',
        aviso.preview,
        { total: aviso.total, conversacionId: aviso.conversacionId }
      )
      enviados++
      marcados.push(...aviso.mensajeIds)
    } catch {
      // Sin marcar: se reintenta en la siguiente pasada.
    }
  }

  if (marcados.length > 0) {
    await admin
      .from('mensajes')
      .update({ aviso_email_en: new Date().toISOString() })
      .in('id', marcados)
  }

  return NextResponse.json({ ok: true, conversaciones: avisos.length, enviados, omitidos })
}
