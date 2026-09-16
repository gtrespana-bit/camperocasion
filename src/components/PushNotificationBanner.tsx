'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { Bell, X } from 'lucide-react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

/**
 * Hook para push notifications en la PWA.
 * Solo debe usarse dentro de AuthProvider.
 */
function usePushNotification() {
  const { user } = useAuth()
  const [enabled, setEnabled] = useState(false)
  const [supported, setSupported] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const swReady = 'serviceWorker' in navigator && 'PushManager' in window
    setSupported(swReady && 'Notification' in window)
    if (swReady) {
      // On iOS PWA, Notification.permission can be 'default' even when
      // the user already granted it at the system level. Check for an
      // existing push subscription as ground truth.
      if (Notification.permission === 'granted') {
        setEnabled(true)
      } else {
        // Fix: Add timeout to prevent hanging promises that block Lighthouse
        const swReadyTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('SW ready timeout')), 3000)
        );
        
        Promise.race([
          navigator.serviceWorker.ready,
          swReadyTimeout
        ]).then(async (reg: any) => {
          const existing = await reg.pushManager.getSubscription()
          if (existing) setEnabled(true)
        }).catch(() => {})
      }
    }
  }, [])

  async function enable() {
    if (!supported || !user) return false
    try {
      setLoading(true)
// debug
      setError(null)

      if (!VAPID_PUBLIC) {
        setError('Config: VAPID key no configurada')
        return false
      }

      // 1. Request permission
      const permission = await Notification.requestPermission()
// debug

      // Chrome requires explicit 'granted'. On iOS PWA, it can return
      // 'default' even when granted at system level, so we handle it there
      // by checking existing subscriptions. Here we need the real 'granted'.
      if (permission !== 'granted') {
        setError('No se concedió el permiso de notificaciones. Actívalo manualmente en la configuración del sitio.')
        return false
      }

      // 2. Get service worker registration (with timeout to prevent hanging)
      const swReadyTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('SW ready timeout')), 3000)
      );
      
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        swReadyTimeout
      ]) as ServiceWorkerRegistration;
// debug

      // 3. Subscribe to push
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
      })
// debug

      // 4. Check session. Importar Supabase aquí evita cargar el cliente de
      // Supabase/push en el bundle inicial de todas las páginas.
      const { supabase } = await import('@/lib/supabase')
      const { data } = await supabase.auth.getSession()
// debug
      if (!data.session) {
        setError('Sesión: inicia sesión de nuevo')
        return false
      }

      // 5. Send to backend
      const res = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify({ subscription }),
      })
// debug

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(`Error: ${body.error || 'HTTP ' + res.status}`)
        return false
      }

      setEnabled(true)
      setError(null)
      return true
    } catch (e: any) {
      console.error('[Push] Error:', e)
      const msg = e?.message || String(e)
      setError(msg.length > 100 ? msg.slice(0, 100) + '…' : msg)
      return false
    } finally {
      setLoading(false)
    }
  }

  return { enabled, supported, enable, loading, error }
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64Str = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64Str)
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)))
}

export default function PushNotificationBanner() {
  const { user } = useAuth()
  const { supported, enabled, enable, loading, error } = usePushNotification()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!user) return
    if (!supported) return
    if (enabled) return

    const dismissedAt = localStorage.getItem('push_banner_dismissed')
    if (dismissedAt) {
      const hoursSince = (Date.now() - parseInt(dismissedAt)) / 3600000
      if (hoursSince < 24) return
    }

    const timer = setTimeout(() => setVisible(true), 5000)
    return () => clearTimeout(timer)
  }, [user, supported, enabled])

  if (!visible || !user) return null

  function handleDismiss() {
    setVisible(false)
    localStorage.setItem('push_banner_dismissed', Date.now().toString())
  }

  async function handleEnable() {
    const ok = await enable()
    if (ok) handleDismiss()
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 md:bottom-8 md:left-auto md:right-8 md:w-96 z-40">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 relative">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-100 text-gray-500 transition"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Bell size={20} className="text-brand-primary" />
          </div>

          <div className="flex-1">
            <p className="font-bold text-gray-900 text-sm">No te pierdas nada</p>
            <p className="text-xs text-gray-500 mt-0.5 mb-3">
              Recibe notificaciones cuando te escriban, guardes un producto o aparezca algo que buscas.
            </p>

            <button
              onClick={handleEnable}
              disabled={loading}
              className="w-full bg-brand-primary text-white py-2.5 rounded-xl font-bold text-sm hover:bg-brand-dark transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Bell size={14} />
              {loading ? 'Activando...' : 'Activar notificaciones'}
            </button>

            {error && (
              <p className="text-xs text-red-500 mt-2 text-center">{error}</p>
            )}

            <p className="text-[10px] text-gray-500 text-center mt-2">
              Puedes desactivarlas cuando quieras
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
