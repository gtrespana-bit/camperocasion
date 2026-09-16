import { getSafeRedirectPath } from '../../src/lib/safe-redirect'

describe('getSafeRedirectPath', () => {
  it.each(['/admin', '/dashboard?tab=products', '/en/admin'])('allows local paths: %s', (path) => {
    expect(getSafeRedirectPath(path)).toBe(path)
  })

  it.each([null, '', 'https://evil.example', '//evil.example', '/\\evil.example'])('rejects unsafe values: %s', (path) => {
    expect(getSafeRedirectPath(path)).toBeNull()
  })
})
