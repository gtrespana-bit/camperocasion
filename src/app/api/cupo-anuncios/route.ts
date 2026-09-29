import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { cupoDeUsuario } from '@/lib/planes-servidor'

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if ('response' in auth) return auth.response
  const { resumen } = await cupoDeUsuario(auth.user.id)
  return NextResponse.json({ ok: true, ...resumen })
}
