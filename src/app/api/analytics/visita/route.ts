import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizarVisita } from '@/lib/analitica'

/**
 * Recibe una página vista del navegador (`navigator.sendBeacon`).
 *
 * Es la única ruta pública que escribe la analítica propia y por eso es
 * deliberadamente aburrida y desconfiada:
 *
 *  - No guarda IP, ni user-agent, ni datos personales: solo el id anónimo del
 *    visitante, la ruta, el host del referrer y si la pantalla es móvil,
 *    tablet o escritorio. El `tipo` y el `slug` los recalcula el servidor
 *    desde la ruta; nunca se cree lo que llega.
 *  - Respeta `DNT: 1` y `Sec-GPC: 1` (si el navegador pide no ser rastreado,
 *    no se escribe nada).
 *  - Frena el abuso contando los envíos del propio visitante en el último
 *    minuto (una sola consulta) y descarta repeticiones de la misma ruta en
 *    5 s (recargas, doble render de React).
 *
 * Devuelve 204 siempre que la petición sea válida: `sendBeacon` ignora el
 * cuerpo, así que no hay nada útil que contestar.
 */

export const dynamic = 'force-dynamic'

const MAX_CUERPO = 2048
const MAX_ENVIOS_POR_MINUTO = 60
const VENTANA_DEDUPE_MS = 5000

function sbAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export async function POST(request: NextRequest) {
  try {
    // El navegador puede pedir explícitamente no ser medido.
    if (request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1') {
      return new NextResponse(null, { status: 204 })
    }

    const crudo = await request.text()
    if (!crudo || crudo.length > MAX_CUERPO) {
      return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 413 })
    }

    let body: unknown
    try {
      body = JSON.parse(crudo)
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const normalizado = normalizarVisita(body)
    if (!normalizado.ok) {
      return NextResponse.json({ error: normalizado.error }, { status: 400 })
    }
    const visita = normalizado.visita
    const sb = sbAdmin()

    // Una sola consulta hace de portero: dedupe de recargas y tope por minuto.
    const haceUnMinuto = new Date(Date.now() - 60000).toISOString()
    const { data: recientes } = await sb
      .from('visitas_pagina')
      .select('ruta, creado_en')
      .eq('visitante_id', visita.visitanteId)
      .gte('creado_en', haceUnMinuto)
      .order('creado_en', { ascending: false })
      .limit(MAX_ENVIOS_POR_MINUTO)

    const envios = recientes || []
    if (envios.length >= MAX_ENVIOS_POR_MINUTO) {
      return NextResponse.json({ error: 'Demasiados envíos' }, { status: 429 })
    }

    const ahora = Date.now()
    const duplicado = envios.some(
      (fila: any) =>
        fila.ruta === visita.ruta &&
        ahora - new Date(fila.creado_en).getTime() < VENTANA_DEDUPE_MS,
    )

    // Cierre de duración (pestaña oculta o cerrada): no añade visita nueva.
    if (!duplicado && !visita.soloDuracion) {
      let productoId: string | null = null
      if (visita.tipo === 'producto' && visita.slug) {
        const { data: producto } = await sb
          .from('productos')
          .select('id')
          .eq('slug', visita.slug)
          .maybeSingle()
        productoId = producto?.id || null
      }

      const { error } = await sb.from('visitas_pagina').insert({
        visitante_id: visita.visitanteId,
        sesion_id: visita.sesionId,
        ruta: visita.ruta,
        tipo: visita.tipo,
        slug: visita.slug,
        producto_id: productoId,
        referrer_host: visita.referrerHost,
        dispositivo: visita.dispositivo,
        idioma: visita.idioma,
      })

      if (error) {
        // Si la migración aún no está aplicada el sitio no debe romperse: la
        // medición es un extra, no una dependencia.
        console.warn('[analytics/visita] insert:', error.message)
        return new NextResponse(null, { status: 204 })
      }
    }

    // Duración de la página anterior: se conoce ahora, no cuando se entró.
    if (visita.anterior) {
      const { ruta, ts, segundos } = visita.anterior
      await sb
        .from('visitas_pagina')
        .update({ duracion_segundos: segundos })
        .eq('visitante_id', visita.visitanteId)
        .eq('ruta', ruta)
        .gte('creado_en', new Date(ts - 10000).toISOString())
        .lt('creado_en', new Date(ts + 15 * 60000).toISOString())
        .is('duracion_segundos', null)
    }

    return new NextResponse(null, { status: 204 })
  } catch (err: any) {
    console.error('[analytics/visita]', err?.message)
    return new NextResponse(null, { status: 204 })
  }
}
