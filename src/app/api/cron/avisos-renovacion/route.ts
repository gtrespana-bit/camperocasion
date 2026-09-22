/**
 * GET /api/cron/avisos-renovacion — «tu anuncio ha bajado de posición».
 *
 * Es el momento en que se venden los créditos: no en la página de precios,
 * sino cuando el vendedor ve que su anuncio ha perdido visibilidad y puede
 * arreglarlo por 1 crédito.
 *
 * Toda la decisión de a quién avisar vive en `src/lib/avisos-vendedor.ts`
 * (función pura y testeada). Aquí solo se leen los candidatos, se envía y se
 * marca la fecha para no repetir.
 *
 * Programa: diario a las 10:20 UTC (mediodía en España, cuando la gente mira
 * el móvil). Requiere `CRON_SECRET`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push-notify'
import { seleccionarAvisos, textoAviso } from '@/lib/avisos-vendedor'

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

  const { data: productos, error } = await admin
    .from('productos')
    .select(
      'id, user_id, titulo, visitas, creado_en, boosteado_en, activo, vendido, es_demo, ultimo_aviso_en'
    )
    .eq('activo', true)
    .eq('vendido', false)
    .limit(2000)

  if (error) {
    const msg = error.message || ''
    // La migración puede no estar aplicada todavía: una corrida saltada es
    // preferible a un error diario repetido en los logs.
    if (/ultimo_aviso_en|42703|column .* does not exist|schema cache/i.test(msg)) {
      return NextResponse.json({ ok: true, reason: 'migracion-pendiente' })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const avisos = seleccionarAvisos(productos || [])
  if (avisos.length === 0) {
    return NextResponse.json({ ok: true, avisados: 0 })
  }

  let enviados = 0
  const marcados: string[] = []

  for (const aviso of avisos) {
    const { titulo, cuerpo } = textoAviso(aviso)
    try {
      await notifyUser(admin, aviso.userId, {
        title: titulo,
        body: cuerpo,
        tag: `renovacion-${aviso.productoId}`,
        icon: '/icon-192.png',
        click_url: '/dashboard?tab=productos',
      })
      enviados++
      marcados.push(aviso.productoId)
    } catch {
      // Un fallo de envío no debe frenar al resto ni marcar el anuncio como
      // avisado: así se reintenta mañana.
    }
  }

  // Marcar en bloque: una sola escritura en vez de una por anuncio.
  if (marcados.length > 0) {
    await admin
      .from('productos')
      .update({ ultimo_aviso_en: new Date().toISOString() })
      .in('id', marcados)
  }

  return NextResponse.json({ ok: true, candidatos: avisos.length, avisados: enviados })
}
