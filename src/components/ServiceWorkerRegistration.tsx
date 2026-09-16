'use client'

import { useEffect } from 'react'

/**
 * Registers the focused Service Worker used for push notifications and a
 * public offline fallback. It deliberately does not install a global network
 * proxy: assets, APIs and private pages go directly to the browser network.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let cancelled = false

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        })

        if (cancelled) return

        // Apply an already downloaded update promptly. The worker itself also
        // calls skipWaiting during install for first-time registration.
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
        await registration.update()
      } catch {
        // Push/offline are progressive enhancements; never block rendering.
      }
    }

    register()
    return () => {
      cancelled = true
    }
  }, [])

  return null
}
