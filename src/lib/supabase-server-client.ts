import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase LIGERO para Server Components (lectura de datos públicos).
 *
 * ⚠️ POR QUÉ EXISTE:
 * Los Server Components (home, catálogo, landings, sitemap, producto, vendedor)
 * hacían `import { supabase } from '@/lib/supabase'`, que es el cliente de
 * NAVEGADOR con `persistSession: true` + `autoRefreshToken: true`. Al
 * ejecutarse en el servidor durante el build/ISR eso creaba una instancia de
 * GoTrueClient con gestión de sesión/refresh innecesaria para solo leer datos
 * públicos (RLS permite lectura anónima).
 *
 * Este cliente:
 * - Desactiva `persistSession` y `autoRefreshToken` → cero timers de refresh,
 *   cero lectura de storage, cero riesgo de rotar refresh tokens en el server
 *   (mismo modelo de "propiedad única" que src/lib/supabase-server.ts).
 * - Es un singleton, igual que el del navegador, para no multiplicar instancias.
 * - Se usa SOLO en componentes/páginas de servidor. Los componentes de cliente
 *   siguen importando @/lib/supabase (necesitan la sesión real).
 */
let globalServerSupabase: ReturnType<typeof createClient> | null = null

export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  if (!globalServerSupabase) {
    globalServerSupabase = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }
  return globalServerSupabase as any
}

// Exportación por defecto para compatibilidad con el patrón `import { supabase }`.
export const supabase = getSupabaseServerClient()
