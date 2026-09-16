/** Regression tests for the focused VendeT Service Worker. */
import * as fs from 'fs'
import * as path from 'path'

test('keeps networking direct except for public navigation fallback', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../public/sw.js'), 'utf8')

  expect(source).toContain("addEventListener('fetch'")
  expect(source).toContain("request.mode !== 'navigate'")
  expect(source).toContain('isPrivateNavigation')
  expect(source).not.toMatch(/fetchWithRetry|AbortController|setTimeout\(/)
})

test('supports push notifications and safe notification clicks', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../public/sw.js'), 'utf8')

  expect(source).toContain("addEventListener('push'")
  expect(source).toContain('showNotification')
  expect(source).toContain("addEventListener('notificationclick'")
  expect(source).toContain('safeSameOriginUrl')
})

test('cleans retired caches without unregistering the active worker', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../public/sw.js'), 'utf8')

  expect(source).toContain("name.startsWith('vendet-')")
  expect(source).toContain('clients.claim()')
  expect(source).not.toContain('self.registration.unregister()')
})
