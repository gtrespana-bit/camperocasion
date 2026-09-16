/**
 * Helpers puros (sin dependencias de Next) para leer la cookie de sesión
 * que escribe @supabase/ssr (`sb-<project-ref>-auth-token`).
 *
 * Formato real (verificado contra @supabase/ssr 0.5.x):
 * - El valor es el JSON de la sesión (access_token, refresh_token, ...).
 * - Con cookieEncoding "base64url" (default), el valor se guarda como
 *   `base64-<base64url(json)>`.
 * - Si es muy largo, se parte en chunks: `<key>.0`, `<key>.1`, ...
 *
 * Se usa para leer el access token SIN crear un cliente de Supabase que
 * pueda disparar un refresh (el servidor nunca debe rotar refresh tokens;
 * eso es exclusivo del navegador).
 */

export function getSupabaseProjectRef(url?: string): string | null {
  try {
    const supabaseUrl = url || process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) return null
    return new URL(supabaseUrl).hostname.split('.')[0] || null
  } catch {
    return null
  }
}

/** Nombre de la cookie de auth de @supabase/ssr (sin chunks). */
export function getAuthCookieName(): string | null {
  const ref = getSupabaseProjectRef()
  return ref ? `sb-${ref}-auth-token` : null
}

/** Decodifica base64url → string UTF-8. Compatible Node/Edge (sin Buffer). */
function base64UrlDecode(input: string): string {
  let b64 = input.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  const bin = atob(b64)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

/** Escapa caracteres especiales para usar un string dentro de RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Reconstruye el valor completo de la cookie de auth a partir de una lista
 * de cookies (soporta cookie única o chunks `.0`, `.1`, ... ordenados).
 */
export function readAuthCookieValue(
  cookieList: Array<{ name: string; value: string }>
): string | null {
  const key = getAuthCookieName()
  if (!key) return null

  const direct = cookieList.find((c) => c.name === key)
  if (direct?.value) return direct.value

  const chunkRe = new RegExp(`^${escapeRegExp(key)}\\.(0|[1-9][0-9]*)$`)
  const chunks = cookieList
    .filter((c) => chunkRe.test(c.name))
    .sort(
      (a, b) =>
        parseInt(a.name.slice(a.name.lastIndexOf('.') + 1), 10) -
        parseInt(b.name.slice(b.name.lastIndexOf('.') + 1), 10)
    )
  if (chunks.length === 0) return null
  return chunks.map((c) => c.value).join('')
}

/** Decodifica el claim `exp` de un JWT (sin verificar firma). Null si es inválido. */
export function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(base64UrlDecode(parts[1]))
    return typeof payload?.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

/**
 * Extrae el access token JWT de las cookies de sesión de @supabase/ssr.
 * Devuelve null si no hay cookie o está malformada. Nunca lanza.
 */
export function extractAccessTokenFromCookies(
  cookieList: Array<{ name: string; value: string }>
): string | null {
  try {
    const raw = readAuthCookieValue(cookieList)
    if (!raw) return null
    let decoded = raw
    if (raw.startsWith('base64-')) {
      decoded = base64UrlDecode(raw.slice('base64-'.length))
    } else if (raw.includes('%')) {
      // Compatibilidad con cookies de versiones viejas de @supabase/ssr que
      // guardaban el JSON URL-encoded (ojalá transitorias tras un re-login).
      try {
        decoded = decodeURIComponent(raw)
      } catch {
        // dejar como está; el JSON.parse siguiente fallará y devolverá null
      }
    }
    const session = JSON.parse(decoded)
    return typeof session?.access_token === 'string' && session.access_token
      ? session.access_token
      : null
  } catch {
    return null
  }
}
