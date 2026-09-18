/**
 * GET /api/cron/expirar-prioridades — retira los destacados y boosts caducados.
 *
 * POR QUÉ EXISTE
 * ==============
 * `productos.boosteado_en` y `productos.destacado` son las dos prioridades de
 * pago, y ninguna caducaba sola:
 *
 *   · Un boost (1 crédito) ponía `boosteado_en = now()` y ahí se quedaba para
 *     siempre: quien pagaba una vez se quedaba el primero de la lista y no
 *     tenía ningún motivo para volver a comprar. El resto de vendedores veía
 *     un catálogo donde comprar créditos "no servía de nada".
 *   · Un destacado tenía `destacado_hasta`, pero nada limpiaba el flag al
 *     pasar la fecha: el anuncio seguía llevando el ⭐ y saliendo arriba.
 *
 * La web ordena con la misma regla que aplica este cron
 * (`BOOST_DIAS` en `src/lib/catalog-consulta.ts`), así que mientras no se
 * ejecute, la web sigue siendo coherente; el cron es lo que deja la base de
 * datos limpia y hace que las estadísticas del panel (y un futuro "vuelve a
 * destacar tu anuncio") cuenten la verdad.
 *
 * Programa: diario a las 03:41 UTC (`vercel.json`).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { BOOST_DIAS } from '@/lib/catalog-consulta'
import { revalidarListadosPublicos } from '@/lib/revalidar'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return NextResponse.json({ error: 'Server not configured' }, { status: 503 })
  const admin = createClient(url, key)

  const ahora = new Date()
  const limiteBoost = new Date(ahora.getTime() - BOOST_DIAS * 864e5).toISOString()

  // 1. Boosts caducados → vuelven al orden normal del catálogo.
  const { data: boostsFuera, error: errorBoost } = await admin
    .from('productos')
    .update({ boosteado_en: null })
    .lt('boosteado_en', limiteBoost)
    .not('boosteado_en', 'is', null)
    .select('id')

  if (errorBoost) {
    return NextResponse.json({ error: errorBoost.message }, { status: 500 })
  }

  // 2. Destacados caducados → se les retira el flag (el histórico de la compra
  //    sigue en `transacciones_creditos`).
  const { data: destacadosFuera, error: errorDestacado } = await admin
    .from('productos')
    .update({ destacado: false })
    .eq('destacado', true)
    .lt('destacado_hasta', ahora.toISOString())
    .not('destacado_hasta', 'is', null)
    .select('id')

  if (errorDestacado) {
    return NextResponse.json({ error: errorDestacado.message }, { status: 500 })
  }

  const boosts = boostsFuera?.length || 0
  const destacados = destacadosFuera?.length || 0

  // La portada y el catálogo listan ambos flags: si tocamos algo, se recalcula
  // (la lista compartida cubre también el listado inglés).
  if (boosts + destacados > 0) revalidarListadosPublicos()

  console.info(`[cron/expirar-prioridades] boosts retirados: ${boosts}, destacados retirados: ${destacados}`)
  return NextResponse.json({ ok: true, boosts, destacados, boost_dias: BOOST_DIAS })
}
