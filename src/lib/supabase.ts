import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Patrón Singleton estricto para evitar múltiples instancias de GoTrueClient
//
// MODELO DE PROPIEDAD DEL REFRESH TOKEN (importante — fix refresh_token_already_used):
// - ESTE cliente del navegador es el ÚNICO de toda la app que rota refresh
//   tokens (autoRefreshToken: true, sesión en localStorage).
// - El servidor NUNCA refresca: solo valida access tokens (ver
//   src/lib/supabase-server.ts y src/lib/require-auth.ts).
// - Tras cada rotación, AuthProvider sincroniza las cookies del servidor
//   llamando a POST /api/auth/session.
// - NO crear otros clientes con persistSession/autoRefreshToken activos con el
//   mismo storageKey: dos GoTrueClient compitiendo por el mismo refresh token
//   producen el error `Invalid Refresh Token: Already Used` y deslogueos.
let globalSupabase: ReturnType<typeof createClient> | null = null

// Cliente estándar con persistencia de sesión (para consultas de datos y mantener estado de autenticación)
export const getSupabaseClient = () => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase no está configurado: faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  if (!globalSupabase) {
    globalSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,  // Activar persistencia para mantener sesión entre recargas
        autoRefreshToken: true,  // Activar refresh automático para mantener sesión válida
        detectSessionInUrl: true,  // Habilitar detección de sesión en URL para casos de OAuth
        storageKey: 'sb-auth-token',
        flowType: 'pkce'
      }
    })
  }
  return globalSupabase as any
}

// Exportación por defecto para compatibilidad con el código existente.
// Importante: no instanciamos Supabase durante la evaluación del módulo. Las
// páginas client pueden prerenderizarse en el servidor y, si faltan variables
// en un entorno local/CI, crear el cliente aquí rompe el build completo.
export const supabase = new Proxy({} as any, {
  get(_target, prop) {
    const client = getSupabaseClient()
    const value = client[prop as keyof ReturnType<typeof createClient>]
    return typeof value === 'function' ? value.bind(client) : value
  },
})

export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseAnonKey
}
