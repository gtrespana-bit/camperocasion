import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { extractAccessTokenFromCookies } from '@/lib/supabase-cookies'

/**
 * getServerUser seguro — Fase: fix "refresh_token_already_used"
 *
 * Contexto del bug:
 * - El navegador (src/lib/supabase.ts, supabase-js con autoRefreshToken) rota
 *   el refresh token cada ~1h y lo guarda en localStorage.
 * - Antes, este código creaba un createServerClient con las cookies reales y
 *   llamaba `supabase.auth.getUser()` SIN jwt. En supabase-js, cuando la sesión
 *   persistida (cookie) está expirada, `__loadSession()` llama a
 *   `_callRefreshToken()` SIN respetar `autoRefreshToken: false`, rotando el
 *   refresh token en el servidor. Además `setAll` era un no-op, así que las
 *   cookies nuevas se perdían y el refresh token viejo (ya invalidado por la
 *   rotación del navegador) se seguía usando → Supabase respondía
 *   `400 Invalid Refresh Token: Already Used` en cada page load (los [warn]
 *   repetidos en los logs de Vercel) y podía desloguear usuarios.
 *
 * Modelo corregido (propiedad única del refresh token):
 * - El NAVEGADOR es el único que rota refresh tokens.
 * - El SERVIDOR nunca refresca: solo valida el access token actual contra
 *   Supabase. `getUser(jwt)` con jwt explícito va directo a GET /auth/v1/user
 *   sin tocar el storage de cookies ni disparar refresh.
 * - El navegador mantiene las cookies frescas llamando a POST /api/auth/session
 *   en cada SIGNED_IN / TOKEN_REFRESHED (ver AuthProvider).
 */
export async function getServerUser(): Promise<any | null> {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return null
    }

    const cookieStore = await cookies()

    // Leer el access token de la cookie manualmente (sin crear sesión en storage).
    const accessToken = extractAccessTokenFromCookies(cookieStore.getAll())
    if (!accessToken) {
      return null
    }

    // Cliente con storage vacío a propósito: no hay sesión persistida que
    // recuperar, por lo que ningún path de código puede disparar un refresh.
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return []
          },
          setAll() {
            // El servidor nunca escribe cookies de auth desde un Server
            // Component. El navegador las mantiene vía /api/auth/session.
          },
        },
      }
    )

    // Validación con jwt explícito: NO pasa por el storage ni por _loadSession,
    // por tanto es imposible que dispare una rotación de refresh token.
    const result = await Promise.race([
      supabase.auth.getUser(accessToken),
      new Promise<{ data: { user: null }; error: Error }>((resolve) =>
        setTimeout(
          () => resolve({ data: { user: null }, error: new Error('getServerUser timeout') }),
          5000
        )
      ),
    ])

    if (result.error || !result.data?.user) {
      return null
    }

    return result.data.user
  } catch {
    return null
  }
}

/**
 * Versión para API/Route Handlers: valida el access token presente en las
 * cookies del request sin disparar refresh (mismo principio que getServerUser).
 */
export async function getUserFromRequestCookies(
  cookieList: Array<{ name: string; value: string }>
): Promise<any | null> {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return null
    }

    const accessToken = extractAccessTokenFromCookies(cookieList)
    if (!accessToken) {
      return null
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return []
          },
          setAll() {
            // no-op: solo lectura
          },
        },
      }
    )

    const { data, error } = await supabase.auth.getUser(accessToken)
    if (error || !data.user) {
      return null
    }
    return data.user
  } catch {
    return null
  }
}
