import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { decodeJwtExp } from '@/lib/supabase-cookies'

/**
 * POST /api/auth/session
 *
 * Sincroniza la sesión del navegador (que vive en localStorage y es el ÚNICO
 * lugar donde se rotan refresh tokens) hacia las cookies http que lee el
 * servidor (SSR, API routes). El AuthProvider llama a este endpoint en cada
 * SIGNED_IN / TOKEN_REFRESHED.
 *
 * Regla de seguridad crítica: `supabase.auth.setSession()` hace un REFRESH si
 * el access token recibido está expirado (o a punto). Un refresh aquí robaría
 * la rotación al navegador y rompería las dos sesiones
 * (`refresh_token_already_used`). Por eso rechazamos tokens que expiren en
 * menos de 60s: el cliente reintentará con el token fresco del siguiente
 * TOKEN_REFRESHED.
 */

/** Margen mínimo de vida del access token para aceptarlo sin riesgo de refresh. */
const MIN_TOKEN_TTL_MS = 60_000

export async function POST(req: NextRequest) {
  try {
    let body: any
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
    }

    const { access_token, refresh_token } = body ?? {}
    if (
      typeof access_token !== 'string' ||
      typeof refresh_token !== 'string' ||
      !access_token ||
      !refresh_token ||
      access_token.length > 8192 ||
      refresh_token.length > 2048
    ) {
      return NextResponse.json({ error: 'tokens requeridos' }, { status: 400 })
    }

    // No sincronizar tokens viejos: setSession los refrescaría en el servidor
    // y consumiría el refresh token que pertenece al navegador.
    const exp = decodeJwtExp(access_token)
    if (!exp || exp * 1000 - Date.now() < MIN_TOKEN_TTL_MS) {
      return NextResponse.json({ error: 'token_caducado', retry: true }, { status: 409 })
    }

    let responseCookies: Array<{ name: string; value: string; options?: Record<string, any> }> = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll(cookiesToSet) {
            responseCookies = cookiesToSet
          },
        },
      }
    )

    // Con un access token fresco, setSession SOLO valida (GET /auth/v1/user)
    // y persiste la sesión en cookies — sin rotar el refresh token.
    const { error } = await supabase.auth.setSession({ access_token, refresh_token })
    if (error) {
      return NextResponse.json({ error: 'sesión inválida', retry: true }, { status: 409 })
    }

    const response = NextResponse.json({ ok: true })
    responseCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options)
    })

    // Nunca cachear: la respuesta lleva Set-Cookie.
    response.headers.set('Cache-Control', 'no-store')

    return response
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'error interno' }, { status: 500 })
  }
}
