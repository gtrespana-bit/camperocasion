'use client'

import { createContext, useContext, useState, useEffect, useRef } from 'react'
import type { Session, User } from '@supabase/supabase-js'

type AuthContextType = {
  session: Session | null
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
})

export function AuthProvider({ children, initialUser }: { children: React.ReactNode; initialUser?: User | null }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(initialUser ?? null)
  const [loading, setLoading] = useState(true)
  const initialized = useRef(false)
  const initPromiseRef = useRef<Promise<void> | null>(null)
  // Último access token ya sincronizado con las cookies del servidor.
  // El navegador es el único que rota refresh tokens; tras cada rotación hay
  // que refrescar las cookies que lee el servidor (SSR / API routes) o se
  // produce el error `refresh_token_already_used` en los logs de Vercel.
  const lastSyncedTokenRef = useRef<string | null>(null)

  const syncServerSession = (s: Session | null) => {
    if (!s?.access_token || !s?.refresh_token) return
    if (lastSyncedTokenRef.current === s.access_token) return
    lastSyncedTokenRef.current = s.access_token
    fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token }),
      keepalive: true,
    })
      .then((res) => {
        // 409 = el servidor lo rechazó por estar a punto de expirar; el próximo
        // TOKEN_REFRESHED traerá uno fresco, así que permitimos reintentar.
        if (!res.ok && lastSyncedTokenRef.current === s.access_token) {
          lastSyncedTokenRef.current = null
        }
      })
      .catch(() => {
        if (lastSyncedTokenRef.current === s.access_token) {
          lastSyncedTokenRef.current = null
        }
      })
  }

  const clearServerSession = () => {
    if (!lastSyncedTokenRef.current) return
    lastSyncedTokenRef.current = null
    fetch('/api/auth/logout', { method: 'POST', keepalive: true }).catch(() => {})
  }

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    let unsub: (() => void) | null = null
    let cancelled = false

    const initAuth = async () => {
      try {
        const { isSupabaseConfigured } = await import('@/lib/supabase')
        if (!isSupabaseConfigured()) {
          if (!cancelled) {
            setSession(null)
            setUser(null)
            setLoading(false)
          }
          return
        }

        const { supabase } = await import('@/lib/supabase')

        // Then check current session FIRST (before listening for changes)
        try {
          const { data: sessionData, error } = await supabase.auth.getSession()
          if (cancelled) return
          if (!error && sessionData.session) {
            setSession(sessionData.session)
            setUser(sessionData.session.user)
            // Alinear las cookies del servidor con la sesión local existente
            syncServerSession(sessionData.session)
          }
        } catch {
          // Ignore errors
        }

        // Listen for auth changes AFTER getting initial session
        const { data } = supabase.auth.onAuthStateChange((event, s) => {
          if (cancelled) return
          // Mantener las cookies del servidor alineadas con la sesión del
          // navegador (único dueño del refresh token). Sin esto, el servidor
          // lee refresh tokens viejos → `refresh_token_already_used`.
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
            syncServerSession(s)
          }
          // Fase 3: al cerrar sesión, limpiar caches privadas para evitar fuga en dispositivo compartido
          if (event === 'SIGNED_OUT') {
            // Borrar también las cookies de sesión del servidor
            clearServerSession()
            try {
              // Limpiar Cache Storage del SW
              if (typeof window !== 'undefined' && 'caches' in window) {
                caches.keys().then(keys => {
                  keys.forEach(k => {
                    if (k.startsWith('vendet-')) {
                      caches.delete(k)
                    }
                  })
                })
              }
              // Notificar al SW activo para que borre todo
              if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
                navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_PRIVATE_CACHE' })
              }
              // Limpiar sessionStorage usado por ChatPage
              if (typeof sessionStorage !== 'undefined') {
                sessionStorage.clear()
              }
            } catch {
              // ignore
            }
          }
          setSession(s)
          setUser(s?.user ?? null)
          setLoading(false)
        })
        unsub = data.subscription.unsubscribe

        // Also check if server passed a user (hydration consistency)
        if (initialUser && !session) {
          setUser(initialUser)
        }

        if (!cancelled) {
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    initAuth()

    return () => {
      cancelled = true
      unsub?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- session is intentionally omitted; we only want to check once on mount
  }, [initialUser])

  return (
    <AuthContext.Provider value={{ session, user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
