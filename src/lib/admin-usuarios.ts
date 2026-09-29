/**
 * Emails de usuarios para el panel admin.
 *
 * `perfiles` no guarda el email: vive en `auth.users` y solo se puede leer con
 * service_role. Varias pestañas del panel necesitan el mismo mapa id → email
 * (Usuarios, Planes y cupones, Resumen de packs), así que la paginación vive
 * aquí y no duplicada en cada endpoint.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const PER_PAGE = 200
const MAX_PAGINAS = 10

/**
 * Devuelve un mapa `id → email`. Con `ids` solo guarda los que interesan (el
 * resto se ignora en cuanto se lee, que es lo caro de `listUsers`).
 */
export async function mapaEmailsDeUsuarios(
  sb: SupabaseClient,
  ids?: Iterable<string>,
): Promise<Map<string, string>> {
  const interesantes = ids ? new Set(ids) : null
  const mapa = new Map<string, string>()
  for (let page = 1; page <= MAX_PAGINAS; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error) {
      console.error('Error listando auth.users:', error.message)
      break
    }
    const usuarios = data?.users || []
    for (const u of usuarios) {
      if (!u.id || !u.email) continue
      if (interesantes && !interesantes.has(u.id)) continue
      mapa.set(u.id, u.email)
    }
    if (usuarios.length < PER_PAGE) break
  }
  return mapa
}
