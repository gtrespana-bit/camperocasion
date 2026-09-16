import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Anuncio global activo (público).
 *
 * Solo expone el banner vigente (activo y no expirado). La lectura usa
 * service_role para mantener el endpoint de solo lectura y evitar exponer
 * escrituras; el público no necesita autenticarse.
 */
export async function GET(_request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: true, anuncio: null })
    }
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data, error } = await sb
      .from('anuncios_globales')
      .select('id, titulo, mensaje, emoji, enlace, enlace_texto, expira_en')
      .eq('activo', true)
      .order('creado_en', { ascending: false })
      .limit(5)

    if (error) {
      // La tabla aún no existe: el sitio debe seguir funcionando sin banner.
      if (error.code === '42P01') return NextResponse.json({ ok: true, anuncio: null })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const ahora = new Date().toISOString()
    const anuncio = (data || []).find((a) => !a.expira_en || a.expira_en >= ahora) || null

    return NextResponse.json({ ok: true, anuncio })
  } catch {
    return NextResponse.json({ ok: true, anuncio: null })
  }
}
