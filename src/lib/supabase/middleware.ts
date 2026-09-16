import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * ⚠️ NO USAR — mantenido solo como referencia.
 *
 * Actualmente NADA importa `updateSession` (ver src/middleware.ts, donde se
 * explica por qué se retiró del pipeline de Edge).
 *
 * Si se reactiva, ojo con el modelo de propiedad del refresh token:
 * el NAVEGADOR (src/lib/supabase.ts) es el único de la app que rota refresh
 * tokens y AuthProvider sincroniza las cookies vía POST /api/auth/session.
 * Reactivar un refresher en el servidor/middleware sin desactivar el
 * autoRefresh del navegador reintroduce el error
 * `Invalid Refresh Token: Already Used` (los [warn] de AuthApiError en los
 * logs de Vercel) y deslogueos aleatorios de usuarios.
 */
export async function updateSession(request: NextRequest, response?: NextResponse) {
  let supabaseResponse = response ?? NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the auth session and fetch user data with timeout to prevent blocking
  try {
    // Set a reasonable timeout to prevent middleware from blocking too long
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase auth timeout')), 3000))
    ]);

    clearTimeout(timeoutId);
  } catch (error) {
    // Log error but don't fail the request - auth is not critical for page load
    console.warn('Supabase auth getUser timeout or error:', error);
  }

  return supabaseResponse
}
