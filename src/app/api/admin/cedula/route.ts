import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/require-auth'

const UUID_FOLDER = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Las solicitudes almacenan la ruta del objeto (no una URL pública). Aunque
 * este endpoint solo es administrativo, validamos la ruta para que la firma
 * nunca pueda apuntar a una clave anómala.
 */
function getSafeCedulaPath(value: string | null): string | null {
  if (!value || value.length > 1_024 || value.includes('\0')) return null

  let decoded: string
  try {
    decoded = decodeURIComponent(value)
  } catch {
    return null
  }

  const parts = decoded.split('/')
  if (
    parts.length < 2
    || !UUID_FOLDER.test(parts[0])
    || parts.some(part => !part || part === '.' || part === '..')
  ) {
    return null
  }

  return parts.join('/')
}

/**
 * GET /api/admin/cedula?path=<uuid>/<archivo>
 *
 * Devuelve una URL firmada de vida corta para que el panel admin pueda revisar
 * documentos en el bucket privado `cedulas`. La URL no se cachea ni se expone
 * como URL pública permanente.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response

  const path = getSafeCedulaPath(new URL(request.url).searchParams.get('path'))
  if (!path) {
    return NextResponse.json({ error: 'Documento no válido' }, { status: 400 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { data, error } = await sb.storage.from('cedulas').createSignedUrl(path, 300)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'No se pudo abrir el documento' }, { status: 404 })
  }

  return NextResponse.json(
    { signedUrl: data.signedUrl },
    { headers: { 'Cache-Control': 'no-store, private' } },
  )
}
