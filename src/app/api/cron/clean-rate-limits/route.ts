import { NextRequest, NextResponse } from 'next/server'
import { cleanOldRateLimits } from '@/lib/rate-limit'
import { limpiarVisitasAntiguas } from '@/lib/analitica-servidor'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const deleted = await cleanOldRateLimits()
  console.info(`[cron/clean-rate-limits] Deleted ${deleted} expired records`)

  // La analítica propia se retiene algo más de un año: suficiente para comparar
  // año contra año y para que la tabla no crezca sin freno.
  const visitas = await limpiarVisitasAntiguas()
  if (visitas.eliminados) {
    console.info(`[cron/clean-rate-limits] Deleted ${visitas.eliminados} old page views`)
  }

  return NextResponse.json({ ok: true, deleted, visitasEliminadas: visitas.eliminados })
}
