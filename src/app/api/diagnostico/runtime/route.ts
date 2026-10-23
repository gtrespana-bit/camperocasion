/**
 * GET /api/diagnostico/runtime — ¿qué versión de Node.js ejecuta de verdad la función?
 *
 * ══════════════════════════════════════════════════════════════════════════
 * PARA QUÉ SIRVE
 * ══════════════════════════════════════════════════════════════════════════
 * `next build` puede ejecutarse con una versión de Node distinta de la que usa
 * el runtime de las funciones serverless. Cambiar la versión en Vercel no basta
 * para saber qué está corriendo: hay que preguntárselo al proceso en producción.
 *
 * Este endpoint responde con `process.versions.node` y si cumple el mínimo
 * exigido por `engines.node`. No toca la base de datos, no llama a terceros y no
 * devuelve ninguna variable de entorno sensible.
 *
 * Uso:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<dominio>/api/diagnostico/runtime
 * o abrir la URL en el navegador con sesión de admin iniciada.
 *
 * Referencia: https://github.com/nodejs/node/releases/tag/v24.22.1
 */
import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { getAdminEmails, getSessionUser } from '@/lib/require-auth'
import { leerRuntimeNode } from '@/lib/runtime-node'

// Siempre dinámico: la respuesta depende del proceso que atiende la petición.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function igualesSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

async function autorizado(request: NextRequest): Promise<boolean> {
  const cron = process.env.CRON_SECRET
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (cron && bearer && igualesSeguro(bearer, cron)) return true

  // La versión del runtime no es un secreto crítico, pero tampoco hace falta
  // publicarla: se exige sesión de un email de ADMIN_EMAILS.
  try {
    const user = await getSessionUser(request)
    if (user && getAdminEmails().includes((user.email || '').toLowerCase())) return true
  } catch {
    // sin sesión válida: no autorizado
  }

  return false
}

export async function GET(request: NextRequest) {
  if (!(await autorizado(request))) {
    return NextResponse.json(
      {
        ok: false,
        error: 'No autorizado',
        como: 'Inicia sesión como admin en el navegador o envía Authorization: Bearer <CRON_SECRET>.',
      },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const info = leerRuntimeNode()
  return NextResponse.json(
    {
      ok: info.cumple,
      runtime: info,
      veredicto: info.cumple
        ? `Node.js ${info.node}: cumple el mínimo ${info.minimo}.`
        : `Node.js ${info.node}: NO cumple el mínimo ${info.minimo}. Si estás en Vercel, el despliegue sigue con un runtime vulnerable: redespliega y, si persiste, escálalo al proveedor antes de dar el incidente por cerrado.`,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  )
}
