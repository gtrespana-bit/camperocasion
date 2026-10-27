/**
 * Rate limiter distribuido y atómico usando Supabase como storage.
 *
 * La decisión y el registro se realizan en una única RPC SQL protegida por un
 * advisory lock por (key, identifier). Esto evita que peticiones concurrentes
 * salten el límite entre el COUNT y el INSERT.
 *
 * Algunas operaciones sensibles (publicar, importar, registrar cuentas) usan
 * además un SEGUNDO bucket por IP: `check_rate_limit_dual()` decide los dos en
 * la misma transacción. Sin él, crear N cuentas desde la misma IP burlaba el
 * límite por usuario. Ver migración 202610270002_rate_limit_compuesto.sql.
 */
import { createClient } from '@supabase/supabase-js'

export const LIMITS: Record<string, { max: number; windowMs: number }> = {
  'producto:create': { max: 20, windowMs: 60 * 60 * 1000 },
  // Importación CSV: cada intento sube hasta 100 anuncios, así que el límite
  // es mucho más bajo que el de publicar a mano.
  'producto:importar': { max: 6, windowMs: 60 * 60 * 1000 },
  'mensaje:create': { max: 200, windowMs: 60 * 60 * 1000 },
  'denuncia:create': { max: 10, windowMs: 60 * 60 * 1000 },
  'auth:login': { max: 5, windowMs: 15 * 60 * 1000 },
  'creditos:comprar': { max: 12, windowMs: 60 * 60 * 1000 },
  'planes:checkout': { max: 12, windowMs: 60 * 60 * 1000 },
  'auth:register': { max: 3, windowMs: 60 * 60 * 1000 },
  'auth:reconfirmar': { max: 3, windowMs: 60 * 60 * 1000 },
  // `auth:reset` es el nombre histórico; la ruta usa `auth:password-reset`.
  // Mantener los dos evita que un typo deje el endpoint SIN límite: antes
  // `checkRateLimit` devolvía ok:true para claves desconocidas.
  'auth:reset': { max: 5, windowMs: 60 * 60 * 1000 },
  'auth:password-reset': { max: 5, windowMs: 60 * 60 * 1000 },
  'contacto:send': { max: 10, windowMs: 60 * 60 * 1000 },
  'conversacion:create': { max: 20, windowMs: 60 * 60 * 1000 },
  'favorito:toggle': { max: 100, windowMs: 60 * 60 * 1000 },
  'foto-perfil:update': { max: 10, windowMs: 60 * 60 * 1000 },
  // Editar el escaparate de la tienda: generoso (el vendedor ajusta textos
  // varias veces seguidas) pero acotado, porque cada cambio escribe en perfiles.
  'perfil:actualizar': { max: 40, windowMs: 60 * 60 * 1000 },
  // Valorador público (sin sesión): generoso para que nadie con dudas se
  // quede fuera, pero acotado para que no se use como API de scraping.
  'valorar': { max: 30, windowMs: 60 * 60 * 1000 },
  'storage-upload': { max: 50, windowMs: 60 * 60 * 1000 },
  'documento-vehiculo:upload': { max: 30, windowMs: 60 * 60 * 1000 },
  'reserva:create': { max: 10, windowMs: 24 * 60 * 60 * 1000 },
  'reserva:comprobante': { max: 15, windowMs: 24 * 60 * 60 * 1000 },
  'r2-upload': { max: 50, windowMs: 60 * 60 * 1000 },
  'telegram:webhook': { max: 120, windowMs: 60 * 60 * 1000 },
  'notificacion:send': { max: 20, windowMs: 60 * 60 * 1000 },
  // Claves que las rutas ya usaban y que antes caían en el "ok:true" sin límite.
  'admin:email-test': { max: 10, windowMs: 60 * 60 * 1000 },
  'gestoria:lead': { max: 10, windowMs: 60 * 60 * 1000 },
  'inspeccion:create': { max: 10, windowMs: 60 * 60 * 1000 },
  'planes:portal': { max: 20, windowMs: 60 * 60 * 1000 },
  'planes:prueba': { max: 10, windowMs: 60 * 60 * 1000 },
}

/**
 * Límites por IP para las claves donde el identificador es una cuenta.
 * Generosos a propósito: detrás de una IP puede haber una oficina, un colegio
 * o una torre móvil entera (CGNAT). El cupo de anuncios por plan sigue siendo
 * la defensa de fondo; esto solo frena el spam multi-cuenta automatizado.
 */
export const LIMITES_IP: Record<string, number> = {
  'producto:create': 60,   // 3 × el límite por usuario
  'producto:importar': 18, // 3 × el límite por usuario
  'auth:register': 15,     // 5 × el límite por email
}

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/**
 * Normaliza la IP que llega en las cabeceras del proxy.
 * `x-forwarded-for` puede ser una cadena de IPs (o venir con puerto); solo nos
 * interesa la primera. Devuelve null para valores inútiles, y en ese caso no
 * se aplica el bucket de IP (mejor eso que agrupar a todo el mundo en
 * "unknown").
 */
export function normalizarIp(ip?: string | null): string | null {
  if (!ip) return null
  let valor = ip.split(',')[0]?.trim().toLowerCase()
  if (!valor || valor === 'unknown' || valor === 'undefined') return null
  const conPuerto = /^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/.exec(valor)
  if (conPuerto) valor = conPuerto[1]
  return valor.slice(0, 200)
}

export function getClientIp(request: Request): string {
  // Vercel reescribe `x-vercel-forwarded-for` con la IP real; en
  // `x-forwarded-for` el cliente puede añadir valores. Prioridad a la
  // cabecera de la plataforma y, en cualquier caso, solo la primera IP.
  const dePlataforma = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
  const deProxy = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const real = request.headers.get('x-real-ip')?.trim()
  return dePlataforma || deProxy || real || 'unknown'
}

export function rateLimitResponse(resetIn: number): Response {
  return Response.json({ error: `Demasiadas solicitudes. Intenta de nuevo en ${Math.max(1, Math.ceil(resetIn / 60000))} min` }, { status: 429 })
}

export async function checkRateLimit(
  key: string,
  identifier: string,
  extraData?: { ip?: string },
): Promise<{ ok: boolean; remaining: number; resetIn: number; limit: number }> {
  const limit = LIMITS[key]
  if (!limit) {
    // Antes una clave sin configurar devolvía ok:true (sin límite). Un typo en
    // una ruta nueva dejaba el endpoint desprotegido en silencio: fallar cerrado
    // y dejar rastro en logs es mucho más seguro.
    console.error('[rate-limit] clave sin límite configurado; se bloquea la petición:', key)
    return { ok: false, remaining: 0, resetIn: 60_000, limit: 1 }
  }

  try {
    const ip = normalizarIp(extraData?.ip)
    const limiteIp = LIMITES_IP[key]
    const compuesto = Boolean(ip && limiteIp)
    const params: Record<string, unknown> = {
      p_key: key,
      p_identifier: identifier,
      p_ip: ip,
      p_limit: limit.max,
      p_window_ms: limit.windowMs,
    }
    if (compuesto) params.p_ip_limit = limiteIp

    const { data, error } = await getSupabaseClient().rpc(
      compuesto ? 'check_rate_limit_dual' : 'check_rate_limit_atomic',
      params,
    )

    if (error || !data || typeof data.ok !== 'boolean') {
      console.error('Atomic rate limit RPC error:', error?.message || 'invalid response')
      // Sensitive endpoints must fail closed if the limiter is unavailable.
      return { ok: false, remaining: 0, resetIn: 60_000, limit: limit.max }
    }

    return {
      ok: data.ok === true,
      remaining: Number(data.remaining) || 0,
      resetIn: Math.max(0, Number(data.resetIn) || 0),
      limit: Number(data.limit) || limit.max,
    }
  } catch (error) {
    console.error('Atomic rate limit check error:', error)
    return { ok: false, remaining: 0, resetIn: 60_000, limit: limit.max }
  }
}

export async function cleanOldRateLimits(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const sb = getSupabaseClient()
  const { count, error } = await sb
    .from('rate_limit')
    .delete()
    .lt('created_at', cutoff)

  if (error) {
    console.error('Rate limit cleanup error:', error)
    return 0
  }

  return count || 0
}
