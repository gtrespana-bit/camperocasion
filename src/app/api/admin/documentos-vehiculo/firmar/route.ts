import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/require-auth'
import { rutaDocumentoVehiculoValida } from '@/lib/storage-paths'

const BUCKET = 'documentos-vehiculo'

/**
 * GET /api/admin/documentos-vehiculo/firmar?path=<user_id>/<producto_id>/<archivo>
 *
 * Devuelve una URL firmada de vida corta (5 min) para que el panel admin abra
 * un documento del expediente. El bucket es privado y la ruta se valida antes
 * de firmar, igual que en `/api/admin/cedula`.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response

  const path = rutaDocumentoVehiculoValida(new URL(request.url).searchParams.get('path'))
  if (!path) {
    return NextResponse.json({ error: 'Documento no válido' }, { status: 400 })
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 300)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'No se pudo abrir el documento' }, { status: 404 })
  }

  return NextResponse.json(
    { signedUrl: data.signedUrl },
    { headers: { 'Cache-Control': 'no-store, private' } },
  )
}
