/**
 * POST /api/valorar — estimación de precio de una camper.
 *
 * Público a propósito (no exige sesión): es un lead-magnet, y pedir registro
 * antes de dar el valor mataría justo la conversión que buscamos. A cambio va
 * con rate limit por IP para que no se use como API de scraping.
 *
 * La estimación se calcula **en el servidor** con los anuncios reales del
 * modelo. Si no hay muestra suficiente y el usuario no dice el precio de
 * nuevo, se responde sin cifra: no inventamos.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '@/lib/rate-limit'
import { modeloPorValor } from '@/lib/marcas'
import { calcularEstadisticas, type Estadisticas } from '@/lib/precios-mercado'
import { valorar, validarEntrada, type EstadoVehiculo } from '@/lib/valoracion'
import { getPrecioEur, COLUMNAS_PRECIO } from '@/lib/precio'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
  const rl = await checkRateLimit('valorar', ip, { ip })
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: `Demasiadas consultas. Espera ${Math.ceil(rl.resetIn / 60000)} min.` },
      { status: 429 }
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 })
  }

  const entrada = {
    modelo: typeof body?.modelo === 'string' ? body.modelo : '',
    anio: Number(body?.anio),
    km: Number(body?.km),
    precioNuevo: body?.precioNuevo ? Number(body.precioNuevo) : null,
    estado: (body?.estado || 'bueno') as EstadoVehiculo,
  }

  const errores = validarEntrada(entrada)
  if (Object.keys(errores).length > 0) {
    return NextResponse.json(
      { ok: false, error: Object.values(errores)[0], errores },
      { status: 400 }
    )
  }

  // El modelo tiene que existir en el catálogo maestro: así el valor que se
  // consulta es el mismo canónico que está guardado en `productos.marca`.
  if (!modeloPorValor(entrada.modelo)) {
    return NextResponse.json({ ok: false, error: 'Modelo no reconocido' }, { status: 400 })
  }

  // Mercado real del modelo
  let mercado: Estadisticas | null = null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && key) {
    try {
      const sb = createClient(url, key)
      const { data } = await sb
        .from('productos')
        .select(`${COLUMNAS_PRECIO}, espec_km, espec_anio, es_demo`)
        .eq('marca', entrada.modelo)
        .eq('activo', true)
        .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado,estado_moderacion.eq.pendiente')
        .limit(200)

      mercado = calcularEstadisticas(
        (data || []).map((a: any) => ({
          precio: getPrecioEur(a),
          anio: a.espec_anio != null ? Number(a.espec_anio) : null,
          km: a.espec_km != null ? Number(a.espec_km) : null,
          es_demo: a.es_demo,
        }))
      )
    } catch {
      // Sin mercado se sigue con la depreciación; no es motivo para fallar.
    }
  }

  const resultado = valorar(entrada, mercado)

  if (!resultado) {
    return NextResponse.json({
      ok: true,
      resultado: null,
      motivo:
        'Todavía no tenemos anuncios suficientes de este modelo para estimar su precio con fiabilidad. Si nos dices cuánto costó nuevo, podemos calcularlo con la tabla oficial de depreciación.',
    })
  }

  return NextResponse.json({ ok: true, resultado })
}
