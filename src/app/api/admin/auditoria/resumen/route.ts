import { NextRequest, NextResponse } from 'next/server'
import { obtenerResumenAuditoria } from '@/lib/auditoria'
import { requireAdmin } from '@/lib/require-auth'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req)
    if ('response' in auth) return auth.response

    const { searchParams } = new URL(req.url)
    const dias = parseInt(searchParams.get('dias') || '7')

    const resumen = await obtenerResumenAuditoria(dias)

    return NextResponse.json({
      ok: true,
      ...resumen
    })
  } catch (e: any) {
    console.error('Error en resumen auditoria:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
