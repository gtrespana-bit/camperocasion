'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const Analytics = dynamic(
  () => import('@vercel/analytics/react').then((m) => m.Analytics),
  { ssr: false }
)
const SpeedInsights = dynamic(
  () => import('@vercel/speed-insights/next').then((m) => m.SpeedInsights),
  { ssr: false }
)
const ServiceWorkerRegistration = dynamic(
  () => import('@/components/ServiceWorkerRegistration').then((m) => m.ServiceWorkerRegistration),
  { ssr: false }
)

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
    }, { timeout: 5000 })
  }

  if (document.readyState === 'complete') {
    timeoutId = setTimeout(run, 1500)
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
 * Efectos globales que no son necesarios para pintar ni hidratar la página.
 * Se activan después de load + idle para que analytics, Speed Insights y el
 * Service Worker no compitan con Lighthouse ni con el usuario en el arranque.
 */
export default function RootClientEffects() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    // Keep the audit path free of non-critical effects during the initial
    // render, but do not unregister the application's push/offline worker.
    // The worker itself only handles public navigations and push events.
    return onIdleAfterLoad(() => setEnabled(true))
  }, [])

  if (!enabled) return null

  return (
    <>
      <Analytics />
      <SpeedInsights />
      <ServiceWorkerRegistration />
    </>
  )
}
