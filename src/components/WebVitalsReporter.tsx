'use client'

import { useEffect } from 'react'

/**
 * RUM ligero para Core Web Vitals (LCP / CLS / INP).
 * Usa PerformanceObserver nativo (sin deps) y envía vía beacon a /api/analytics/visita
 * o a Vercel Speed Insights (ya montado en RootClientEffects).
 * Solo registra valores buenos/malos para depurar regressions sin añadir peso.
 */
function sendMetric(name: string, value: number, rating: string) {
  // Beacon silencioso a nuestro endpoint (reusa AnaliticaVisitas si existe)
  // No bloquea navegación, no requiere consentimiento extra porque es métrica anónima de performance
  try {
    const body = JSON.stringify({ metric: name, value: Math.round(value), rating, url: location.pathname })
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/visita', body)
    } else {
      fetch('/api/analytics/visita', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {})
    }
  } catch {}
  // Consola en dev para ver LCP sin abrir Speed Insights
  if (process.env.NODE_ENV !== 'production') {
    console.debug(`[WebVitals] ${name}: ${Math.round(value)} (${rating})`)
  }
}

function ratingFor(name: string, value: number): string {
  if (name === 'LCP') return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor'
  if (name === 'CLS') return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor'
  if (name === 'INP') return value <= 200 ? 'good' : value <= 500 ? 'needs-improvement' : 'poor'
  if (name === 'FID') return value <= 100 ? 'good' : value <= 300 ? 'needs-improvement' : 'poor'
  if (name === 'TTFB') return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor'
  return 'unknown'
}

export default function WebVitalsReporter() {
  useEffect(() => {
    // LCP
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const last = entries[entries.length - 1] as any
        if (last) {
          const value = last.renderTime || last.loadTime || last.startTime
          sendMetric('LCP', value, ratingFor('LCP', value))
        }
      })
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true } as any)

      // CLS
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value
          }
        }
      })
      clsObserver.observe({ type: 'layout-shift', buffered: true } as any)
      // Report CLS on visibility hidden (final value)
      const onHidden = () => {
        if (document.visibilityState === 'hidden') {
          sendMetric('CLS', clsValue, ratingFor('CLS', clsValue))
        }
      }
      document.addEventListener('visibilitychange', onHidden)
      
      // INP (Interaction to Next Paint) - requires on-event handling
      let inpValue = 0
      const inpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as any[]) {
          if (entry.interactionId) {
            const dur = entry.processingEnd - entry.startTime
            if (dur > inpValue) inpValue = dur
          }
        }
      })
      try {
        inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 16 } as any)
      } catch {
        // event observer with durationThreshold not supported in all browsers
        try { inpObserver.observe({ type: 'event', buffered: true } as any) } catch {}
      }
      const reportINP = () => {
        if (inpValue > 0) sendMetric('INP', inpValue, ratingFor('INP', inpValue))
      }
      window.addEventListener('pagehide', reportINP)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') reportINP()
      })

      // TTFB via navigation entry
      const navEntries = performance.getEntriesByType('navigation') as any[]
      if (navEntries.length > 0) {
        const nav = navEntries[0]
        const ttfb = nav.responseStart - nav.requestStart
        if (ttfb > 0) sendMetric('TTFB', ttfb, ratingFor('TTFB', ttfb))
      }

      return () => {
        lcpObserver.disconnect()
        clsObserver.disconnect()
        inpObserver.disconnect()
        document.removeEventListener('visibilitychange', onHidden)
        window.removeEventListener('pagehide', reportINP)
      }
    } catch {
      // PerformanceObserver not available (old browser)
    }
  }, [])

  return null
}
