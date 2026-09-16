import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'

// Devuelve perfiles por user_id usando el client de supabase server-side con anon key
// (Supabase client-side con session del usuario autenticado respeta RLS)
export async function GET(req: Request) {
  // Exige sesión: antes cualquiera podía scrapear perfiles (nombre + foto)
  // en lotes sin límite.
  const auth = await requireUser(req as any)
  if ('response' in auth) return auth.response

  const { searchParams } = new URL(req.url)
  const ids = searchParams.get('ids')?.split(',') || []
  if (ids.length === 0) return NextResponse.json({ profiles: [] })

  // Usar el servicio de Supabase que crea el cliente de supabase con la key de service role
  const { createClient } = await import('@supabase/supabase-js')
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data, error } = await supabaseAdmin
    .from('perfiles')
    .select('id, nombre, foto_perfil_url')
    .in('id', ids)

  if (error) {
    console.error('[user-bulk] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profiles: data || [] })
}
