import { NextRequest, NextResponse } from 'next/server'
import { cleanOldRateLimits } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const deleted = await cleanOldRateLimits()
  console.info(`[cron/clean-rate-limits] Deleted ${deleted} expired records`)
  return NextResponse.json({ ok: true, deleted })
}
