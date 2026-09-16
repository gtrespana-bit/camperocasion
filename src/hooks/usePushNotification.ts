'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Helpers ──

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export function getVapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null
}

export function usePushNotification() {
  const [enabled, setEnabled] = useState(false)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setSupported('serviceWorker' in navigator && 'PushManager' in window)
    setEnabled(Notification.permission === 'granted')
  }, [])

  /** Call this from a user gesture (button click) */
  async function enable() {
    if (!supported) return false

    try {
      // 1. Request permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return false

      // 2. Get service worker registration
      const reg = await navigator.serviceWorker.ready

      // 3. Subscribe to push
      const vapidKey = getVapidPublicKey()
      if (!vapidKey) throw new Error('VAPID public key not configured')
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      })

      // 4. Send to backend
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return false

      const res = await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ subscription }),
      })

      if (!res.ok) return false

      setEnabled(true)
      return true
    } catch (e) {
      console.error('Push enable error:', e)
      return false
    }
  }

  async function disable() {
    if (!supported) return
    try {
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription()
      if (subscription) await subscription.unsubscribe()
      setEnabled(false)
    } catch (e) {
      console.error('Push disable error:', e)
    }
  }

  return { enabled, supported, enable, disable }
}
