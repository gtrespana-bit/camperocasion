import {
  isTelegramAdminCallbackAuthorized,
  isTelegramWebhookAuthorized,
} from '@/lib/telegram-webhook-auth'

const secret = 'a'.repeat(64)

describe('isTelegramWebhookAuthorized', () => {
  it('accepts the exact configured Telegram secret token', () => {
    expect(isTelegramWebhookAuthorized(secret, secret)).toBe(true)
  })

  it('rejects missing secrets, invalid configuration, and mismatches', () => {
    expect(isTelegramWebhookAuthorized(null, secret)).toBe(false)
    expect(isTelegramWebhookAuthorized(secret, undefined)).toBe(false)
    expect(isTelegramWebhookAuthorized('b'.repeat(64), secret)).toBe(false)
    expect(isTelegramWebhookAuthorized('short', 'short')).toBe(false)
    expect(isTelegramWebhookAuthorized('x'.repeat(257), 'x'.repeat(257))).toBe(false)
    expect(isTelegramWebhookAuthorized('a'.repeat(63) + '!', 'a'.repeat(63) + '!')).toBe(false)
  })
})

describe('isTelegramAdminCallbackAuthorized', () => {
  it('authorizes the configured user in the configured chat', () => {
    expect(isTelegramAdminCallbackAuthorized(123456, 123456, '123456')).toBe(true)
    expect(isTelegramAdminCallbackAuthorized(-100123, 456789, '-100123', '456789')).toBe(true)
  })

  it('rejects another group member, another chat, or malformed IDs', () => {
    expect(isTelegramAdminCallbackAuthorized(-100123, 999999, '-100123', '456789')).toBe(false)
    expect(isTelegramAdminCallbackAuthorized(-100124, 456789, '-100123', '456789')).toBe(false)
    expect(isTelegramAdminCallbackAuthorized(-100123, 456789, '-100123')).toBe(false)
    expect(isTelegramAdminCallbackAuthorized('123456', 123456, '123456')).toBe(false)
    expect(isTelegramAdminCallbackAuthorized(123456, Number.MAX_SAFE_INTEGER + 1, '123456')).toBe(false)
  })
})
