import { createClient } from '@supabase/supabase-js'

/**
 * Cliente con la clave de servicio. Vive en su propio módulo para que
 * `planes-servidor` y `equipo` puedan usarlo sin depender el uno del otro.
 */
export function sbAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
