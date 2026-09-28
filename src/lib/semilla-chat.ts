// Solo servidor: el correo de destino nunca se envía al navegador.
import type { SupabaseClient } from '@supabase/supabase-js'
import { buscarUsuarioPorEmail } from './semilla-admin.js'

export async function destinatarioSemilla(sb: SupabaseClient, propietarioId: string): Promise<string> {
  const email = (process.env.SEMILLA_CHAT_EMAIL || 'gtrespana@gmail.com').trim().toLowerCase()
  // Defensa adicional: es_demo por sí solo no autoriza a desviar un anuncio real.
  const { data: owner, error: ownerError } = await sb.auth.admin.getUserById(propietarioId)
  if (ownerError || owner?.user?.app_metadata?.semilla !== true) {
    throw new Error('El propietario no es una cuenta de semilla')
  }
  const user = await buscarUsuarioPorEmail(sb, email)
  if (!user?.email_confirmed_at || user.app_metadata?.semilla === true ||
      (user.banned_until && new Date(user.banned_until).getTime() > Date.now())) {
    throw new Error('La cuenta de atención no está disponible o no está confirmada')
  }
  const { data: perfil, error } = await sb.from('perfiles').select('id, es_demo').eq('id', user.id).maybeSingle()
  if (error || !perfil || perfil.es_demo !== false) {
    throw new Error('La cuenta de atención no tiene un perfil real')
  }
  return user.id
}
