/**
 * Returns a safe relative path for post-authentication navigation.
 * Absolute, protocol-relative and backslash paths are rejected to prevent
 * attackers from turning the login redirect parameter into an open redirect.
 */
export function getSafeRedirectPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return null
  }

  return value
}
