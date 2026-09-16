/*
 * VendeT Service Worker v15
 *
 * This worker intentionally does NOT proxy assets, APIs or every request.
 * It only provides:
 *   - Web Push notifications;
 *   - notification click handling;
 *   - a small offline fallback for public navigations;
 *   - cleanup of caches left by retired VendeT workers.
 *
 * Keeping the fetch handler limited to document navigations avoids the global
 * retry/timeout proxy that previously sat in front of Next.js chunks and APIs.
 */

const CACHE_NAME = 'vendet-offline-v15'
const OFFLINE_URLS = ['/offline', '/en/offline']
const PRIVATE_PREFIXES = [
  '/admin',
  '/dashboard',
  '/chat',
  '/mi-perfil',
  '/publicar',
  '/creditos',
  '/eliminar-cuenta',
  '/confirm',
  '/confirmacion',
  '/login',
  '/register',
  '/reset-password',
]

function isPrivateNavigation(pathname) {
  return PRIVATE_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`/en${prefix}`)
  )
}

function offlineUrlFor(pathname) {
  return pathname === '/en' || pathname.startsWith('/en/') ? '/en/offline' : '/offline'
}

function safeSameOriginUrl(value) {
  try {
    const url = new URL(value || '/chat', self.location.origin)
    if (url.origin !== self.location.origin) return new URL('/', self.location.origin).href
    return url.href
  } catch {
    return new URL('/', self.location.origin).href
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await self.skipWaiting()

    const cache = await caches.open(CACHE_NAME)
    await Promise.all(OFFLINE_URLS.map(async (url) => {
      try {
        const response = await fetch(new Request(url, { cache: 'no-store' }))
        if (response.ok) await cache.put(url, response)
      } catch {
        // The app can still install if the offline page is temporarily
        // unavailable during deployment. A plain fallback is used below.
      }
    }))
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(
      names
        .filter((name) => name.startsWith('vendet-') && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    )
    await self.clients.claim()
  })())
})

// Only public document navigations receive an offline fallback. Assets, APIs
// and authenticated pages go directly to the network and are never cached.
self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET' || request.mode !== 'navigate') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin || isPrivateNavigation(url.pathname)) return

  event.respondWith((async () => {
    try {
      // No custom timeout and no retry: let the browser/CDN handle networking.
      return await fetch(request)
    } catch {
      const cache = await caches.open(CACHE_NAME)
      const localizedOffline = await cache.match(offlineUrlFor(url.pathname))
      const defaultOffline = localizedOffline || await cache.match('/offline')
      if (defaultOffline) return defaultOffline

      return new Response(
        '<!doctype html><html lang="es"><meta charset="utf-8"><title>Sin conexión</title><body><h1>Sin conexión</h1><p>Vuelve a intentarlo cuando tengas internet.</p></body></html>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      )
    }
  })())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  const title = typeof data.title === 'string' && data.title.trim()
    ? data.title.slice(0, 120)
    : 'VendeT'
  const options = {
    body: typeof data.body === 'string' ? data.body.slice(0, 500) : 'Tienes una novedad en VendeT.',
    icon: typeof data.icon === 'string' ? data.icon : '/icon-192.png',
    badge: '/icon-192.png',
    tag: typeof data.tag === 'string' ? data.tag.slice(0, 100) : 'vendet-notification',
    data: { click_url: safeSameOriginUrl(data.click_url || data.url || '/chat') },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = safeSameOriginUrl(event.notification.data?.click_url || '/chat')

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find((client) => client.url.startsWith(self.location.origin))

    if (existing) {
      await existing.navigate(targetUrl)
      return existing.focus()
    }

    return self.clients.openWindow(targetUrl)
  })())
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  if (event.data?.type === 'CLEAR_PRIVATE_CACHE') {
    event.waitUntil(caches.delete(CACHE_NAME))
  }
})
