import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/require-auth'

function extractStoragePath(value: string): string | null {
  try {
    const parsed = new URL(value)
    const expectedHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname
    if (parsed.hostname !== expectedHost || parsed.protocol !== 'https:') return null

    const match = parsed.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/comprobantes\/(.+)$/)
    if (!match) return null
    const path = decodeURIComponent(match[1])
    if (!path || path.includes('..') || path.startsWith('/')) return null
    return path
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if ('response' in auth) return auth.response

  const value = new URL(request.url).searchParams.get('url')
  if (!value) return NextResponse.json({ error: 'URL requerida' }, { status: 400 })

  const path = extractStoragePath(value)
  if (!path) return NextResponse.json({ error: 'Comprobante no válido' }, { status: 400 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { data, error } = await sb.storage.from('comprobantes').createSignedUrl(path, 300)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'No se pudo abrir el comprobante' }, { status: 404 })
  }

  return NextResponse.redirect(data.signedUrl)
}
