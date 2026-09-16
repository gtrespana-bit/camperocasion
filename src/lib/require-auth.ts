/**
 * Helper de autorización para API routes (Fase 1 de seguridad).
 *
 * Principios:
 * - La sesión se lee SIEMPRE de las cookies del request (nunca de IDs enviados en el body).
 * - getUser() verifica el JWT contra Supabase (no confía en el token a ciegas).
 * - El rol admin se define por email vía variable de entorno ADMIN_EMAILS (separada por comas),
 *   con fallback al email original para no romper el despliegue existente.
 *
 * Solo usar en server (API routes). No importar desde componentes cliente.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequestCookies } from '@/lib/supabase-server'

const DEFAULT_ADMIN_EMAILS = 'gtrespana@gmail.com'

/** Lista de emails con permisos de administrador (desde env, con fallback). */
export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAILS
  return raw
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Devuelve el usuario autenticado y verificado (valida el JWT con Supabase)
 * o null si no hay sesión válida.
 *
 * IMPORTANTE: aquí NO se usa `supabase.auth.getUser()` sin jwt porque en
 * supabase-js, cuando la sesión de la cookie está expirada, dispara un
 * refresh implícito (`__loadSession` → `_callRefreshToken`) que rota el
 * refresh token que el navegador ya está usando → error
 * `refresh_token_already_used` (los [warn] repetidos en los logs de Vercel).
 * El navegador es el único que refresca; el servidor solo valida.
 */
export async function getSessionUser(request: NextRequest): Promise<any | null> {
  return getUserFromRequestCookies(request.cookies.getAll())
}

/** Exige sesión activa. Devuelve { user } o una respuesta 401 lista para retornar. */
export async function requireUser(
  request: NextRequest
): Promise<{ user: any } | { response: NextResponse }> {
  const user = await getSessionUser(request)
  if (!user) {
    return { response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }
  return { user }
}

/** Exige sesión activa Y email de administrador. Devuelve { user } o 401/403. */
export async function requireAdmin(
  request: NextRequest
): Promise<{ user: any } | { response: NextResponse }> {
  const user = await getSessionUser(request)
  if (!user) {
    return { response: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }
  if (!getAdminEmails().includes((user.email || '').toLowerCase())) {
    return {
      response: NextResponse.json({ error: 'No tienes permisos de administrador' }, { status: 403 }),
    }
  }
  return { user }
}

/** True si la sesión actual pertenece a un admin (para lógica owner-o-admin). */
export async function isAdminUser(request: NextRequest): Promise<boolean> {
  const user = await getSessionUser(request)
  if (!user) return false
  return getAdminEmails().includes((user.email || '').toLowerCase())
}
