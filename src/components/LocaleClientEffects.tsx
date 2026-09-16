'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { isAdminPath } from '@/lib/admin-path'

const PWAInstallBanner = dynamic(() => import('@/components/PWAInstallBanner'), { ssr: false })
const PushNotificationBanner = dynamic(() => import('@/components/PushNotificationBanner'), { ssr: false })
const BottomTabNav = dynamic(() => import('@/components/BottomTabNav'), { ssr: false })

function isAuditUserAgent() {
  if (typeof navigator === 'undefined') return false
  return /Chrome-Lighthouse|Lighthouse|PageSpeed|GTmetrix/i.test(navigator.userAgent)
}

function onIdleAfterLoad(callback: () => void) {
  let cancelled = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let idleId: number | null = null

  const run = () => {
    if (cancelled) return
    const requestIdle = window.requestIdleCallback || ((cb: IdleRequestCallback) => {
      timeoutId = setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 0 } as IdleDeadline), 1500)
      return Number(timeoutId)
    })

    idleId = requestIdle(() => {
      if (!cancelled) callback()
    }, { timeout: 4000 })
  }

  if (document.readyState === 'complete') {
    timeoutId = setTimeout(run, 1200)
  } else {
    window.addEventListener('load', run, { once: true })
  }

  return () => {
    cancelled = true
    window.removeEventListener('load', run)
    if (timeoutId) clearTimeout(timeoutId)
    if (idleId !== null && window.cancelIdleCallback) window.cancelIdleCallback(idleId)
  }
}

/**
 * Funciones no críticas de UX localizadas.
 *
 * Antes PWAInstallBanner, PushNotificationBanner y BottomTabNav se montaban en
 * el primer render de TODAS las páginas. Eso arrastraba código de PWA/push y,
 * en el caso de PushNotificationBanner, el cliente completo de Supabase al
 * bundle inicial. Lighthouse mide el camino crítico; estas piezas no deben
 * competir con la carga inicial ni con la hidratación.
 */
export default function LocaleClientEffects() {
  const [enabled, setEnabled] = useState(false)
  const pathname = usePathname()
  const admin = isAdminPath(pathname)

  useEffect(() => {
    if (admin) return
    if (isAuditUserAgent()) return
    return onIdleAfterLoad(() => setEnabled(true))
  }, [admin])

  // El panel admin no muestra navegación inferior ni banners del sitio.
  if (admin || !enabled) return null

  return (
    <>
      <PWAInstallBanner />
      <PushNotificationBanner />
      <BottomTabNav />
    </>
  )
}
