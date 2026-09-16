/**
 * Rate limiter distribuido y atómico usando Supabase como storage.
 *
 * La decisión y el registro se realizan en una única RPC SQL protegida por un
 * advisory lock por (key, identifier). Esto evita que peticiones concurrentes
 * salten el límite entre el COUNT y el INSERT.
 */
import { createClient } from '@supabase/supabase-js'

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  'producto:create': { max: 20, windowMs: 60 * 60 * 1000 },
  'mensaje:create': { max: 200, windowMs: 60 * 60 * 1000 },
  'denuncia:create': { max: 10, windowMs: 60 * 60 * 1000 },
  'auth:login': { max: 5, windowMs: 15 * 60 * 1000 },
  'creditos:comprar': { max: 12, windowMs: 60 * 60 * 1000 },
  'auth:register': { max: 3, windowMs: 60 * 60 * 1000 },
  'auth:reconfirmar': { max: 3, windowMs: 60 * 60 * 1000 },
  'auth:reset': { max: 5, windowMs: 60 * 60 * 1000 },
  'contacto:send': { max: 10, windowMs: 60 * 60 * 1000 },
  'conversacion:create': { max: 20, windowMs: 60 * 60 * 1000 },
  'favorito:toggle': { max: 100, windowMs: 60 * 60 * 1000 },
  'foto-perfil:update': { max: 10, windowMs: 60 * 60 * 1000 },
  'storage-upload': { max: 50, windowMs: 60 * 60 * 1000 },
  'documento-vehiculo:upload': { max: 30, windowMs: 60 * 60 * 1000 },
  'r2-upload': { max: 50, windowMs: 60 * 60 * 1000 },
  'telegram:webhook': { max: 120, windowMs: 60 * 60 * 1000 },
  'notificacion:send': { max: 20, windowMs: 60 * 60 * 1000 },
}

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

export function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
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
  if (!limit) return { ok: true, remaining: 999, resetIn: 0, limit: 0 }

  try {
    const { data, error } = await getSupabaseClient().rpc('check_rate_limit_atomic', {
      p_key: key,
      p_identifier: identifier,
      p_ip: extraData?.ip || null,
      p_limit: limit.max,
      p_window_ms: limit.windowMs,
    })

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
