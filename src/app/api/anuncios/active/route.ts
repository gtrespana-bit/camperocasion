import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { esErrorDeCredenciales, esErrorDeRed } from '@/lib/supabase-diagnostico'

/**
 * Anuncio global activo (público).
 *
 * Solo expone el banner vigente (activo y no expirado). La lectura usa
 * service_role para mantener el endpoint de solo lectura y evitar exponer
 * escrituras; el público no necesita autenticarse.
 *
 * ⚠️ Degradación intencionada: un banner es lo último que debe romper una
 * página. Si las credenciales de Supabase están mal (clave rotada, caducada o
 * de otro proyecto) la respuesta de Supabase es `401 Invalid API key` y antes
 * eso se propagaba como 500, ensuciando los logs y la consola del navegador en
 * cada carga de página. Ahora se registra una vez en el servidor, con un
 * prefijo fácil de filtrar, y se responde "sin banner" (200): el resto del
 * sitio sigue funcionando igual.
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

      // Sin respuesta de Supabase (red caída, DNS, timeout): transitorio, no
      // es un fallo de este endpoint. Se avisa y se sigue sin banner.
      if (esErrorDeRed(error)) {
        console.error(
          `[supabase-red] /api/anuncios/active: sin respuesta de Supabase: ${error.message}`,
        )
        return NextResponse.json({ ok: true, anuncio: null })
      }

      // Credenciales inválidas/caducadas: NO es un 500 del banner, es un
      // problema de configuración del despliegue. Se avisa una vez y se sigue.
      if (esErrorDeCredenciales(error)) {
        console.error(
          '[supabase-credenciales] /api/anuncios/active: Supabase rechazó la clave ' +
            `(service_role): ${error.message}. Revisa SUPABASE_SERVICE_ROLE_KEY en Vercel ` +
            'o abre /api/diagnostico/supabase?token=<CRON_SECRET>.',
        )
        return NextResponse.json({ ok: true, anuncio: null })
      }

      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const ahora = new Date().toISOString()
    const anuncio = (data || []).find((a) => !a.expira_en || a.expira_en >= ahora) || null

    return NextResponse.json({ ok: true, anuncio })
  } catch {
    return NextResponse.json({ ok: true, anuncio: null })
  }
}
