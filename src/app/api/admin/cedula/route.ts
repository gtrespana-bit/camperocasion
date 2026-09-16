import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/require-auth'
import { rutaStorageValida } from '@/lib/storage-paths'

/**
 * Las solicitudes almacenan la ruta del objeto (no una URL pública). Aunque
 * este endpoint solo es administrativo, validamos la ruta para que la firma
 * nunca pueda apuntar a una clave anómala: `<user_id>/<archivo>`.
 */
const getSafeCedulaPath = (value: string | null) => rutaStorageValida(value, { minPartes: 2 })

/**
 * GET /api/admin/cedula?path=<uuid>/<archivo>
 *
 * Devuelve una URL firmada de vida corta para que el panel admin pueda revisar
 * documentos en el bucket privado `documentos-identidad` (alias legado
 * `cedulas`). La URL no se cachea ni se expone como URL pública permanente.
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
  // Canónico documentos-identidad, fallback cedulas para instalaciones antiguas
  let { data, error } = await sb.storage.from('documentos-identidad').createSignedUrl(path, 300)
  if (error || !data?.signedUrl) {
    const legado = await sb.storage.from('cedulas').createSignedUrl(path, 300)
    if (legado.data?.signedUrl) {
      data = legado.data
      error = null
    }
  }

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'No se pudo abrir el documento' }, { status: 404 })
  }

  return NextResponse.json(
    { signedUrl: data.signedUrl },
    { headers: { 'Cache-Control': 'no-store, private' } },
  )
}
