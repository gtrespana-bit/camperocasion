/**
 * GET /api/cron/runtime-check — vigila el parche de Node.js en producción.
 *
 * Vercel fija el parche del runtime y su rollout tras una release de seguridad
 * puede tardar días. Este cron le pregunta al proceso real qué versión ejecuta
 * y avisa por Telegram **solo cuando cambia algo** (ver `decidirAviso`):
 *
 *   - cuando por fin alcanza el mínimo (`engine` de package.json),
 *   - si aparece una versión distinta pero aún vulnerable,
 *   - y si se produce una regresión a una versión vulnerable.
 *
 * El estado se guarda en `plataforma_ajustes` (clave `runtime_node`) para no
 * repetir el mismo aviso cada día. La tabla la usa también el panel de admin,
 * así que no hace falta migración.
 *
 * Programa: diario a las 08:00 UTC (ver vercel.json). Requiere `CRON_SECRET`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { sbAdmin } from '@/lib/sb-admin'
import { notificarAdminTelegram } from '@/lib/telegram-admin'
import { ENGINES_NODE, leerRuntimeNode } from '@/lib/runtime-node'
import { decidirAviso, type EstadoRuntime } from '@/lib/runtime-vigilancia'

const CLAVE = 'runtime_node'

async function leerEstadoAnterior(): Promise<EstadoRuntime | null> {
  try {
    const { data, error } = await sbAdmin()
      .from('plataforma_ajustes')
      .select('valor')
      .eq('clave', CLAVE)
      .maybeSingle()
    if (error || !data?.valor) return null
    const valor = data.valor as Partial<EstadoRuntime>
    if (typeof valor.node !== 'string') return null
    return {
      node: valor.node,
      cumple: valor.cumple === true,
      commit: typeof valor.commit === 'string' ? valor.commit : null,
      region: typeof valor.region === 'string' ? valor.region : null,
    }
  } catch {
    // Sin base de datos el cron sigue siendo útil: avisará en cada cambio de
    // versión que observe dentro de esta misma ejecución.
    return null
  }
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const info = leerRuntimeNode()
  const actual: EstadoRuntime = {
    node: info.node,
    cumple: info.cumple,
    commit: info.commit,
    region: info.region,
    comprobado_en: new Date().toISOString(),
  }

  const anterior = await leerEstadoAnterior()
  const decision = decidirAviso(anterior, actual, info.minimo)

  let avisado = false
  if (decision.avisar) {
    avisado = await notificarAdminTelegram(decision.texto)
  }

  // Se guarda cuando cambia el estado (no en cada ejecución) para que la tabla
  // refleje la última versión conocida sin escribir a diario.
  if (!anterior || anterior.node !== actual.node || anterior.cumple !== actual.cumple) {
    try {
      await sbAdmin().from('plataforma_ajustes').upsert({
        clave: CLAVE,
        valor: { ...actual, avisado_en: avisado ? actual.comprobado_en : null },
        actualizado_en: actual.comprobado_en,
      })
    } catch (err: any) {
      console.warn('[cron/runtime-check] no se pudo guardar el estado:', err?.message)
    }
  }

  return NextResponse.json({
    ok: info.cumple,
    node: info.node,
    minimo: info.minimo,
    engines: ENGINES_NODE,
    region: info.region,
    commit: info.commit,
    anterior: anterior?.node ?? null,
    motivo: decision.motivo,
    avisado,
  })
}
