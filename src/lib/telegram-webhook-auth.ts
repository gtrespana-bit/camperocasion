import { timingSafeEqual } from 'node:crypto'

const TELEGRAM_SECRET_FORMAT = /^[A-Za-z0-9_-]{32,256}$/

/**
 * Validate Telegram's X-Telegram-Bot-Api-Secret-Token header.
 *
 * Telegram's chat_id lives in the request body and is forgeable, so it must
 * never be used as the webhook's authentication mechanism. The shared secret
 * is configured through setWebhook(secret_token=...) and compared in constant
 * time after checking the byte lengths.
 */
export function isTelegramWebhookAuthorized(
  received: string | null,
  expected: string | undefined,
): boolean {
  if (!received || !expected || !TELEGRAM_SECRET_FORMAT.test(expected)) return false

  const receivedBytes = Buffer.from(received, 'utf8')
  const expectedBytes = Buffer.from(expected, 'utf8')
  return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes)
}

/**
 * Verify both the configured destination chat and the human who clicked.
 * Without the actor check, any member of an admin Telegram group could approve
 * a payment. For a private chat, Telegram's user ID and chat ID are identical.
 */
export function isTelegramAdminCallbackAuthorized(
  chatId: unknown,
  senderId: unknown,
  configuredChatId: string | undefined,
  configuredAdminUserId?: string,
): boolean {
  if (!configuredChatId) return false
  if (typeof chatId !== 'number' || !Number.isSafeInteger(chatId)) return false
  if (typeof senderId !== 'number' || !Number.isSafeInteger(senderId)) return false

  const authorizedUserId = configuredAdminUserId || configuredChatId
  return String(chatId) === configuredChatId && String(senderId) === authorizedUserId
}
